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

-- 2026-11: ujednolicenie symboli walut między kantorami (lib/currencies.ts → canonicalSymbol).
-- Idempotentne: po pierwszym uruchomieniu nic już nie pasuje.
UPDATE rate_history SET symbol = 'TRY' WHERE symbol = 'TRL';
UPDATE rate_history SET symbol = 'RON' WHERE symbol = 'ROL';
UPDATE rate_history SET symbol = 'AZN' WHERE symbol = 'AZM';
UPDATE rate_history SET symbol = 'BYN' WHERE symbol = 'BYB';
UPDATE rate_history SET symbol = upper(symbol) WHERE symbol <> upper(symbol);

-- Użytkownicy dodawani przez administratora (konto z AUTH_USERNAME / AUTH_PASSWORD).
-- Hasło: scrypt, format "scrypt$N$r$p$salt$hash" (base64url).
CREATE TABLE IF NOT EXISTS users (
  id            bigserial PRIMARY KEY,
  username      text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));
