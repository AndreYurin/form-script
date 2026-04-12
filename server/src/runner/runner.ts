import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { scriptRuns, type ScriptRun } from "../db/schema.js";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../..");

export interface RunOptions {
  projectId: number;
  scriptName: string;
  scriptFile: string;
  args?: string[];
  env?: Record<string, string>;
  noticeId?: number | null;
}

export async function runScript(opts: RunOptions): Promise<ScriptRun> {
  const [run] = await db
    .insert(scriptRuns)
    .values({
      projectId: opts.projectId,
      noticeId: opts.noticeId ?? null,
      scriptName: opts.scriptName,
      status: "running",
      log: "",
    })
    .returning();

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
      const status = code === 0 ? "success" : "error";
      try {
        const [updated] = await db
          .update(scriptRuns)
          .set({ status, log, finishedAt: new Date() })
          .where(eq(scriptRuns.id, run.id))
          .returning();
        if (code === 0) resolve(updated);
        else reject(new Error(`script ${opts.scriptName} exited with code ${code}`));
      } catch (err) {
        reject(err);
      }
    });
    child.on("error", (err) => reject(err));
  });
}
