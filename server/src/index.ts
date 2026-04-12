import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectsRouter } from "./routes/projects.js";
import { noticesRouter } from "./routes/notices.js";
import { runsRouter } from "./routes/runs.js";
import { authRouter } from "./routes/auth.js";
import { initCronScheduler } from "./cron/scheduler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

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

app.listen(PORT, async () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  try {
    await initCronScheduler();
  } catch (err) {
    console.error("[api] cron init failed", err);
  }
});
