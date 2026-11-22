"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Flag from "@/components/Flag";
import HoverPreview, { type Anchor } from "@/components/HoverPreview";
import { logout } from "./login/actions";
import { fmtDateTime, fmtDiff, fmtPct, fmtRate } from "@/lib/format";
import type { RateSide, RatesState, StoredRate } from "@/lib/types";

const fmtTime = (iso: string | null) => fmtDateTime(iso, true);


function RateCell({ side }: { side: RateSide | undefined }) {
  if (!side || side.value == null) return <td className="cell muted">—</td>;

  const hasChange = side.prev != null && side.prev !== 0 && side.prev !== side.value;
  if (!hasChange) {
    return (
      <td className="cell">
        <div className="rate">{fmtRate(side.value)}</div>
        <div className="delta muted">bez zmian</div>
      </td>
    );
  }

  const diff = side.value - side.prev!;
  const pct = (diff / side.prev!) * 100;
  const dir = diff > 0 ? "up" : "down";
  const sign = diff > 0 ? "+" : "";
  return (
    <td
      className={`cell ${dir}`}
      title={`Poprzednio: ${fmtRate(side.prev)} · zmiana: ${fmtTime(side.changedAt)}`}
    >
      <div className="rate">
        {dir === "up" ? "▲" : "▼"} {fmtRate(side.value)}
      </div>
      <div className="delta">
        {sign}
        {fmtDiff(diff)} ({sign}
        {fmtPct(pct)}%)
      </div>
    </td>
  );
}

export default function Dashboard({ initial, intervalMs }: { initial: RatesState; intervalMs: number }) {
  const [state, setState] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);
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

  const load = useCallback(async (force: boolean) => {
    setLoading(true);
    try {
      const res = await fetch("/api/rates", { method: force ? "POST" : "GET", cache: "no-store" });
      if (res.ok) setState(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-odświeżanie co interwał + zegar do odliczania
  useEffect(() => {
    const auto = setInterval(() => load(false), intervalMs);
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(auto);
      clearInterval(tick);
    };
  }, [load, intervalMs]);

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
      .filter((row) => !q || row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q))
      .filter(
        (row) =>
          !onlyChanged ||
          Object.values(row.perSource).some((r) => r.buy.prev != null || r.sell.prev != null),
      );
  }, [sources, query, onlyChanged]);

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
            Ostatni scraping: <strong>{fmtTime(state.updatedAt)}</strong> {now != null && <> · następny za {mm}:{ss}</>}
          </p>
        </div>
        <div className="controls">
          <input
            type="search"
            placeholder="Szukaj waluty…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="check">
            <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />
            Tylko ze zmianą
          </label>
          <button onClick={() => load(true)} disabled={loading}>
            {loading ? "Pobieram…" : "Odśwież teraz"}
          </button>
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
                <td className="stick">
                  <Link
                    href={`/waluta/${encodeURIComponent(row.symbol)}`}
                    className="currency"
                    onMouseEnter={(e) => showPreview(row.symbol, e.currentTarget)}
                    onMouseLeave={hidePreview}
                    onClick={hidePreview}
                  >
                    <Flag symbol={row.symbol} />
                    <span>
                      <span className="sym">{row.symbol}</span>
                      <span className="muted small currencyName">{row.name}</span>
                    </span>
                  </Link>
                </td>
                {sources.map((src) => [
                  <RateCell key={`${src.id}-b`} side={row.perSource[src.id]?.buy} />,
                  <RateCell key={`${src.id}-s`} side={row.perSource[src.id]?.sell} />,
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
      {preview && <HoverPreview anchor={preview} />}
      <p className="muted small foot">
        ▲ zielony — kurs wzrósł, ▼ czerwony — kurs spadł (względem poprzedniej różnej wartości). Najedź na
        walutę, aby zobaczyć wykres z 24 h (kliknij, by otworzyć szczegóły).
      </p>
    </main>
  );
}
