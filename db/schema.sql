-- Schemat bazy kursów walut. Idempotentny: można odpalać wielokrotnie (npm run db:migrate).

-- Kantory (źródła scrapingu)
CREATE TABLE IF NOT EXISTS sources (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  url         text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Każde uruchomienie scrapingu (także nieudane) — log + "kiedy ostatnio sprawdzaliśmy"
CREATE TABLE IF NOT EXISTS scrape_runs (
  id          bigserial PRIMARY KEY,
  source_id   text NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  started_at  timestamptz NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT now(),
  ok          boolean NOT NULL,
  error       text,
  rates_count integer NOT NULL DEFAULT 0,
  changed_count integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS scrape_runs_source_time_idx ON scrape_runs (source_id, started_at DESC);

-- Historia kursów: nowy wiersz tylko wtedy, gdy kurs kupna lub sprzedaży się zmienił.
-- Bieżący kurs = najnowszy wiersz dla (source_id, symbol).
CREATE TABLE IF NOT EXISTS rate_history (
  id          bigserial PRIMARY KEY,
  source_id   text NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  symbol      text NOT NULL,
  name        text NOT NULL,
  buy         numeric(18, 6),
  sell        numeric(18, 6),
  observed_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_history_lookup_idx ON rate_history (source_id, symbol, observed_at DESC);
