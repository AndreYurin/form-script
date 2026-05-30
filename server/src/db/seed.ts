import "reflect-metadata";
import { initOrm, closeOrm } from "./client.js";
import { Project } from "./entities/project.js";

async function main() {
  const orm = await initOrm();
  const em = orm.em.fork();

  const existing = await em.findOne(Project, { name: "goszakup" });
  if (existing) {
    console.log("[seed] project already exists, skipping");
    await closeOrm();
    return;
  }

  const project = em.create(Project, {
    name: "goszakup",
    description: "Госзакупки — goszakup.gov.kz scraper for educational institutions",
    targetUrl: "https://goszakup.gov.kz/",
    cronExpression: "0 6 * * *",
    cronEnabled: false,
    searchConfigs: [],
    createdAt: new Date(),
  });
  await em.persistAndFlush(project);

  console.log("[seed] inserted project: goszakup – Госзакупки");
  await closeOrm();
}

main().catch(async (err) => {
  console.error("[seed] failed", err);
  await closeOrm().catch(() => {});
  process.exit(1);
});
