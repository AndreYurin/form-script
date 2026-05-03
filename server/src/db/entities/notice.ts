import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/core";
import { NoticeStatus } from "../enums.js";
import { Project } from "./project.js";

@Entity({ tableName: "notices" })
@Unique({
  name: "notices_project_notice_unique",
  properties: ["project", "noticeId"],
})
export class Notice {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Project, { fieldName: "project_id", deleteRule: "cascade" })
  project!: Project;

  @Property({ type: "text", fieldName: "notice_id" })
  noticeId!: string;

  @Property({ type: "text", nullable: true })
  organizer?: string | null;

  @Property({ type: "text", nullable: true })
  title?: string | null;

  @Property({ type: "text", fieldName: "search_keyword", nullable: true })
  searchKeyword?: string | null;

  @Enum({ items: () => NoticeStatus, default: NoticeStatus.New })
  @Index({ name: "notices_status_idx" })
  status: NoticeStatus = NoticeStatus.New;

  @Property({ type: "json", nullable: true })
  details?: unknown;

  @Property({ type: "datetime", fieldName: "collected_at", nullable: true })
  collectedAt?: Date | null;

  @Property({
    type: "datetime",
    fieldName: "updated_at",
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
