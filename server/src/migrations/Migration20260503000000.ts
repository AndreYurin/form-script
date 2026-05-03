import { Migration } from "@mikro-orm/migrations";

export class Migration20260503000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "projects" (
        "id" integer not null primary key autoincrement,
        "name" text not null,
        "description" text null,
        "target_url" text not null,
        "cron_expression" text not null default '0 6 * * *',
        "cron_enabled" integer not null default 0,
        "search_keywords" text not null default '[]',
        "created_at" datetime not null default current_timestamp
      );
    `);

    this.addSql(`
      create table "notices" (
        "id" integer not null primary key autoincrement,
        "project_id" integer not null references "projects"("id") on delete cascade,
        "notice_id" text not null,
        "organizer" text null,
        "title" text null,
        "search_keyword" text null,
        "status" text not null default 'new'
          check ("status" in ('new', 'details_collected', 'rejected', 'error')),
        "details" text null,
        "collected_at" datetime null,
        "updated_at" datetime not null default current_timestamp
      );
    `);
    this.addSql(
      `create unique index "notices_project_notice_unique" on "notices" ("project_id", "notice_id");`,
    );
    this.addSql(
      `create index "notices_status_idx" on "notices" ("status");`,
    );

    this.addSql(`
      create table "script_runs" (
        "id" integer not null primary key autoincrement,
        "project_id" integer not null references "projects"("id") on delete cascade,
        "notice_id" integer null references "notices"("id") on delete set null,
        "script_name" text not null,
        "status" text not null default 'running'
          check ("status" in ('running', 'success', 'error', 'cancelled')),
        "log" text not null default '',
        "screenshot_path" text null,
        "started_at" datetime not null default current_timestamp,
        "finished_at" datetime null
      );
    `);
    this.addSql(
      `create index "script_runs_project_script_idx" on "script_runs" ("project_id", "script_name");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "script_runs";`);
    this.addSql(`drop table if exists "notices";`);
    this.addSql(`drop table if exists "projects";`);
  }
}
