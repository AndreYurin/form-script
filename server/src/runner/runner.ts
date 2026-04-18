import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getOrm } from "../db/client.js";
import { ScriptRun } from "../db/entities/script-run.js";
import { Project } from "../db/entities/project.js";
import { Notice } from "../db/entities/notice.js";
import { ScriptRunStatus } from "../db/enums.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

// In-process registry of live child processes keyed by the `ScriptRun.id`
// they belong to. Populated when a child spawns; deleted on close. Used by
// `cancelRun` to SIGTERM/SIGKILL a running script.
const runningChildren = new Map<number, ChildProcess>();

// Cancellation flag set. When `runId` is present here, outer loops in
// `runStep1` / `runStep2Bulk` bail between iterations so no further children
// are spawned for the cancelled run.
const cancelledRuns = new Set<number>();

// Project-level cancellation flag. When `projectId` is present here, ALL
// in-flight loops for that project bail between iterations — used by the
// project-wide Stop All control. Cleared explicitly when a fresh run starts
// for the project.
const stoppedProjects = new Set<number>();

const SIGKILL_GRACE_MS = 5_000;

export function isCancelled(runId: number): boolean {
  return cancelledRuns.has(runId);
}

export function clearCancellation(runId: number): void {
  cancelledRuns.delete(runId);
}

export function isProjectStopped(projectId: number): boolean {
  return stoppedProjects.has(projectId);
}

export function stopProject(projectId: number): void {
  stoppedProjects.add(projectId);
}

export function clearProjectStop(projectId: number): void {
  stoppedProjects.delete(projectId);
}

export interface CancelResult {
  found: boolean;
  alreadyFinished: boolean;
}

export async function cancelRun(runId: number): Promise<CancelResult> {
  cancelledRuns.add(runId);
  const child = runningChildren.get(runId);
  if (!child) {
    return { found: false, alreadyFinished: true };
  }
  if (child.exitCode !== null || child.signalCode !== null) {
    return { found: true, alreadyFinished: true };
  }

  try {
    child.kill("SIGTERM");
  } catch {
    return { found: true, alreadyFinished: true };
  }

  setTimeout(() => {
    const stillThere = runningChildren.get(runId);
    if (stillThere && stillThere.exitCode === null && stillThere.signalCode === null) {
      try {
        stillThere.kill("SIGKILL");
      } catch {
        // child already gone
      }
    }
  }, SIGKILL_GRACE_MS).unref?.();

  await finalizeRunAsCancelled(runId);
  return { found: true, alreadyFinished: false };
}

export async function finalizeRunAsCancelled(runId: number): Promise<void> {
  const em = getOrm().em.fork();
  const row = await em.findOne(ScriptRun, { id: runId });
  if (!row) return;
  if (row.status !== ScriptRunStatus.Running) return;
  row.status = ScriptRunStatus.Cancelled;
  row.log = (row.log || "") + "\n[cancelled]\n";
  row.finishedAt = new Date();
  await em.flush();
}

export interface RunOptions {
  projectId: number;
  scriptName: string;
  scriptFile: string;
  args?: string[];
  env?: Record<string, string>;
  noticeId?: number | null;
  /** When set, appends log output to an existing ScriptRun row instead of creating a new one. */
  existingRunId?: number;
  /** Prefix appended to each log line when writing to an existing run row. */
  logPrefix?: string;
}

export async function runScript(opts: RunOptions): Promise<ScriptRun> {
  const em = getOrm().em.fork();

  let runId: number;

  if (opts.existingRunId !== undefined) {
    runId = opts.existingRunId;
  } else {
    const run = em.create(ScriptRun, {
      project: em.getReference(Project, opts.projectId),
      notice: opts.noticeId ? em.getReference(Notice, opts.noticeId) : null,
      scriptName: opts.scriptName,
      status: ScriptRunStatus.Running,
      log: "",
      startedAt: new Date(),
    });
    await em.persistAndFlush(run);
    runId = run.id;
  }

  const logLines: string[] = [];
  const prefix = opts.logPrefix ?? "";

  const child = spawn("node", [opts.scriptFile, ...(opts.args ?? [])], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...(opts.env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  runningChildren.set(runId, child);

  child.stdout.on("data", (chunk) => {
    const text = prefix + chunk.toString();
    logLines.push(text);
    process.stdout.write(`[${opts.scriptName}] ${text}`);
  });

  child.stderr.on("data", (chunk) => {
    const text = `${prefix}[stderr] ${chunk.toString()}`;
    logLines.push(text);
    process.stderr.write(`[${opts.scriptName}:err] ${text}`);
  });

  return new Promise<ScriptRun>((resolve, reject) => {
    child.on("close", async (code) => {
      runningChildren.delete(runId);
      const newLog = logLines.join("");
      const cancelled = cancelledRuns.has(runId);
      const status = cancelled
        ? ScriptRunStatus.Cancelled
        : code === 0
          ? ScriptRunStatus.Success
          : ScriptRunStatus.Error;
      try {
        const finishEm = getOrm().em.fork();
        const updated = await finishEm.findOneOrFail(ScriptRun, { id: runId });

        if (opts.existingRunId !== undefined) {
          // Append to existing log; don't update status/finishedAt (caller manages those)
          updated.log = (updated.log || "") + newLog;
        } else {
          updated.status = status;
          updated.log = newLog;
          updated.finishedAt = new Date();
        }

        await finishEm.flush();

        if (opts.existingRunId !== undefined) {
          // For sub-invocations, reject on non-zero exit so caller can handle
          if (code === 0) resolve(updated);
          else reject(new Error(`script ${opts.scriptName} exited with code ${code}`));
        } else {
          if (code === 0) resolve(updated);
          else reject(new Error(`script ${opts.scriptName} exited with code ${code}`));
        }
      } catch (err) {
        reject(err);
      }
    });
    child.on("error", (err) => {
      runningChildren.delete(runId);
      reject(err);
    });
  });
}
