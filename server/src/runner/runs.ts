import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { notices, type Notice, type ScriptRun } from "../db/schema.js";
import { runScript } from "./runner.js";
import { syncStep1Output, syncStep2Output } from "./sync.js";

const STEP1_FILE = "step1-collect-ids.js";
const STEP2_FILE = "step2-collect-details.js";

export async function runStep1(projectId: number): Promise<ScriptRun> {
  const run = await runScript({
    projectId,
    scriptName: "step1",
    scriptFile: STEP1_FILE,
  });
  await syncStep1Output(projectId);
  return run;
}

export async function runStep2ForNotice(projectId: number, notice: Notice): Promise<ScriptRun> {
  const run = await runScript({
    projectId,
    scriptName: "step2",
    scriptFile: STEP2_FILE,
    env: { NOTICE_ID: notice.noticeId },
    noticeId: notice.id,
  });
  await syncStep2Output(projectId, notice.noticeId);
  return run;
}

export async function runStep2Bulk(projectId: number): Promise<number[]> {
  const pending = await db
    .select()
    .from(notices)
    .where(and(eq(notices.projectId, projectId), eq(notices.status, "new")));

  const runIds: number[] = [];
  for (const notice of pending) {
    try {
      const run = await runStep2ForNotice(projectId, notice);
      runIds.push(run.id);
    } catch (err) {
      console.error(`[runStep2Bulk] failed for notice ${notice.noticeId}`, err);
    }
  }
  return runIds;
}
