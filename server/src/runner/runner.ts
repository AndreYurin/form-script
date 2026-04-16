import { spawn } from "node:child_process";
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

export interface RunOptions {
  projectId: number;
  scriptName: string;
  scriptFile: string;
  args?: string[];
  env?: Record<string, string>;
  noticeId?: number | null;
}

export async function runScript(opts: RunOptions): Promise<ScriptRun> {
  const em = getOrm().em.fork();

  const run = em.create(ScriptRun, {
    project: em.getReference(Project, opts.projectId),
    notice: opts.noticeId ? em.getReference(Notice, opts.noticeId) : null,
    scriptName: opts.scriptName,
    status: ScriptRunStatus.Running,
    log: "",
    startedAt: new Date(),
  });
  await em.persistAndFlush(run);
  const runId = run.id;

  const logLines: string[] = [];

  const child = spawn("node", [opts.scriptFile, ...(opts.args ?? [])], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...(opts.env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    logLines.push(text);
    process.stdout.write(`[${opts.scriptName}] ${text}`);
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    logLines.push(`[stderr] ${text}`);
    process.stderr.write(`[${opts.scriptName}:err] ${text}`);
  });

  return new Promise<ScriptRun>((resolve, reject) => {
    child.on("close", async (code) => {
      const log = logLines.join("");
      const status =
        code === 0 ? ScriptRunStatus.Success : ScriptRunStatus.Error;
      try {
        const finishEm = getOrm().em.fork();
        const updated = await finishEm.findOneOrFail(ScriptRun, { id: runId });
        updated.status = status;
        updated.log = log;
        updated.finishedAt = new Date();
        await finishEm.flush();
        if (code === 0) resolve(updated);
        else reject(new Error(`script ${opts.scriptName} exited with code ${code}`));
      } catch (err) {
        reject(err);
      }
    });
    child.on("error", (err) => reject(err));
  });
}
