import { eq } from "drizzle-orm";
import { db, pool } from "../src/db/client.js";
import { projects } from "../src/db/schema.js";
import { syncStep1Output, syncStep2Output } from "../src/runner/sync.js";

async function main() {
  const [project] = await db.select().from(projects).where(eq(projects.name, "goszakup"));
  if (!project) {
    console.error("[migrate] project 'goszakup' not found — run `npm run db:seed` first");
    process.exit(1);
  }

  console.log(`[migrate] syncing step1 output into project ${project.id}`);
  const step1 = await syncStep1Output(project.id);
  console.log(`[migrate] step1: inserted=${step1.inserted} skipped=${step1.skipped}`);

  console.log(`[migrate] syncing step2 output into project ${project.id}`);
  const step2 = await syncStep2Output(project.id);
  console.log(`[migrate] step2: updated=${step2.updated}`);

  await pool.end();
  console.log("[migrate] done");
}

main().catch(async (err) => {
  console.error("[migrate] failed", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
