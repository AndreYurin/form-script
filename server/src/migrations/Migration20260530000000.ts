import { Migration } from "@mikro-orm/migrations";

/**
 * Replace flat `search_keywords` array on projects with a richer
 * `search_configs` shape. Each config groups search keywords with their own
 * organizer-filter substrings and can be run independently.
 *
 * Shape:
 *   [{ id: string, name: string, searchKeywords: string[], organizerFilters: string[] }]
 *
 * If any existing rows have non-empty `search_keywords`, we wrap them in a
 * single default config with no organizer filters (matches the previous
 * "always match" behaviour for those keywords).
 */
export class Migration20260530000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "projects" add column "search_configs" text not null default '[]';`,
    );

    const rows = (await this.execute(
      `select "id", "search_keywords" from "projects";`,
    )) as Array<{ id: number; search_keywords: string }>;

    for (const row of rows) {
      let kws: string[] = [];
      try {
        const parsed = JSON.parse(row.search_keywords || "[]");
        if (Array.isArray(parsed)) kws = parsed.filter((k) => typeof k === "string");
      } catch {
        kws = [];
      }
      if (kws.length === 0) continue;

      const cfg = [
        {
          id: `cfg-${row.id}-legacy`,
          name: "Default",
          searchKeywords: kws,
          organizerFilters: [],
        },
      ];
      this.addSql(
        this.getKnex()
          .table("projects")
          .where({ id: row.id })
          .update({ search_configs: JSON.stringify(cfg) }),
      );
    }

    this.addSql(`alter table "projects" drop column "search_keywords";`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "projects" add column "search_keywords" text not null default '[]';`,
    );
    this.addSql(`alter table "projects" drop column "search_configs";`);
  }
}
