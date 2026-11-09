import { defineConfig } from "drizzle-kit";

const url = process.env.SUPABASE_DATABASE_URL;

if (!url) {
  throw new Error("SUPABASE_DATABASE_URL is missing");
}

export default defineConfig({
  schema: "./src/db/schema.pg.ts",
  out: "./drizzle/pg",
  dialect: "postgresql",
  dbCredentials: { url },
  // Keep drizzle-kit away from Supabase-managed schemas (auth, storage, ...)
  // and from any other tables in public.
  schemaFilter: ["public"],
  tablesFilter: ["users", "mandates", "transactions", "audit_logs"],
  strict: true,
  verbose: true,
});
