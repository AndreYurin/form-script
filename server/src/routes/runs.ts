import { Router } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { scriptRuns } from "../db/schema.js";
import { runStep1 } from "../runner/runs.js";

export const runsRouter = Router();

runsRouter.get("/:id/script-runs", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 20)));

    const rows = await db
      .select()
      .from(scriptRuns)
      .where(eq(scriptRuns.projectId, projectId))
      .orderBy(desc(scriptRuns.startedAt))
      .limit(limit);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

runsRouter.get("/:id/script-runs/:runId", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const runId = Number(req.params.runId);

    const [row] = await db
      .select()
      .from(scriptRuns)
      .where(and(eq(scriptRuns.id, runId), eq(scriptRuns.projectId, projectId)));

    if (!row) return res.status(404).json({ error: "run not found" });
    res.json(row);
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
