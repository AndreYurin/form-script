import cron, { type ScheduledTask } from "node-cron";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { projects, type Project } from "../db/schema.js";
import { runStep1 } from "../runner/runs.js";

const jobs = new Map<number, ScheduledTask>();

export async function initCronScheduler(): Promise<void> {
  const rows = await db.select().from(projects);
  for (const project of rows) {
    if (project.cronEnabled) registerJob(project);
  }
  console.log(`[cron] initialized ${jobs.size} job(s)`);
}

function registerJob(project: Project): void {
  if (!cron.validate(project.cronExpression)) {
    console.error(`[cron] invalid expression for project ${project.id}: ${project.cronExpression}`);
    return;
  }

  const task = cron.schedule(project.cronExpression, async () => {
    console.log(`[cron] firing project ${project.id} (${project.name})`);
    try {
      await runStep1(project.id);
    } catch (err) {
      console.error(`[cron] project ${project.id} step1 failed`, err);
    }
  });

  jobs.set(project.id, task);
  console.log(`[cron] registered project ${project.id} → ${project.cronExpression}`);
}

function unregisterJob(projectId: number): void {
  const existing = jobs.get(projectId);
  if (existing) {
    existing.stop();
    jobs.delete(projectId);
  }
}

export async function rescheduleProject(project: Project): Promise<void> {
  unregisterJob(project.id);
  if (project.cronEnabled) registerJob(project);
}

export async function rescheduleById(projectId: number): Promise<void> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (project) await rescheduleProject(project);
}
