import { Migration } from "@mikro-orm/migrations";

export class Migration20260414000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "projects" (
        "id" serial primary key,
        "name" text not null,
        "description" text null,
        "target_url" text not null,
        "cron_expression" text not null default '0 6 * * *',
        "cron_enabled" boolean not null default false,
        "created_at" timestamptz not null default now()
      );
    `);

    this.addSql(`
      create table "notices" (
        "id" serial primary key,
        "project_id" int not null references "projects"("id") on delete cascade,
        "notice_id" text not null,
        "organizer" text null,
        "title" text null,
        "status" text not null default 'new'
          check ("status" in ('new', 'details_collected', 'rejected', 'error')),
        "details" jsonb null,
        "collected_at" timestamptz null,
        "updated_at" timestamptz not null default now()
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
        "id" serial primary key,
        "project_id" int not null references "projects"("id") on delete cascade,
        "notice_id" int null references "notices"("id") on delete set null,
        "script_name" text not null,
        "status" text not null default 'running'
          check ("status" in ('running', 'success', 'error')),
        "log" text not null default '',
        "started_at" timestamptz not null default now(),
        "finished_at" timestamptz null
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
