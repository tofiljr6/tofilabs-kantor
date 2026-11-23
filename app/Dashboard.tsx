"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Flag from "@/components/Flag";
import HoverPreview, { type Anchor } from "@/components/HoverPreview";
import { logout } from "./login/actions";
import { fmtDateTime, fmtDiff, fmtRate } from "@/lib/format";
import type { CurrentUser } from "@/lib/session";
import type { RateSide, RatesState, StoredRate } from "@/lib/types";

const fmtTime = (iso: string | null) => fmtDateTime(iso, true);
const POLL_MS = 30_000;


type Change = { dir: "up" | "down" | null; diff: number };

function changeOf(side: RateSide): Change {
  if (side.value == null || side.prev == null || side.prev === 0 || side.prev === side.value) {
    return { dir: null, diff: 0 };
  }
  const diff = side.value - side.prev;
  return { dir: diff > 0 ? "up" : "down", diff };
}

/** Kurs + zmiana (kwotowo, bez procentów). Wspólne dla tabeli i kart na telefonie. */
function RateValue({ side }: { side: RateSide }) {
  const { dir, diff } = changeOf(side);
  return (
    <>
      <div className="rate">{fmtRate(side.value)}</div>
      <div className={`delta${dir ? "" : " muted"}`}>
        {dir ? `${dir === "up" ? "▲ +" : "▼ "}${fmtDiff(diff)}` : "bez zmian"}
      </div>
    </>
  );
}

const changeTitle = (side: RateSide) =>
  changeOf(side).dir ? `Poprzednio: ${fmtRate(side.prev)} · zmiana: ${fmtTime(side.changedAt)}` : undefined;

/**
 * Najlepsze kursy dla klienta: kantor KUPUJE najdrożej (najwięcej dostaniesz za walutę)
 * i SPRZEDAJE najtaniej (najmniej zapłacisz). Tylko gdy jest z czym porównać (≥ 2 kursy).
 */
function bestOf(values: (number | null | undefined)[], pick: "max" | "min"): number | null {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return null;
  return pick === "max" ? Math.max(...v) : Math.min(...v);
}

function RateCell({ side, best }: { side: RateSide | undefined; best: boolean }) {
  if (!side || side.value == null) return <td className="cell muted">—</td>;
  const { dir } = changeOf(side);
  return (
    <td className={`cell${dir ? ` ${dir}` : ""}${best ? " best" : ""}`} title={changeTitle(side)}>
      <RateValue side={side} />
    </td>
  );
}

function RateBox({ label, side, best }: { label: string; side: RateSide | undefined; best: boolean }) {
  const dir = side ? changeOf(side).dir : null;
  return (
    <div className={`rateBox${dir ? ` ${dir}` : ""}${best ? " best" : ""}`} title={side ? changeTitle(side) : undefined}>
      <div className="rateLabel">{label}</div>
      {side && side.value != null ? <RateValue side={side} /> : <div className="rate muted">—</div>}
    </div>
  );
}

