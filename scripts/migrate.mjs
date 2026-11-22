// Uruchamia db/schema.sql na bazie z DATABASE_URL (czyta .env.local / .env).
import { readFile } from "node:fs/promises";
import pg from "pg";

for (const f of [".env.local", ".env"]) {
  try { process.loadEnvFile(f); } catch {}
}
const url = process.env.DATABASE_URL;
if (!url) {
  // --if-configured: używane w buildzie — bez bazy po prostu pomijamy migrację
  if (process.argv.includes("--if-configured")) {
    console.log("DATABASE_URL nie ustawione — pomijam migrację.");
    process.exit(0);
  }
  console.error("Brak DATABASE_URL (ustaw w .env.local)");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
await client.end();
console.log("Schemat zastosowany ✔");
