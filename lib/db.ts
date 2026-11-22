import { Pool } from "pg";

// Jeden pool na proces (w dev przetrwa hot-reload dzięki globalThis).
const g = globalThis as unknown as { __pgPool?: Pool };

export function db(): Pool {
  if (!g.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("Brak DATABASE_URL — ustaw w .env.local (zob. .env.example)");
    g.__pgPool = new Pool({
      connectionString,
      // Serverless (Vercel) → mało połączeń na instancję; Neon "pooled" URL robi resztę.
      max: process.env.VERCEL ? 3 : 10,
    });
  }
  return g.__pgPool;
}
