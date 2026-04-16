import cron, { type ScheduledTask } from "node-cron";
import { getOrm } from "../db/client.js";
import { Project } from "../db/entities/project.js";
import { runStep1 } from "../runner/runs.js";

const jobs = new Map<number, ScheduledTask>();

export async function initCronScheduler(): Promise<void> {
  const em = getOrm().em.fork();
  const rows = await em.find(Project, {});
  for (const project of rows) {
    if (project.cronEnabled) registerJob(project);
  }
  console.log(`[cron] initialized ${jobs.size} job(s)`);
}

function registerJob(project: Project): void {
  if (!cron.validate(project.cronExpression)) {
    console.error(
      `[cron] invalid expression for project ${project.id}: ${project.cronExpression}`,
    );
    return;
  }

  const projectId = project.id;
  const projectName = project.name;
  const task = cron.schedule(project.cronExpression, async () => {
    console.log(`[cron] firing project ${projectId} (${projectName})`);
    try {
      await runStep1(projectId);
    } catch (err) {
      console.error(`[cron] project ${projectId} step1 failed`, err);
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
  const em = getOrm().em.fork();
  const project = await em.findOne(Project, { id: projectId });
  if (project) await rescheduleProject(project);
}

export function stopAllCronJobs(): void {
  for (const task of jobs.values()) task.stop();
  jobs.clear();
}
