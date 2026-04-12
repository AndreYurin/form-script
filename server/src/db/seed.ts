import { db, pool } from "./client.js";
import { projects } from "./schema.js";
import { eq } from "drizzle-orm";

async function main() {
  const existing = await db.select().from(projects).where(eq(projects.name, "goszakup"));
  if (existing.length > 0) {
    console.log("[seed] project already exists, skipping");
    await pool.end();
    return;
  }

  await db.insert(projects).values({
    name: "goszakup",
    description: "Госзакупки — goszakup.gov.kz scraper for educational institutions",
    targetUrl: "https://goszakup.gov.kz/",
    cronExpression: "0 6 * * *",
    cronEnabled: false,
  });

  console.log("[seed] inserted project: goszakup – Госзакупки");
  await pool.end();
}

main().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
