import { Router } from "express";
import { ScriptRun } from "../db/entities/script-run.js";
import { runStep1 } from "../runner/runs.js";

export const runsRouter = Router();

function serializeScriptRun(run: ScriptRun) {
  return {
    id: run.id,
    projectId: run.project.id,
    noticeId: run.notice?.id ?? null,
    scriptName: run.scriptName,
    status: run.status,
    log: run.log,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt ?? null,
  };
}

runsRouter.get("/:id/script-runs", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 20)));

    const rows = await req.em.find(
      ScriptRun,
      { project: projectId },
      { orderBy: { startedAt: "desc" }, limit },
    );

    res.json(rows.map(serializeScriptRun));
  } catch (err) {
    next(err);
  }
});

runsRouter.get("/:id/script-runs/:runId", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const runId = Number(req.params.runId);

    const row = await req.em.findOne(ScriptRun, {
      id: runId,
      project: projectId,
    });

    if (!row) return res.status(404).json({ error: "run not found" });
    res.json(serializeScriptRun(row));
  } catch (err) {
    next(err);
  }
});

runsRouter.post("/:id/run/step1", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const run = await runStep1(projectId);
    res.json({ runId: run.id });
  } catch (err) {
    next(err);
  }
});
