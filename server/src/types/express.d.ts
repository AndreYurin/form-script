import type { EntityManager } from "@mikro-orm/better-sqlite";

declare global {
  namespace Express {
    interface Request {
      em: EntityManager;
    }
  }
}

export {};
