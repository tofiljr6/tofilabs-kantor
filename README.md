# Kursy walut — dashboard

Next.js (App Router) + PostgreSQL. Scrapuje kursy z kantorów co 5 minut (lub na żądanie)
i pokazuje je w jednej tabeli: wiersze = waluty, kolumny = kantory. Po najechaniu na walutę
widać wykres z 24 h, a po kliknięciu podstronę `/waluta/[SYMBOL]` (24 h / 7 dni / 30 dni).

## Uruchomienie lokalnie

Wymaga lokalnego PostgreSQL (np. `brew install postgresql@18 && brew services start postgresql@18`).

```bash
createdb tofilabs_kantor
cp .env.example .env.local     # uzupełnij DATABASE_URL, AUTH_* i CRON_SECRET
npm install
npm run db:migrate             # tworzy tabele (db/schema.sql, idempotentne)
npm run dev                    # http://localhost:3000
```

## Baza danych

| Tabela | Co trzyma |
|---|---|
| `sources` | kantory (id, nazwa, URL) — synchronizowane z `lib/sources.ts` przy scrapingu |
| `rate_history` | historia kursów; **nowy wiersz tylko przy zmianie** kupna lub sprzedaży |
| `scrape_runs` | log każdego scrapingu (czas, sukces/błąd, ile kursów, ile zmian) |
| `users` | konta dodane przez administratora (login, hash hasła scrypt, kto i kiedy dodał) |

Bieżący kurs = najnowszy wiersz w `rate_history` dla (kantor, waluta). Zmiana jest liczona
względem poprzedniej **różnej** wartości.

## Logowanie i użytkownicy

Cała aplikacja (strony i API) jest za logowaniem — `middleware.ts` przepuszcza tylko `/login`
i `/api/cron` (ten ma własny sekret).

- **Administrator** — konto z `AUTH_USERNAME` / `AUTH_PASSWORD` (zmienne środowiskowe).
  Widzi link **Użytkownicy** (`/uzytkownicy`): dodaje konta, zmienia im hasła, usuwa je.
- **Użytkownicy** — dodawani przez administratora, trzymani w tabeli `users` (hasło jako hash scrypt).
  Widzą kursy, nie mają dostępu do zarządzania kontami.

Sesja to podpisane (`AUTH_SECRET`, min. 32 znaki) ciasteczko `httpOnly` ważne 30 dni, z odciskiem
hasła: zmiana hasła albo usunięcie konta od razu wylogowuje tę osobę (każda strona i API sprawdza
konto w bazie — `lib/session.ts`). Bez zmiennych `AUTH_*` nikt się nie zaloguje.

## Wdrożenie na Vercel + Neon

1. **Neon** — załóż projekt na [neon.tech](https://neon.tech) w regionie **Frankfurt (eu-central-1)**
   i skopiuj connection string **pooled** (host z `-pooler`, z `?sslmode=require`).
   Można też dodać Neon z Vercel Marketplace — wtedy `DATABASE_URL` ustawi się sam.
2. **Vercel** — *Add New → Project*, zaimportuj repo z GitHuba (framework: Next.js, bez zmian w ustawieniach).
3. **Zmienne środowiskowe** (Project → Settings → Environment Variables):

   | Zmienna | Wartość |
   |---|---|
   | `DATABASE_URL` | pooled connection string z Neona |
   | `AUTH_USERNAME` | login do dashboardu |
   | `AUTH_PASSWORD` | hasło (długie!) |
   | `AUTH_SECRET` | `openssl rand -hex 32` |
   | `CRON_SECRET` | `openssl rand -hex 24` |

4. **Deploy.** Build sam tworzy tabele w bazie (`npm run build` = migracja + `next build`;
   schemat jest idempotentny). Funkcje działają we Frankfurcie (`vercel.json` → `fra1`), obok bazy.

### Scraping co 5 minut

Dashboard sam pobiera kursy, gdy ktoś go ogląda, a dane mają > 5 min. Żeby historia zbierała się
też bez oglądających, `/api/cron` musi być wołany co 5 minut:

- **Plan Hobby (darmowy)** — Vercel Cron działa tam maks. raz dziennie, więc używamy GitHub Actions
  (`.github/workflows/scrape.yml`). W repo dodaj sekrety *Settings → Secrets and variables → Actions*:
  `APP_URL` (np. `https://tofilabs-kantor.vercel.app`) i `CRON_SECRET` (ta sama wartość co na Vercelu).
  GitHub potrafi opóźniać takie zadania o kilka minut.
- **Plan Pro** — można zamiast tego dodać do `vercel.json`:
  `"crons": [{ "path": "/api/cron", "schedule": "*/5 * * * *" }]` (Vercel sam wyśle `CRON_SECRET`).

Sprawdzenie ręczne: `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron`.

## Źródła (Wrocław)

| Kolumna | Strona | Jak scrapujemy |
|---|---|---|
| Kantor CENT | centkantor.pl/kursy-walut | tabela `#ex_table` |
| Kantor KURS — detal / hurt | kantorkurs.pl/wroclaw | dwie tabele po nagłówkach „Ceny detaliczne” / „Ceny hurtowe” (jedno pobranie) |
| Kantor Sprawa | kantorsprawa.pl/wroclaw | payload Next.js (`self.__next_f`), lista `currencies` oddziału `wroclaw` — kursy „W kantorze” |
| Kantor Central | kantorcentral.pl/wroclaw | `table.currency-table` |
| Kantor Gant — Oławska 5 | kantorygant.pl/kantor/Wroclaw/Olawska-5 | `table.currency-table-full` |
| Kantor PLEX — detal / hurt | kantorplex.pl/wroclaw-kurs-detal, kantorplex.pl | wiersze tabel: kod waluty + 2 liczby (parser ogólny) |
| Kantor Tukan | kantortukan.pl | `#desk-table tr[data-waluta]` (ceny hurtowe od 1 000 zł) |

Różne kody tej samej waluty (np. `TRL`→`TRY`, `EURB`→`EUB`, `NEW`→`USN`, `1US`/`USDJ`→`US1`)
są ujednolicane w `lib/currencies.ts`, żeby trafiały do jednego wiersza.

## Dodanie kolejnego kantoru

1. Parser w `lib/scrapers/<kantor>.ts` zwracający `ScrapedRate[]`.
2. Wpis w `lib/sources.ts`.
3. Brakującą flagę dopisz w `lib/currencies.ts`.
