import "dotenv/config";
import { defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";
import { Project } from "./db/entities/project.js";
import { Notice } from "./db/entities/notice.js";
import { ScriptRun } from "./db/entities/script-run.js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://form_script:form_script@localhost:5432/form_script";

export default defineConfig({
  clientUrl: connectionString,
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
