import { db } from "./db";
import { HOME_SOURCE_ID } from "./home";
import { lastRunAt, lastSymbols, loadState, logRun, saveRates, upsertSources } from "./repo";
import { SOURCES, type Source } from "./sources";
import type { RatesState, ScrapedRate } from "./types";

export const SCRAPE_INTERVAL_MS = 5 * 60 * 1000;
// Stały klucz blokady — chroni przed równoległym scrapingiem z kilku instancji (Vercel).
const LOCK_KEY = 482_917_001;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; tofilabs-kantor/0.1)" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchSource(src: Source, pages: Map<string, Promise<string>>): Promise<ScrapedRate[]> {
  // ten sam URL dla kilku źródeł → jedno pobranie
  if (!pages.has(src.url)) pages.set(src.url, fetchHtml(src.url));
  const rates = src.parse(await pages.get(src.url)!);
  if (rates.length === 0) throw new Error("Nie znaleziono tabeli kursów (zmieniła się struktura strony?)");
  return rates;
}

/**
 * Interesują nas tylko waluty, które prowadzi Dorex — kursy pozostałych walut z innych kantorów
 * w ogóle nie trafiają do bazy. Zbiór walut bierzemy z bieżącego scrapingu Dorexu, a gdy ten się
 * nie udał — z ostatnich kursów Dorexu w bazie. Nie znamy żadnych (pusta baza) → zapisujemy wszystko.
 */
function onlyHomeCurrencies(rates: ScrapedRate[], home: Set<string>): ScrapedRate[] {
  return home.size === 0 ? rates : rates.filter((r) => home.has(r.symbol));
}

let inFlight: Promise<RatesState> | null = null;

export function scrapeAll(): Promise<RatesState> {
  inFlight ??= (async () => {
    try {
      const startedAt = new Date();
      // Pobieranie stron poza transakcją, żeby nie trzymać połączenia z bazą.
      const pages = new Map<string, Promise<string>>();
      const results = await Promise.allSettled(SOURCES.map((s) => fetchSource(s, pages)));

      const client = await db().connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query<{ locked: boolean }>(
          "SELECT pg_try_advisory_xact_lock($1) AS locked",
          [LOCK_KEY],
        );
        if (rows[0].locked) {
          await upsertSources(client, SOURCES);
          const homeResult = results[SOURCES.findIndex((s) => s.id === HOME_SOURCE_ID)];
          const homeSymbols = new Set(
            homeResult?.status === "fulfilled"
              ? homeResult.value.map((r) => r.symbol)
              : await lastSymbols(client, HOME_SOURCE_ID),
          );
          for (const [i, src] of SOURCES.entries()) {
            const r = results[i];
            if (r.status === "fulfilled") {
              const rates = src.id === HOME_SOURCE_ID ? r.value : onlyHomeCurrencies(r.value, homeSymbols);
              const changed = await saveRates(client, src.id, rates, startedAt);
              await logRun(client, { sourceId: src.id, startedAt, ok: true, ratesCount: rates.length, changedCount: changed });
            } else {
              const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
              await logRun(client, { sourceId: src.id, startedAt, ok: false, error: msg });
            }
          }
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
      return loadState(SOURCES);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Zwraca stan z bazy; jeśli ostatni scraping był ponad 5 min temu, najpierw scrapuje. */
export async function getRates(): Promise<RatesState> {
  const last = await lastRunAt();
  const age = last ? Date.now() - last.getTime() : Infinity;
  return age >= SCRAPE_INTERVAL_MS ? scrapeAll() : loadState(SOURCES);
}
