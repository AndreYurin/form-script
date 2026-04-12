import { Router } from "express";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { notices } from "../db/schema.js";
import { runStep2ForNotice, runStep2Bulk } from "../runner/runs.js";

export const noticesRouter = Router();

noticesRouter.get("/:id/notices", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const status = req.query.status as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 50)));
    const offset = (page - 1) * pageSize;

    const whereClause = status
      ? and(eq(notices.projectId, projectId), eq(notices.status, status as any))
      : eq(notices.projectId, projectId);

    const rows = await db
      .select()
      .from(notices)
      .where(whereClause)
      .orderBy(desc(notices.updatedAt))
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notices)
      .where(whereClause);

    res.json({ rows, page, pageSize, total: count });
  } catch (err) {
    next(err);
  }
});

noticesRouter.patch("/:id/notices/:noticeId/reject", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const noticeRowId = Number(req.params.noticeId);

    const [updated] = await db
      .update(notices)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(and(eq(notices.id, noticeRowId), eq(notices.projectId, projectId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "notice not found" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

noticesRouter.post("/:id/notices/:noticeId/collect", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const noticeRowId = Number(req.params.noticeId);

    const [notice] = await db
      .select()
      .from(notices)
      .where(and(eq(notices.id, noticeRowId), eq(notices.projectId, projectId)));

    if (!notice) return res.status(404).json({ error: "notice not found" });
    if (notice.status === "rejected" || notice.status === "details_collected") {
      return res.status(409).json({ error: `notice is ${notice.status}, skipping` });
    }

    const run = await runStep2ForNotice(projectId, notice);
    res.json({ runId: run.id });
  } catch (err) {
    next(err);
  }
});

noticesRouter.post("/:id/run/step2/bulk", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const runIds = await runStep2Bulk(projectId);
    res.json({ runIds });
  } catch (err) {
    next(err);
  }
});
