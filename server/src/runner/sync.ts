import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { notices } from "../db/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../..");

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

export async function syncStep1Output(projectId: number): Promise<{ inserted: number; skipped: number }> {
  const entries = await readJsonSafe<MatchedEntry[]>(MATCHED_IDS_PATH, []);
  if (entries.length === 0) return { inserted: 0, skipped: 0 };

  const ids = entries.map((e) => e.id);
  const existing = await db
    .select({ noticeId: notices.noticeId, status: notices.status })
    .from(notices)
    .where(and(eq(notices.projectId, projectId), inArray(notices.noticeId, ids)));

  const existingSet = new Set(existing.map((r) => r.noticeId));
  const rejectedSet = new Set(existing.filter((r) => r.status === "rejected").map((r) => r.noticeId));

  let inserted = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (rejectedSet.has(entry.id)) {
      skipped++;
      continue;
    }
    if (existingSet.has(entry.id)) {
      skipped++;
      continue;
    }
    await db.insert(notices).values({
      projectId,
      noticeId: entry.id,
      organizer: entry.organizer ?? null,
      title: entry.title ?? null,
      status: "new",
      updatedAt: new Date(),
    });
    inserted++;
  }

  return { inserted, skipped };
}

export async function syncStep2Output(projectId: number, targetNoticeId?: string): Promise<{ updated: number }> {
  const entries = await readJsonSafe<ResultEntry[]>(RESULTS_PATH, []);
  if (entries.length === 0) return { updated: 0 };

  let updated = 0;
  for (const entry of entries) {
    if (targetNoticeId && entry.id !== targetNoticeId) continue;
    const [row] = await db
      .update(notices)
      .set({
        details: entry,
        status: "details_collected",
        collectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(notices.projectId, projectId), eq(notices.noticeId, entry.id)))
      .returning();
    if (row) updated++;
  }

  return { updated };
}
