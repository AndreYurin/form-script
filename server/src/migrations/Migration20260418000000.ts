import { Migration } from "@mikro-orm/migrations";

export class Migration20260418000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "script_runs" drop constraint if exists "script_runs_status_check";`,
    );
    this.addSql(
      `alter table "script_runs" add constraint "script_runs_status_check" check ("status" in ('running', 'success', 'error', 'cancelled'));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `update "script_runs" set "status" = 'error' where "status" = 'cancelled';`,
    );
    this.addSql(
      `alter table "script_runs" drop constraint if exists "script_runs_status_check";`,
    );
    this.addSql(
      `alter table "script_runs" add constraint "script_runs_status_check" check ("status" in ('running', 'success', 'error'));`,
    );
  }
}
