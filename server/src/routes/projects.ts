import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { projects, scriptRuns } from "../db/schema.js";
import { rescheduleProject } from "../cron/scheduler.js";

export const projectsRouter = Router();

projectsRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await db.select().from(projects).orderBy(projects.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) return res.status(404).json({ error: "project not found" });

    const [lastRun] = await db
      .select()
      .from(scriptRuns)
      .where(eq(scriptRuns.projectId, id))
      .orderBy(desc(scriptRuns.startedAt))
      .limit(1);

    res.json({ ...project, lastRun: lastRun ?? null });
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

    const patch: Partial<{ cronExpression: string; cronEnabled: boolean }> = {};
    if (typeof cronExpression === "string") patch.cronExpression = cronExpression;
    if (typeof cronEnabled === "boolean") patch.cronEnabled = cronEnabled;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "no fields to update" });
    }

    const [updated] = await db
      .update(projects)
      .set(patch)
      .where(eq(projects.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "project not found" });

    await rescheduleProject(updated);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
