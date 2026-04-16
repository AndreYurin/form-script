import { getOrm } from "../db/client.js";
import { Notice } from "../db/entities/notice.js";
import { ScriptRun } from "../db/entities/script-run.js";
import { NoticeStatus } from "../db/enums.js";
import { runScript } from "./runner.js";
import { syncStep1Output, syncStep2Output } from "./sync.js";

const STEP1_FILE = "step1-collect-ids.js";
const STEP2_FILE = "step2-collect-details.js";

export interface NoticeRef {
  id: number;
  noticeId: string;
}

export async function runStep1(projectId: number): Promise<ScriptRun> {
  const run = await runScript({
    projectId,
    scriptName: "step1",
    scriptFile: STEP1_FILE,
  });
  await syncStep1Output(projectId);
  return run;
}

export async function runStep2ForNotice(
  projectId: number,
  notice: NoticeRef,
): Promise<ScriptRun> {
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
  const em = getOrm().em.fork();
  const pending = await em.find(Notice, {
    project: projectId,
    status: NoticeStatus.New,
  });

  const pendingRefs: NoticeRef[] = pending.map((n) => ({
    id: n.id,
    noticeId: n.noticeId,
  }));

  const runIds: number[] = [];
  for (const ref of pendingRefs) {
    try {
      const run = await runStep2ForNotice(projectId, ref);
      runIds.push(run.id);
    } catch (err) {
      console.error(`[runStep2Bulk] failed for notice ${ref.noticeId}`, err);
    }
  }
  return runIds;
}
