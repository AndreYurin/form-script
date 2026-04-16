import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getOrm } from "../db/client.js";
import { Notice } from "../db/entities/notice.js";
import { Project } from "../db/entities/project.js";
import { NoticeStatus } from "../db/enums.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

const MATCHED_IDS_PATH = path.join(REPO_ROOT, "data", "matched_ids.json");
const RESULTS_PATH = path.join(REPO_ROOT, "data", "results.json");

interface MatchedEntry {
  id: string;
  organizer?: string;
  title?: string;
}

interface ResultEntry {
  id: string;
  [k: string]: unknown;
}

async function readJsonSafe<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") return fallback;
    throw err;
  }
}

export async function syncStep1Output(
  projectId: number,
): Promise<{ inserted: number; skipped: number }> {
  const entries = await readJsonSafe<MatchedEntry[]>(MATCHED_IDS_PATH, []);
  if (entries.length === 0) return { inserted: 0, skipped: 0 };

  const em = getOrm().em.fork();
  const ids = entries.map((e) => e.id);

  const existing = await em.find(Notice, {
    project: projectId,
    noticeId: { $in: ids },
  });
  const existingMap = new Map(existing.map((n) => [n.noticeId, n]));

  let inserted = 0;
  let skipped = 0;

  const projectRef = em.getReference(Project, projectId);

  for (const entry of entries) {
    const found = existingMap.get(entry.id);
    if (found) {
      skipped++;
      continue;
    }
    em.create(Notice, {
      project: projectRef,
      noticeId: entry.id,
      organizer: entry.organizer ?? null,
      title: entry.title ?? null,
      status: NoticeStatus.New,
      updatedAt: new Date(),
    });
    inserted++;
  }

  await em.flush();
  return { inserted, skipped };
}

export async function syncStep2Output(
  projectId: number,
  targetNoticeId?: string,
): Promise<{ updated: number }> {
  const entries = await readJsonSafe<ResultEntry[]>(RESULTS_PATH, []);
  if (entries.length === 0) return { updated: 0 };

  const em = getOrm().em.fork();
  const filtered = targetNoticeId
    ? entries.filter((e) => e.id === targetNoticeId)
    : entries;
  if (filtered.length === 0) return { updated: 0 };

  const ids = filtered.map((e) => e.id);
  const rows = await em.find(Notice, {
    project: projectId,
    noticeId: { $in: ids },
  });
  const rowMap = new Map(rows.map((n) => [n.noticeId, n]));

  let updated = 0;
  const now = new Date();

  for (const entry of filtered) {
    const row = rowMap.get(entry.id);
    if (!row) continue;
    if (
      row.status === NoticeStatus.Rejected ||
      row.status === NoticeStatus.DetailsCollected
    ) {
      continue;
    }
    row.details = entry;
    row.status = NoticeStatus.DetailsCollected;
    row.collectedAt = now;
    row.updatedAt = now;
    updated++;
  }

  await em.flush();
  return { updated };
}
