import path from "node:path";
import { fileURLToPath } from "node:url";
import { getOrm } from "../db/client.js";
import { Notice } from "../db/entities/notice.js";
import { Project } from "../db/entities/project.js";
import { ScriptRun } from "../db/entities/script-run.js";
import { NoticeStatus, ScriptRunStatus } from "../db/enums.js";
import { runScript } from "./runner.js";
import { syncStep1Output, syncStep2Output } from "./sync.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

const STEP1_FILE = "step1-collect-ids.js";
const STEP2_FILE = "step2-collect-details.js";
const SCREENSHOTS_DIR = path.join(REPO_ROOT, "data", "screenshots");

export interface NoticeRef {
  id: number;
  noticeId: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}

export async function runStep1(projectId: number): Promise<ScriptRun> {
  const em = getOrm().em.fork();
  const project = await em.findOneOrFail(Project, { id: projectId });

  if (!project.searchKeywords || project.searchKeywords.length === 0) {
    throw new Error(
      "No search keywords configured for this project. Add at least one keyword before running Step 1.",
    );
  }

  const keywords = project.searchKeywords;

  // Create a single ScriptRun row that will cover all keywords
  const runEm = getOrm().em.fork();
  const run = runEm.create(ScriptRun, {
    project: runEm.getReference(Project, projectId),
    notice: null,
    scriptName: "step1",
    status: ScriptRunStatus.Running,
    log: "",
    startedAt: new Date(),
  });
  await runEm.persistAndFlush(run);
  const runId = run.id;

  const appendLog = async (text: string) => {
    const logEm = getOrm().em.fork();
    const row = await logEm.findOneOrFail(ScriptRun, { id: runId });
    row.log = (row.log || "") + text;
    await logEm.flush();
  };

  let overallSuccess = true;

  for (const keyword of keywords) {
    await appendLog(`\n[keyword: ${keyword}] Starting...\n`);

    // Phase A: screenshot
    const slug = slugify(keyword);
    const screenshotFile = `${runId}-${slug}.png`;
    const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotFile);

    await appendLog(`[keyword: ${keyword}] Taking screenshot...\n`);
    try {
      await runScript({
        projectId,
        scriptName: "step1-screenshot",
        scriptFile: STEP1_FILE,
        args: ["--keyword", keyword, "--screenshot-path", screenshotPath],
        existingRunId: runId,
        logPrefix: `[keyword: ${keyword}][screenshot] `,
      });

      // Save screenshot path on the run row (last keyword wins — or first success)
      const snapEm = getOrm().em.fork();
      const snapRun = await snapEm.findOneOrFail(ScriptRun, { id: runId });
      if (!snapRun.screenshotPath) {
        snapRun.screenshotPath = `screenshots/${screenshotFile}`;
        await snapEm.flush();
      }

      await appendLog(`[keyword: ${keyword}] Screenshot saved: ${screenshotFile}\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await appendLog(`[keyword: ${keyword}] Screenshot failed: ${msg}\n`);
      // Continue with collection even if screenshot fails
    }

    // Phase B: real collection
    await appendLog(`[keyword: ${keyword}] Collecting IDs...\n`);
    try {
      await runScript({
        projectId,
        scriptName: "step1-collect",
        scriptFile: STEP1_FILE,
        args: ["--keyword", keyword],
        existingRunId: runId,
        logPrefix: `[keyword: ${keyword}] `,
      });
      await syncStep1Output(projectId, keyword);
      await appendLog(`[keyword: ${keyword}] Done.\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await appendLog(`[keyword: ${keyword}] Collection failed: ${msg}\n`);
      overallSuccess = false;
    }
  }

  // Finalize the run row
  const finalEm = getOrm().em.fork();
  const finalRun = await finalEm.findOneOrFail(ScriptRun, { id: runId });
  finalRun.status = overallSuccess ? ScriptRunStatus.Success : ScriptRunStatus.Error;
  finalRun.finishedAt = new Date();
  await finalEm.flush();

  return finalRun;
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
