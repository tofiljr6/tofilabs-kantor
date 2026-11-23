import type { PoolClient } from "pg";
import { currencyName } from "./currencies";
import { db } from "./db";
import type { Source } from "./sources";
import type { CurrencyHistory, RatesState, ScrapedRate, SourceSnapshot, StoredRate } from "./types";

const num = (v: string | null): number | null => (v == null ? null : Number(v));
const iso = (v: Date | null): string | null => (v ? v.toISOString() : null);

export async function upsertSources(client: PoolClient, sources: Source[]) {
  for (const s of sources) {
    await client.query(
      `INSERT INTO sources (id, name, url) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url`,
      [s.id, s.name, s.url],
    );
  }
}

/** Czas ostatniego uruchomienia scrapingu (udanego lub nie). */
export async function lastRunAt(): Promise<Date | null> {
  const { rows } = await db().query<{ at: Date | null }>(`SELECT max(started_at) AS at FROM scrape_runs`);
  return rows[0]?.at ?? null;
}

/** Zapisuje kursy — nowy wiersz historii tylko dla walut, których kurs się zmienił. Zwraca liczbę zmian. */
export async function saveRates(client: PoolClient, sourceId: string, rates: ScrapedRate[], at: Date): Promise<number> {
  if (rates.length === 0) return 0;
  const { rowCount } = await client.query(
    `WITH incoming AS (
       SELECT * FROM unnest($2::text[], $3::text[], $4::numeric[], $5::numeric[]) AS t(symbol, name, buy, sell)
     ),
     latest AS (
       SELECT DISTINCT ON (symbol) symbol, buy, sell
       FROM rate_history WHERE source_id = $1
       ORDER BY symbol, observed_at DESC, id DESC
     )
     INSERT INTO rate_history (source_id, symbol, name, buy, sell, observed_at)
     SELECT $1, i.symbol, i.name, i.buy, i.sell, $6
     FROM incoming i LEFT JOIN latest l USING (symbol)
     WHERE l.symbol IS NULL OR l.buy IS DISTINCT FROM i.buy OR l.sell IS DISTINCT FROM i.sell`,
    [
      sourceId,
      rates.map((r) => r.symbol),
      rates.map((r) => r.name),
      rates.map((r) => r.buy),
      rates.map((r) => r.sell),
      at,
    ],
  );
  return rowCount ?? 0;
}