export default function Dashboard({
  initial,
  intervalMs,
  user,
}: {
  initial: RatesState;
  intervalMs: number;
  user: CurrentUser;
}) {
  const [state, setState] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState<number | null>(null); // tylko w przeglądarce
  const [preview, setPreview] = useState<Anchor | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPreview = (symbol: string, el: HTMLElement) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setPreview({ symbol, rect: el.getBoundingClientRect() }), 250);
  };
  const hidePreview = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setPreview(null);
  };

  const busy = useRef(false);
  const lastAuto = useRef(0);

  const load = useCallback(async (force: boolean) => {
    if (busy.current && !force) return;
    busy.current = true;
    if (force) setLoading(true);
    try {
      const res = await fetch("/api/rates", { method: force ? "POST" : "GET", cache: "no-store" });
      if (res.status === 401) window.location.href = "/login";
      else if (res.ok) setState(await res.json());
    } catch {
      // brak sieci — spróbujemy przy następnym cyklu
    } finally {
      busy.current = false;
      if (force) setLoading(false);
    }
  }, []);

  // Co 30 s pytamy serwer o stan (tani odczyt z bazy; serwer sam scrapuje, gdy dane mają > 5 min,
  // a nowe kursy zebrane przez harmonogram /api/cron pojawią się bez przeładowania).
  // Po powrocie na kartę — od razu, bo przeglądarki usypiają timery w tle.
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => load(false), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && load(false);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Licznik doszedł do zera → pobierz od razu (najwyżej raz na 15 s, gdyby scraping się przeciągał).
  const due = state.updatedAt != null && now != null && Date.parse(state.updatedAt) + intervalMs <= now;
  useEffect(() => {
    if (due && Date.now() - lastAuto.current > 15_000) {
      lastAuto.current = Date.now();
      load(false);
    }
  }, [due, now, load]);

  const sources = useMemo(() => Object.values(state.sources), [state]);

  // Wiersze = waluty (suma symboli ze wszystkich kantorów), kolumny = kantory
  const rows = useMemo(() => {
    const bySymbol = new Map<string, { symbol: string; name: string; perSource: Record<string, StoredRate> }>();
    for (const src of sources) {
      for (const r of src.rates) {
        const row = bySymbol.get(r.symbol) ?? { symbol: r.symbol, name: r.name, perSource: {} };
        row.perSource[src.id] = r;
        bySymbol.set(r.symbol, row);
      }
    }
    const q = query.trim().toLowerCase();
    return [...bySymbol.values()]
      .map((row) => {
        const rates = Object.values(row.perSource);
        return {
          ...row,
          bestBuy: bestOf(rates.map((r) => r.buy.value), "max"),
          bestSell: bestOf(rates.map((r) => r.sell.value), "min"),
        };
      })
      .filter((row) => !q || row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q));
  }, [sources, query]);

  const errors = sources.filter((s) => s.error);
  const nextIn = state.updatedAt && now != null ? Math.max(0, Date.parse(state.updatedAt) + intervalMs - now) : 0;
  const mm = Math.floor(nextIn / 60000);
  const ss = Math.floor((nextIn % 60000) / 1000).toString().padStart(2, "0");

  return (
    <main>
      <header>
        <div>
          <h1>Kursy walut</h1>
          <p className="muted">
            Ostatni scraping: <strong>{fmtTime(state.updatedAt)}</strong>{" "}
            {now != null && (due ? <> · pobieram nowe kursy…</> : <> · następny za {mm}:{ss}</>)}
          </p>
        </div>
        <div className="controls">
          <input
            type="search"
            placeholder="Szukaj waluty…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={() => load(true)} disabled={loading}>
            {loading ? "Pobieram…" : "Odśwież teraz"}
          </button>
          <span className="userLabel">{user.username}</span>
          {user.isAdmin && (
            <Link href="/uzytkownicy" className="navLink">Użytkownicy</Link>
          )}
          <form action={logout}>
            <button type="submit" className="secondary">Wyloguj</button>
          </form>
        </div>
      </header>

      {errors.map((s) => (
        <p key={s.id} className="error">
          {s.name}: {s.error}. Pokazuję ostatnie znane kursy.
        </p>
      ))}

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th rowSpan={2} className="stick">Waluta</th>
              {sources.map((src) => (
                <th key={src.id} colSpan={2} className="group">
                  <a href={src.url} target="_blank" rel="noreferrer">{src.name}</a>
                  <div className="muted small">{fmtTime(src.scrapedAt)}</div>
                </th>
              ))}
            </tr>
            <tr>
              {sources.map((src) => [
                <th key={`${src.id}-b`} className="num groupStart">Kupuje</th>,
                <th key={`${src.id}-s`} className="num">Sprzedaje</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol}>
                <td className="stick" title={row.name}>
                  <Link
                    href={`/waluta/${encodeURIComponent(row.symbol)}`}
                    className="currency"
                    onMouseEnter={(e) => showPreview(row.symbol, e.currentTarget)}
                    onMouseLeave={hidePreview}
                    onClick={hidePreview}
                  >
                    <Flag symbol={row.symbol} />
                    <span className="sym">{row.symbol}</span>
                  </Link>
                </td>
                {sources.map((src) => [
                  <RateCell
                    key={`${src.id}-b`}
                    side={row.perSource[src.id]?.buy}
                    best={row.bestBuy != null && row.perSource[src.id]?.buy.value === row.bestBuy}
                  />,
                  <RateCell
                    key={`${src.id}-s`}
                    side={row.perSource[src.id]?.sell}
                    best={row.bestSell != null && row.perSource[src.id]?.sell.value === row.bestSell}
                  />,
                ])}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={1 + sources.length * 2} className="muted empty">Brak danych.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Telefon: każda waluta jako osobna karta, kantory w dwóch kolumnach */}
      <div className="cards">
        {rows.map((row) => (
          <section key={row.symbol} className="currencyCard">
            <Link href={`/waluta/${encodeURIComponent(row.symbol)}`} className="currency cardTitle" title={row.name}>
              <Flag symbol={row.symbol} />
              <span className="sym">{row.symbol}</span>
            </Link>
            <div className="sourceGrid">
              {sources.map((src) => {
                const r = row.perSource[src.id];
                return (
                  <div key={src.id} className={`sourceBox${r ? "" : " missing"}`}>
                    <div className="sourceName">{src.name}</div>
                    <div className="sourceRates">
                      <RateBox label="Kupuje" side={r?.buy} best={row.bestBuy != null && r?.buy.value === row.bestBuy} />
                      <RateBox
                        label="Sprzedaje"
                        side={r?.sell}
                        best={row.bestSell != null && r?.sell.value === row.bestSell}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {rows.length === 0 && <p className="muted empty">Brak danych.</p>}
      </div>
      {preview && <HoverPreview anchor={preview} />}
      <p className="muted small foot">
        ▲ zielony — kurs wzrósł, ▼ czerwony — kurs spadł (o tyle zł względem poprzedniej różnej wartości).
        <span className="bestLegend">żółta ramka</span> — najlepszy kurs dla tej waluty: kantor kupuje najdrożej
        lub sprzedaje najtaniej.
        Najedź na walutę, aby zobaczyć wykres z 24 h (kliknij, by otworzyć szczegóły).
      </p>
    </main>
  );
}
