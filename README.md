# Kursy walut — dashboard

Next.js (App Router) + PostgreSQL. Scrapuje kursy z kantorów co 5 minut (lub na żądanie)
i pokazuje je w jednej tabeli: wiersze = waluty, kolumny = kantory. Po najechaniu na walutę
widać wykres z 24 h, a po kliknięciu podstronę `/waluta/[SYMBOL]` (24 h / 7 dni / 30 dni).

## Uruchomienie lokalnie

Wymaga lokalnego PostgreSQL (np. `brew install postgresql@18 && brew services start postgresql@18`).

```bash
createdb tofilabs_kantor
cp .env.example .env.local     # DATABASE_URL=postgres://localhost:5432/tofilabs_kantor
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

Bieżący kurs = najnowszy wiersz w `rate_history` dla (kantor, waluta). Zmiana jest liczona
względem poprzedniej **różnej** wartości.

## Neon (produkcja / Vercel)

1. Załóż projekt na [neon.tech](https://neon.tech), skopiuj **pooled** connection string
   (host z `-pooler`, z `?sslmode=require`).
2. Odpal schemat na Neonie: `DATABASE_URL="postgres://…neon.tech/neondb?sslmode=require" npm run db:migrate`
3. Na Vercelu ustaw zmienną środowiskową `DATABASE_URL` na ten sam string.

Kod nie wymaga zmian — sterownik `pg` łączy się tak samo z lokalnym Postgresem i z Neonem.

## Dodanie kolejnego kantoru

1. Parser w `lib/scrapers/<kantor>.ts` zwracający `ScrapedRate[]`.
2. Wpis w `lib/sources.ts`.
3. Brakującą flagę dopisz w `lib/currencies.ts`.
