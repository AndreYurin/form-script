import "reflect-metadata";
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RequestContext } from "@mikro-orm/core";
import { initOrm, getOrm } from "./db/client.js";
import { projectsRouter } from "./routes/projects.js";
import { noticesRouter } from "./routes/notices.js";
import { runsRouter } from "./routes/runs.js";
import { authRouter, killAllAuthProcesses } from "./routes/auth.js";
import { initCronScheduler, stopAllCronJobs } from "./cron/scheduler.js";
import type { Server } from "node:http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use((req, _res, next) => {
  RequestContext.create(getOrm().em, () => {
    req.em = RequestContext.getEntityManager() as typeof req.em;
    next();
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Serve screenshot files
const SCREENSHOTS_DIR = path.resolve(__dirname, "../..", "data", "screenshots");
app.use("/data/screenshots", express.static(SCREENSHOTS_DIR));

app.use("/api/projects", projectsRouter);
app.use("/api/projects", noticesRouter);
app.use("/api/projects", runsRouter);
app.use("/api/projects", authRouter);

if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[api] error", err);
  res.status(500).json({ error: err.message ?? "internal error" });
});

let httpServer: Server | null = null;
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal} received — shutting down`);

  stopAllCronJobs();
  killAllAuthProcesses();

  const serverClosed = new Promise<void>((resolve) => {
    if (!httpServer) return resolve();
    httpServer.close(() => resolve());
    httpServer.closeAllConnections?.();
  });

  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
  await Promise.race([serverClosed, timeout]);

  try {
    await getOrm().close(true);
  } catch (err) {
    console.error("[api] orm close failed", err);
  }

  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

async function start() {
  await initOrm();
  console.log("[api] mikro-orm initialized");

  httpServer = app.listen(PORT, async () => {
    console.log(`[api] listening on http://localhost:${PORT}`);
    try {
      await initCronScheduler();
    } catch (err) {
      console.error("[api] cron init failed", err);
    }
  });
}

start().catch((err) => {
  console.error("[api] startup failed", err);
  process.exit(1);
});
