import "reflect-metadata";
import { initOrm, closeOrm } from "../src/db/client.js";
import { Project } from "../src/db/entities/project.js";
import { syncStep1Output, syncStep2Output } from "../src/runner/sync.js";

async function main() {
  const orm = await initOrm();
  const em = orm.em.fork();

  const project = await em.findOne(Project, { name: "goszakup" });
  if (!project) {
    console.error("[migrate] project 'goszakup' not found — run `npm run db:seed` first");
    await closeOrm();
    process.exit(1);
  }

  console.log(`[migrate] syncing step1 output into project ${project.id}`);
  const step1 = await syncStep1Output(project.id);
  console.log(`[migrate] step1: inserted=${step1.inserted} skipped=${step1.skipped}`);

  console.log(`[migrate] syncing step2 output into project ${project.id}`);
  const step2 = await syncStep2Output(project.id);
  console.log(`[migrate] step2: updated=${step2.updated}`);

  await closeOrm();
  console.log("[migrate] done");
}

main().catch(async (err) => {
  console.error("[migrate] failed", err);
  await closeOrm().catch(() => {});
  process.exit(1);
});
