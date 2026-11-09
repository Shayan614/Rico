import path from "path";
import type postgresType from "postgres";
import type { drizzle as drizzleType } from "drizzle-orm/postgres-js";
import * as schema from "./schema.pg";

// "postgres" is ESM-only, and webpack would make this whole module async, leaving src/db/index.ts
// with no connection. Node's own require loads it synchronously (Node 22.12 or newer). Webpack
// rewrites a plain createRequire import, so it is fetched through process.getBuiltinModule.
const { createRequire } = (
  process as unknown as { getBuiltinModule(id: "module"): typeof import("module") }
).getBuiltinModule("module");
const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));
const postgres = (nodeRequire("postgres") as { default: typeof postgresType }).default;
const { drizzle } = nodeRequire("drizzle-orm/postgres-js") as { drizzle: typeof drizzleType };

if (typeof window !== "undefined") {
  throw new Error("src/db/postgres.ts must only be imported on the server");
}

const url = process.env.SUPABASE_DATABASE_URL;

if (!url) {
  throw new Error("SUPABASE_DATABASE_URL is missing");
}

// Only a local throwaway server may skip TLS.
const isLocal = ["localhost", "127.0.0.1"].includes(new URL(url).hostname);

// Reuse one pool across Next.js dev hot reloads, as src/db/index.ts does for SQLite.
const globalForDb = globalThis as unknown as {
  postgresClient: postgresType.Sql | undefined;
};

export const postgresClient =
  globalForDb.postgresClient ??
  postgres(url, {
    ssl: isLocal ? false : "require",
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    max: 5,
    connect_timeout: 10,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresClient = postgresClient;
}

export const pgDb = drizzle(postgresClient, { schema });
export * from "./schema.pg";
