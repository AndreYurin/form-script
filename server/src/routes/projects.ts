import { Router } from "express";
import { Project, type SearchConfig } from "../db/entities/project.js";
import { ScriptRun } from "../db/entities/script-run.js";
import { ScriptRunStatus } from "../db/enums.js";
import { rescheduleProject } from "../cron/scheduler.js";
import { cancelRun, stopProject } from "../runner/runner.js";

export const projectsRouter = Router();

function serializeProject(project: Project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    targetUrl: project.targetUrl,
    cronExpression: project.cronExpression,
    cronEnabled: project.cronEnabled,
    searchConfigs: project.searchConfigs ?? [],
    createdAt: project.createdAt,
  };
}

function normalizeSearchConfigs(input: unknown): SearchConfig[] | null {
  if (!Array.isArray(input)) return null;

  const seenIds = new Set<string>();
  const result: SearchConfig[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Record<string, unknown>;

    const id = typeof obj.id === "string" && obj.id.trim().length > 0 ? obj.id.trim() : null;
    if (!id) return null;
    if (seenIds.has(id)) return null;
    seenIds.add(id);

    const name = typeof obj.name === "string" ? obj.name : "";

    const kws = Array.isArray(obj.searchKeywords) ? obj.searchKeywords : [];
    if (!kws.every((k) => typeof k === "string")) return null;

    const filters = Array.isArray(obj.organizerFilters) ? obj.organizerFilters : [];
    if (!filters.every((k) => typeof k === "string")) return null;

    let amountFrom: number | null = null;
    if (obj.amountFrom !== undefined && obj.amountFrom !== null && obj.amountFrom !== "") {
      const n = typeof obj.amountFrom === "number" ? obj.amountFrom : Number(obj.amountFrom);
      if (!Number.isFinite(n) || n < 0) return null;
      amountFrom = Math.floor(n);
    }

    result.push({
      id,
      name,
      searchKeywords: (kws as string[]).map((s) => s.trim()).filter((s) => s.length > 0),
      organizerFilters: (filters as string[]).map((s) => s.trim()).filter((s) => s.length > 0),
      amountFrom,
    });
  }
  return result;
}

projectsRouter.get("/", async (req, res, next) => {
  try {
    const rows = await req.em.find(Project, {}, { orderBy: { id: "asc" } });
    res.json(rows.map(serializeProject));
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const project = await req.em.findOne(Project, { id });
    if (!project) return res.status(404).json({ error: "project not found" });

    const lastRun = await req.em.findOne(
      ScriptRun,
      { project: id },
      { orderBy: { startedAt: "desc" } },
    );

    const lastRunJson = lastRun
      ? {
          id: lastRun.id,
          projectId: lastRun.project.id,
          noticeId: lastRun.notice?.id ?? null,
          scriptName: lastRun.scriptName,
          status: lastRun.status,
          log: lastRun.log,
          startedAt: lastRun.startedAt,
          finishedAt: lastRun.finishedAt ?? null,
        }
      : null;

    res.json({ ...serializeProject(project), lastRun: lastRunJson });
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch("/:id/search-configs", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { searchConfigs } = req.body as { searchConfigs?: unknown };

    const normalized = normalizeSearchConfigs(searchConfigs);
    if (normalized === null) {
      return res.status(400).json({
        error:
          "searchConfigs must be an array of { id, name, searchKeywords[], organizerFilters[] } with unique non-empty ids",
      });
    }

    const project = await req.em.findOne(Project, { id });
    if (!project) return res.status(404).json({ error: "project not found" });

    project.searchConfigs = normalized;
    await req.em.flush();
    res.json(serializeProject(project));
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch("/:id/cron", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { cronExpression, cronEnabled } = req.body as {
      cronExpression?: string;
      cronEnabled?: boolean;
    };

    const project = await req.em.findOne(Project, { id });
    if (!project) return res.status(404).json({ error: "project not found" });

    let changed = false;
    if (typeof cronExpression === "string") {
      project.cronExpression = cronExpression;
      changed = true;
    }
    if (typeof cronEnabled === "boolean") {
      project.cronEnabled = cronEnabled;
      changed = true;
    }

    if (!changed) {
      return res.status(400).json({ error: "no fields to update" });
    }

    await req.em.flush();
    await rescheduleProject(project);
    res.json(serializeProject(project));
  } catch (err) {
    next(err);
  }
});

projectsRouter.post("/:id/stop-all", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const project = await req.em.findOne(Project, { id });
    if (!project) return res.status(404).json({ error: "project not found" });

    project.cronEnabled = false;
    await req.em.flush();
    await rescheduleProject(project);

    // Set the project-wide stop flag BEFORE killing children so any
    // bulk loops bail before spawning the next iteration.
    stopProject(id);

    const runningRuns = await req.em.find(ScriptRun, {
      project: id,
      status: ScriptRunStatus.Running,
    });

    let cancelledCount = 0;
    for (const run of runningRuns) {
      const result = await cancelRun(run.id);
      if (result.found || !result.alreadyFinished) cancelledCount++;
    }

    res.json({
      ok: true,
      cronDisabled: true,
      cancelledRuns: cancelledCount,
      totalRunning: runningRuns.length,
    });
  } catch (err) {
    next(err);
  }
});
