import { Router } from "express";
import { Project } from "../db/entities/project.js";
import { ScriptRun } from "../db/entities/script-run.js";
import { rescheduleProject } from "../cron/scheduler.js";

export const projectsRouter = Router();

function serializeProject(project: Project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    targetUrl: project.targetUrl,
    cronExpression: project.cronExpression,
    cronEnabled: project.cronEnabled,
    searchKeywords: project.searchKeywords,
    createdAt: project.createdAt,
  };
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

projectsRouter.patch("/:id/keywords", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { searchKeywords } = req.body as { searchKeywords?: unknown };

    if (
      !Array.isArray(searchKeywords) ||
      !searchKeywords.every((k) => typeof k === "string")
    ) {
      return res.status(400).json({ error: "searchKeywords must be an array of strings" });
    }

    const project = await req.em.findOne(Project, { id });
    if (!project) return res.status(404).json({ error: "project not found" });

    project.searchKeywords = searchKeywords;
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
