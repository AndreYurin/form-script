import { Router } from "express";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Project } from "../db/entities/project.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

export const authRouter = Router();

const activeAuthProcesses = new Map<number, ChildProcess>();

export function killAllAuthProcesses(): void {
  for (const child of activeAuthProcesses.values()) {
    try {
      child.kill("SIGTERM");
    } catch {}
  }
  activeAuthProcesses.clear();
}

authRouter.post("/:id/authorize", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const project = await req.em.findOne(Project, { id: projectId });
    if (!project) return res.status(404).json({ error: "project not found" });

    if (activeAuthProcesses.has(projectId)) {
      return res.status(409).json({ error: "authorization already in progress" });
    }

    const child = spawn(
      "node",
      ["-e", buildAuthScript(project.targetUrl)],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, HEADED: "1" },
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      },
    );

    activeAuthProcesses.set(projectId, child);

    child.stdout?.on("data", (c) => process.stdout.write(`[auth:${projectId}] ${c}`));
    child.stderr?.on("data", (c) => process.stderr.write(`[auth:${projectId}:err] ${c}`));
    child.on("close", (code) => {
      activeAuthProcesses.delete(projectId);
      console.log(`[auth:${projectId}] exited with ${code}`);
    });

    res.json({ status: "started", pid: child.pid });
  } catch (err) {
    next(err);
  }
});

authRouter.delete("/:id/authorize", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const child = activeAuthProcesses.get(projectId);
    if (!child) return res.status(404).json({ error: "no active authorization" });
    child.kill("SIGTERM");
    activeAuthProcesses.delete(projectId);
    res.json({ status: "stopped" });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/:id/auth-status", async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const profileDir = path.join(REPO_ROOT, "data", "browser-profile");
    const cookiesPath = path.join(profileDir, "Default", "Cookies");

    let authorized = false;
    try {
      const stat = await fs.stat(cookiesPath);
      authorized = stat.size > 0;
    } catch {
      authorized = false;
    }

    res.json({
      authorized,
      inProgress: activeAuthProcesses.has(projectId),
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

function buildAuthScript(targetUrl: string): string {
  const escaped = targetUrl.replace(/'/g, "\\'");
  return `
    const { chromium } = require('playwright');
    (async () => {
      const ctx = await chromium.launchPersistentContext('data/browser-profile', {
        headless: false,
        viewport: { width: 1280, height: 800 },
      });
      const page = ctx.pages()[0] ?? await ctx.newPage();
      await page.goto('${escaped}');
      console.log('[auth] browser open — close the window when done');
      ctx.on('close', () => process.exit(0));
    })().catch((e) => { console.error(e); process.exit(1); });
  `;
}
