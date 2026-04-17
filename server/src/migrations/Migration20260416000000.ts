import { Migration } from "@mikro-orm/migrations";

export class Migration20260416000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "projects" add column "search_keywords" jsonb not null default '[]';`,
    );
    this.addSql(
      `alter table "notices" add column "search_keyword" text null;`,
    );
    this.addSql(
      `alter table "script_runs" add column "screenshot_path" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "projects" drop column "search_keywords";`);
    this.addSql(`alter table "notices" drop column "search_keyword";`);
    this.addSql(`alter table "script_runs" drop column "screenshot_path";`);
  }
}
