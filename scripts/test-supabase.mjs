
import postgres from "postgres";

const url = process.env.SUPABASE_DATABASE_URL;

if (!url) {
  throw new Error("SUPABASE_DATABASE_URL is missing");
}

const sql = postgres(url, {
  ssl: "require",
  max: 1,
  prepare: false,
  connect_timeout: 10,
});

try {
  const result = await sql`SELECT 1 AS ok`;
  console.log("Supabase connected successfully!", result[0]);
} catch (error) {
  console.error(
    "Connection failed:",
    error.code ?? error.message
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
