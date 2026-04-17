import { Router } from "express";
import { Notice } from "../db/entities/notice.js";
import { NoticeStatus } from "../db/enums.js";
import { runStep2ForNotice, runStep2Bulk } from "../runner/runs.js";

export const noticesRouter = Router();

function serializeNotice(notice: Notice) {
  return {
    id: notice.id,
    projectId: notice.project.id,
    noticeId: notice.noticeId,
    organizer: notice.organizer ?? null,
    title: notice.title ?? null,
    searchKeyword: notice.searchKeyword ?? null,
    status: notice.status,
    details: notice.details ?? null,
    collectedAt: notice.collectedAt ?? null,
    updatedAt: notice.updatedAt,
  };
}

noticesRouter.get("/:id/notices", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const status = req.query.status as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 50)));
    const offset = (page - 1) * pageSize;

    const where: Record<string, unknown> = { project: projectId };
    if (status) where.status = status as NoticeStatus;

    const [rows, total] = await req.em.findAndCount(Notice, where, {
      orderBy: { updatedAt: "desc" },
      limit: pageSize,
      offset,
    });

    res.json({ rows: rows.map(serializeNotice), page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

noticesRouter.patch("/:id/notices/:noticeId/reject", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const noticeRowId = Number(req.params.noticeId);

    const notice = await req.em.findOne(Notice, {
      id: noticeRowId,
      project: projectId,
    });
    if (!notice) return res.status(404).json({ error: "notice not found" });

    notice.status = NoticeStatus.Rejected;
    notice.updatedAt = new Date();
    await req.em.flush();

    res.json(serializeNotice(notice));
  } catch (err) {
    next(err);
  }
});

noticesRouter.post("/:id/notices/:noticeId/collect", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const noticeRowId = Number(req.params.noticeId);

    const notice = await req.em.findOne(Notice, {
      id: noticeRowId,
      project: projectId,
    });

    if (!notice) return res.status(404).json({ error: "notice not found" });
    if (
      notice.status === NoticeStatus.Rejected ||
      notice.status === NoticeStatus.DetailsCollected
    ) {
      return res.status(409).json({ error: `notice is ${notice.status}, skipping` });
    }

    const run = await runStep2ForNotice(projectId, {
      id: notice.id,
      noticeId: notice.noticeId,
    });
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
