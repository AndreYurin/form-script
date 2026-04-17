import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { ScriptRunStatus } from "../enums.js";
import { Notice } from "./notice.js";
import { Project } from "./project.js";

@Entity({ tableName: "script_runs" })
@Index({
  name: "script_runs_project_script_idx",
  properties: ["project", "scriptName"],
})
export class ScriptRun {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Project, { fieldName: "project_id", deleteRule: "cascade" })
  project!: Project;

  @ManyToOne(() => Notice, {
    fieldName: "notice_id",
    nullable: true,
    deleteRule: "set null",
  })
  notice?: Notice | null;

  @Property({ type: "text", fieldName: "script_name" })
  scriptName!: string;

  @Enum({ items: () => ScriptRunStatus, default: ScriptRunStatus.Running })
  status: ScriptRunStatus = ScriptRunStatus.Running;

  @Property({ type: "text", default: "" })
  log: string = "";

  @Property({ type: "text", fieldName: "screenshot_path", nullable: true })
  screenshotPath?: string | null;

  @Property({
    type: "timestamptz",
    fieldName: "started_at",
    defaultRaw: "now()",
  })
  startedAt: Date = new Date();

  @Property({
    type: "timestamptz",
    fieldName: "finished_at",
    nullable: true,
  })
  finishedAt?: Date | null;
}