export async function logRun(
  client: PoolClient,
  run: { sourceId: string; startedAt: Date; ok: boolean; error?: string; ratesCount?: number; changedCount?: number },
) {
  await client.query(
    `INSERT INTO scrape_runs (source_id, started_at, ok, error, rates_count, changed_count)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [run.sourceId, run.startedAt, run.ok, run.error ?? null, run.ratesCount ?? 0, run.changedCount ?? 0],
  );
}

type RateRow = {
  source_id: string;
  symbol: string;
  name: string;
  buy: string | null;
  sell: string | null;
  prev_buy: string | null;
  buy_changed_at: Date | null;
  prev_sell: string | null;
  sell_changed_at: Date | null;
};

/**
 * Bieżący stan: najnowszy kurs per (kantor, waluta) + poprzednia RÓŻNA wartość
 * kupna/sprzedaży i moment, od kiedy obowiązuje bieżąca wartość.
 */
export async function loadState(sources: Source[]): Promise<RatesState> {
  const pool = db();
  const [ratesRes, runsRes] = await Promise.all([
    pool.query<RateRow>(`
      WITH cur AS (
        SELECT DISTINCT ON (source_id, symbol)
               source_id, symbol, name, buy, sell,
               min(id) OVER (PARTITION BY source_id, symbol) AS first_id
        FROM rate_history
        ORDER BY source_id, symbol, observed_at DESC, id DESC
      )
      SELECT cur.source_id, cur.symbol, cur.name, cur.buy, cur.sell,
             pb.buy  AS prev_buy,  bc.at AS buy_changed_at,
             ps.sell AS prev_sell, sc.at AS sell_changed_at
      FROM cur
      LEFT JOIN LATERAL (
        SELECT h.buy, h.observed_at FROM rate_history h
        WHERE h.source_id = cur.source_id AND h.symbol = cur.symbol AND h.buy IS DISTINCT FROM cur.buy
        ORDER BY h.observed_at DESC LIMIT 1
      ) pb ON true
      LEFT JOIN LATERAL (
        SELECT min(h.observed_at) AS at FROM rate_history h
        WHERE h.source_id = cur.source_id AND h.symbol = cur.symbol AND h.observed_at > pb.observed_at
      ) bc ON pb.observed_at IS NOT NULL
      LEFT JOIN LATERAL (
        SELECT h.sell, h.observed_at FROM rate_history h
        WHERE h.source_id = cur.source_id AND h.symbol = cur.symbol AND h.sell IS DISTINCT FROM cur.sell
        ORDER BY h.observed_at DESC LIMIT 1
      ) ps ON true
      LEFT JOIN LATERAL (
        SELECT min(h.observed_at) AS at FROM rate_history h
        WHERE h.source_id = cur.source_id AND h.symbol = cur.symbol AND h.observed_at > ps.observed_at
      ) sc ON ps.observed_at IS NOT NULL
      ORDER BY cur.source_id, cur.first_id`),
    pool.query<{ source_id: string; last_at: Date; last_ok_at: Date | null; last_ok: boolean; last_error: string | null }>(`
      SELECT DISTINCT ON (source_id)
             source_id, started_at AS last_at, ok AS last_ok, error AS last_error,
             (SELECT max(started_at) FROM scrape_runs r2 WHERE r2.source_id = r.source_id AND r2.ok) AS last_ok_at
      FROM scrape_runs r
      ORDER BY source_id, started_at DESC`),
  ]);

  const runs = new Map(runsRes.rows.map((r) => [r.source_id, r]));
  const ratesBySource = new Map<string, StoredRate[]>();
  for (const r of ratesRes.rows) {
    const list = ratesBySource.get(r.source_id) ?? [];
    list.push({
      symbol: r.symbol,
      name: currencyName(r.symbol, r.name),
      buy: { value: num(r.buy), prev: num(r.prev_buy), changedAt: iso(r.buy_changed_at) },
      sell: { value: num(r.sell), prev: num(r.prev_sell), changedAt: iso(r.sell_changed_at) },
    });
    ratesBySource.set(r.source_id, list);
  }

  let updatedAt: Date | null = null;
  const snaps: Record<string, SourceSnapshot> = {};
  for (const s of sources) {
    const run = runs.get(s.id);
    if (run && (!updatedAt || run.last_at > updatedAt)) updatedAt = run.last_at;
    snaps[s.id] = {
      id: s.id,
      name: s.name,
      url: s.url,
      scrapedAt: iso(run?.last_ok_at ?? null),
      error: run && !run.last_ok ? run.last_error : null,
      rates: ratesBySource.get(s.id) ?? [],
    };
  }
  return { updatedAt: iso(updatedAt), sources: snaps };
}

/**
 * Historia kursu waluty w oknie [from, to] dla każdego kantoru; dane bierzemy do `until`
 * (zwykle "teraz", jeśli okno jeszcze trwa).
 * Dokładamy ostatni wpis sprzed okna (przycięty do początku okna), żeby linia
 * zaczynała się na lewej krawędzi wykresu — kurs obowiązywał już wtedy.
 */
export async function loadHistory(
  sources: Source[], symbol: string, from: Date, to: Date, until: Date,
): Promise<CurrencyHistory | null> {
  const { rows } = await db().query<{
    source_id: string; name: string; buy: string | null; sell: string | null; observed_at: Date;
  }>(
    `SELECT source_id, name, buy, sell, observed_at FROM (
       SELECT DISTINCT ON (source_id) source_id, name, buy, sell, $3::timestamptz AS observed_at
       FROM rate_history
       WHERE symbol = $1 AND observed_at <= $3
       ORDER BY source_id, observed_at DESC, id DESC
     ) before_window
     UNION ALL
     SELECT source_id, name, buy, sell, observed_at
     FROM rate_history
     WHERE symbol = $1 AND observed_at > $3 AND observed_at <= $2
     ORDER BY source_id, observed_at`,
    [symbol, until < from ? from : until, from],
  );
  if (rows.length === 0) return null;

  return {
    symbol,
    name: currencyName(symbol, rows[rows.length - 1].name),
    from: from.toISOString(),
    to: to.toISOString(),
    until: until.toISOString(),
    sources: sources
      .map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        points: rows
          .filter((r) => r.source_id === s.id)
          .map((r) => ({ t: r.observed_at.toISOString(), buy: num(r.buy), sell: num(r.sell) })),
      }))
      .filter((s) => s.points.length > 0),
  };
}

/**
 * Usuwa historię kursów i log scrapingu starsze niż `hours` godzin.
 * Zostawia ostatni wpis sprzed granicy dla każdej pary (kantor, waluta) — to kurs obowiązujący
 * w chwili granicy (albo bieżący, jeśli od tamtej pory się nie zmienił), więc dashboard nie traci
 * kursów, które długo stoją w miejscu, a wykresy dalej zaczynają się od lewej krawędzi.
 * Z logu zostawia ostatnie uruchomienie i ostatnie udane uruchomienie każdego kantoru.
 */
export async function deleteOlderThan(hours: number): Promise<{ cutoff: string; rates: number; runs: number }> {
  const cutoff = new Date(Date.now() - hours * 3600_000);
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const rates = await client.query(
      `DELETE FROM rate_history h
       WHERE h.observed_at < $1
         AND h.id NOT IN (
           SELECT DISTINCT ON (source_id, symbol) id
           FROM rate_history
           WHERE observed_at < $1
           ORDER BY source_id, symbol, observed_at DESC, id DESC
         )`,
      [cutoff],
    );
    const runs = await client.query(
      `DELETE FROM scrape_runs r
       WHERE r.started_at < $1
         AND r.id NOT IN (
           SELECT DISTINCT ON (source_id) id FROM scrape_runs ORDER BY source_id, started_at DESC, id DESC
         )
         AND r.id NOT IN (
           SELECT DISTINCT ON (source_id) id FROM scrape_runs WHERE ok ORDER BY source_id, started_at DESC, id DESC
         )`,
      [cutoff],
    );
    await client.query("COMMIT");
    return { cutoff: cutoff.toISOString(), rates: rates.rowCount ?? 0, runs: runs.rowCount ?? 0 };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
