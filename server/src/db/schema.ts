import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const noticeStatusEnum = pgEnum("notice_status", [
  "new",
  "details_collected",
  "rejected",
  "error",
]);

export const scriptRunStatusEnum = pgEnum("script_run_status", [
  "running",
  "success",
  "error",
]);

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  targetUrl: text("target_url").notNull(),
  cronExpression: text("cron_expression").notNull().default("0 6 * * *"),
  cronEnabled: boolean("cron_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notices = pgTable(
  "notices",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    noticeId: text("notice_id").notNull(),
    organizer: text("organizer"),
    title: text("title"),
    status: noticeStatusEnum("status").notNull().default("new"),
    details: jsonb("details"),
    collectedAt: timestamp("collected_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    projectNoticeUnique: uniqueIndex("notices_project_notice_unique").on(
      t.projectId,
      t.noticeId,
    ),
    statusIdx: index("notices_status_idx").on(t.status),
  }),
);

export const scriptRuns = pgTable(
  "script_runs",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    noticeId: integer("notice_id").references(() => notices.id, { onDelete: "set null" }),
    scriptName: text("script_name").notNull(),
    status: scriptRunStatusEnum("status").notNull().default("running"),
    log: text("log").notNull().default(""),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => ({
    projectScriptIdx: index("script_runs_project_script_idx").on(t.projectId, t.scriptName),
  }),
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Notice = typeof notices.$inferSelect;
export type NewNotice = typeof notices.$inferInsert;
export type ScriptRun = typeof scriptRuns.$inferSelect;
export type NewScriptRun = typeof scriptRuns.$inferInsert;
