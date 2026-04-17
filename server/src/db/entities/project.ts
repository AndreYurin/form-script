import {
  Collection,
  Entity,
  OneToMany,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { Notice } from "./notice.js";
import { ScriptRun } from "./script-run.js";

@Entity({ tableName: "projects" })
export class Project {
  @PrimaryKey()
  id!: number;

  @Property({ type: "text" })
  name!: string;

  @Property({ type: "text", nullable: true })
  description?: string | null;

  @Property({ type: "text", fieldName: "target_url" })
  targetUrl!: string;

  @Property({ type: "text", fieldName: "cron_expression", default: "0 6 * * *" })
  cronExpression: string = "0 6 * * *";

  @Property({ type: "boolean", fieldName: "cron_enabled", default: false })
  cronEnabled: boolean = false;

  @Property({ type: "json", fieldName: "search_keywords", default: [] })
  searchKeywords: string[] = [];

  @Property({
    type: "timestamptz",
    fieldName: "created_at",
    defaultRaw: "now()",
  })
  createdAt: Date = new Date();

  @OneToMany(() => Notice, (notice) => notice.project)
  notices = new Collection<Notice>(this);

  @OneToMany(() => ScriptRun, (run) => run.project)
  scriptRuns = new Collection<ScriptRun>(this);
}
