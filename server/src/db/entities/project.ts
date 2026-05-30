import {
  Collection,
  Entity,
  OneToMany,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { Notice } from "./notice.js";
import { ScriptRun } from "./script-run.js";

export interface SearchConfig {
  id: string;
  name: string;
  searchKeywords: string[];
  organizerFilters: string[];
  /** Minimum amount filter ("Сумма закупки с"). null means no filter. */
  amountFrom?: number | null;
}

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

  @Property({ type: "json", fieldName: "search_configs" })
  searchConfigs: SearchConfig[] = [];

  @Property({ type: "datetime", fieldName: "created_at" })
  createdAt: Date = new Date();

  @OneToMany(() => Notice, (notice) => notice.project)
  notices = new Collection<Notice>(this);

  @OneToMany(() => ScriptRun, (run) => run.project)
  scriptRuns = new Collection<ScriptRun>(this);
}
