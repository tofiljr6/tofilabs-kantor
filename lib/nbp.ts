import "server-only";
import { canonicalSymbol, currencyName } from "./currencies";

// Kursy NBP (api.nbp.pl, bez klucza):
//  - tabela A — kurs średni, publikowana w dni robocze ok. 11:45–12:15,
//  - tabela C — kupno/sprzedaż (13 głównych walut), publikowana ok. 7:45–8:15.
// Wszystkie kursy są za 1 jednostkę waluty (jak w naszych scraperach).

export type NbpRate = {
  symbol: string;
  name: string;
  /** Kurs średni z najnowszej tabeli A. */
  mid: number;
  /** Kurs średni z poprzedniej tabeli A (do liczenia zmiany). */
  prevMid: number | null;
  /** Kupno / sprzedaż z najnowszej tabeli C (jeśli NBP ją dla tej waluty publikuje). */
  bid: number | null;
  ask: number | null;
};

export type NbpTables = {
  /** Np. "226/A/NBP/2026" i data obowiązywania "2026-11-23". */
  tableA: { no: string; date: string };
  tableC: { no: string; date: string } | null;
  rates: NbpRate[];
};

type ApiTable = {
  no: string;
  effectiveDate: string;
  rates: { code: string; currency: string; mid?: number; bid?: number; ask?: number }[];
};

const API = "https://api.nbp.pl/api/exchangerates/tables";
const TTL_OK = 30 * 60 * 1000; // NBP publikuje raz dziennie — 30 min w zupełności wystarczy
const TTL_FAIL = 60 * 1000; // po błędzie spróbuj ponownie za minutę, do tego czasu oddawaj stare dane

/** Kolejność na pasku i w tabeli: najpopularniejsze waluty najpierw, potem alfabetycznie. */
export const NBP_PRIORITY = ["EUR", "USD", "GBP", "CHF", "CZK", "NOK", "SEK", "DKK", "HUF", "CAD", "AUD", "JPY", "UAH", "TRY"];

export function prioritySort(a: string, b: string): number {
  const ia = NBP_PRIORITY.indexOf(a);
  const ib = NBP_PRIORITY.indexOf(b);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
  return a.localeCompare(b);
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store", // cache trzymamy sami (niżej), niezależnie od trybu renderowania strony
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`NBP ${res.status} (${url})`);
  return (await res.json()) as T;
}

async function fetchTables(): Promise<NbpTables> {
  const [a, c] = await Promise.all([
    getJson<ApiTable[]>(`${API}/A/last/2?format=json`),
    getJson<ApiTable[]>(`${API}/C/last/1?format=json`).catch(() => null), // tabela C jest dodatkiem
  ]);
  const latest = a[a.length - 1];
  const previous = a.length > 1 ? a[a.length - 2] : null;
  const tableC = c?.[c.length - 1] ?? null;

  const prevMid = new Map(previous?.rates.map((r) => [r.code, r.mid ?? null]) ?? []);
  const bidAsk = new Map(tableC?.rates.map((r) => [r.code, r]) ?? []);

  const rates: NbpRate[] = latest.rates
    .filter((r) => r.code !== "XDR" && r.mid != null) // SDR (MFW) — nie jest walutą gotówkową
    .map((r) => {
      const symbol = canonicalSymbol(r.code);
      const c = bidAsk.get(r.code);
      return {
        symbol,
        name: currencyName(symbol, r.currency),
        mid: r.mid!,
        prevMid: prevMid.get(r.code) ?? null,
        bid: c?.bid ?? null,
        ask: c?.ask ?? null,
      };
    })
    .sort((x, y) => prioritySort(x.symbol, y.symbol));

  return {
    tableA: { no: latest.no, date: latest.effectiveDate },
    tableC: tableC ? { no: tableC.no, date: tableC.effectiveDate } : null,
    rates,
  };
}

let cache: { data: NbpTables | null; until: number } = { data: null, until: 0 };
let inFlight: Promise<NbpTables | null> | null = null;

/** Najnowsze kursy NBP; null, jeśli API nie odpowiada i nie mamy nic z wcześniej. */
export function getNbpRates(): Promise<NbpTables | null> {
  if (Date.now() < cache.until) return Promise.resolve(cache.data);
  inFlight ??= fetchTables()
    .then((data) => {
      cache = { data, until: Date.now() + TTL_OK };
      return data;
    })
    .catch((e) => {
      console.error("NBP:", e);
      cache = { data: cache.data, until: Date.now() + TTL_FAIL };
      return cache.data;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
