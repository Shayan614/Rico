import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const globalForDb = globalThis as unknown as {
  sqlite: Database.Database | undefined;
};

const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), "sqlite.db");

const sqlite = globalForDb.sqlite ?? new Database(dbPath);
if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlite = sqlite;
}

// Enable WAL mode for high concurrency & better performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export * from "./schema";
