import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@mikro-orm/better-sqlite";
import { Migrator } from "@mikro-orm/migrations";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";
import { Project } from "./db/entities/project.js";
import { Notice } from "./db/entities/notice.js";
import { ScriptRun } from "./db/entities/script-run.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultDbPath = path.resolve(__dirname, "../..", "data", "app.db");
const rawUrl = process.env.DATABASE_URL?.trim();
const isSqlitePath =
  !!rawUrl && (rawUrl.startsWith("sqlite://") || !/^[a-z]+:\/\//i.test(rawUrl));
const dbName = isSqlitePath
  ? rawUrl!.replace(/^sqlite:\/\//, "")
  : defaultDbPath;
if (rawUrl && !isSqlitePath) {
  console.warn(
    `[mikro-orm] Ignoring non-SQLite DATABASE_URL (${rawUrl.split("://")[0]}://…) — using ${defaultDbPath}`,
  );
}

export default defineConfig({
  dbName,
  entities: [Project, Notice, ScriptRun],
  entitiesTs: [Project, Notice, ScriptRun],
  metadataProvider: TsMorphMetadataProvider,
  debug: process.env.NODE_ENV !== "production",
  extensions: [Migrator],
  migrations: {
    path: "./dist/migrations",
    pathTs: "./src/migrations",
    glob: "!(*.d).{js,ts}",
    transactional: true,
    emit: "ts",
  },
  forceUtcTimezone: true,
});
