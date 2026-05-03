import type { EntityManager } from "@mikro-orm/libsql";

declare global {
  namespace Express {
    interface Request {
      em: EntityManager;
    }
  }
}

export {};
