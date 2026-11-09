import path from "path";
import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as sqliteSchema from "./schema";
import * as pgSchema from "./schema.pg";

export type { ReceiptData } from "./schema";
export type {
  UserRecord,
  NewUserRecord,
  MandateRecord,
  NewMandateRecord,
  TransactionRecord,
  NewTransactionRecord,
  AuditLogRecord,
  NewAuditLogRecord,
} from "./schema";

export type DatabaseProvider = "sqlite" | "postgres";

/** SQLite unless PostgreSQL is explicitly chosen. A bad value stops startup instead of guessing. */
function resolveProvider(): DatabaseProvider {
  const value = (process.env.DATABASE_PROVIDER || "sqlite").trim().toLowerCase();
  if (value !== "sqlite" && value !== "postgres") {
    throw new Error('DATABASE_PROVIDER must be "sqlite" or "postgres"');
  }
  return value;
}

export const dbProvider: DatabaseProvider = resolveProvider();
const usePostgres = dbProvider === "postgres";

type AppDb = BetterSQLite3Database<typeof sqliteSchema>;

function openSqlite(): AppDb {
  // Loaded only here, so PostgreSQL mode never opens or creates a SQLite file.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const BetterSqlite = require("better-sqlite3") as typeof Database;
  const { drizzle } = require("drizzle-orm/better-sqlite3") as typeof import("drizzle-orm/better-sqlite3");
  /* eslint-enable @typescript-eslint/no-require-imports */

  const globalForDb = globalThis as unknown as { sqlite: Database.Database | undefined };
  const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), "sqlite.db");
  const sqlite = globalForDb.sqlite ?? new BetterSqlite(dbPath);
  if (process.env.NODE_ENV !== "production") {
    globalForDb.sqlite = sqlite;
  }

  // Enable WAL mode for high concurrency & better performance
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return drizzle(sqlite, { schema: sqliteSchema });
}

function openPostgres(): AppDb {
  // A missing URL throws here. PostgreSQL mode never falls back to SQLite.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { pgDb } = require("./postgres") as typeof import("./postgres");
  if (!pgDb) throw new Error("The PostgreSQL connection could not be loaded");
  return pgDb as unknown as AppDb;
}

/**
 * Typed as SQLite so existing callers compile unchanged. In PostgreSQL mode only awaited queries
 * work: .run(), .get(), .all() and synchronous transactions do not exist there, and
 * postgres-runtime.test.ts fails if production code uses them.
 */
export const db: AppDb = usePostgres ? openPostgres() : openSqlite();

const pick = <T>(sqliteTable: T, pgTable: unknown): T =>
  usePostgres ? (pgTable as T) : sqliteTable;

export const users = pick(sqliteSchema.users, pgSchema.users);
export const mandates = pick(sqliteSchema.mandates, pgSchema.mandates);
export const transactions = pick(sqliteSchema.transactions, pgSchema.transactions);
export const auditLogs = pick(sqliteSchema.auditLogs, pgSchema.auditLogs);
