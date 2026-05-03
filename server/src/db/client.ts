import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { MikroORM } from "@mikro-orm/libsql";
import type { EntityManager } from "@mikro-orm/libsql";
import config from "../mikro-orm.config.js";

let ormInstance: MikroORM | null = null;

export async function initOrm(): Promise<MikroORM> {
  if (ormInstance) return ormInstance;
  const dbDir = path.dirname(config.dbName as string);
  fs.mkdirSync(dbDir, { recursive: true });
  ormInstance = await MikroORM.init(config);
  return ormInstance;
}

export function getOrm(): MikroORM {
  if (!ormInstance) {
    throw new Error("ORM not initialized. Call initOrm() first.");
  }
  return ormInstance;
}

export function getEm(): EntityManager {
  return getOrm().em as EntityManager;
}

export async function closeOrm(): Promise<void> {
  if (ormInstance) {
    await ormInstance.close(true);
    ormInstance = null;
  }
}
