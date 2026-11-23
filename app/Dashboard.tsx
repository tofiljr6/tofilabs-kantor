"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Flag from "@/components/Flag";
import HoverPreview, { type Anchor } from "@/components/HoverPreview";
import { logout } from "./login/actions";
import { fmtDateTime, fmtDiff, fmtRate } from "@/lib/format";
import { HOME_SOURCE_ID } from "@/lib/home";
import type { CurrentUser } from "@/lib/session";
import type { RateSide, RatesState, StoredRate } from "@/lib/types";

const fmtTime = (iso: string | null) => fmtDateTime(iso, true);
const POLL_MS = 30_000;


type ChangeWindow = "last" | "5" | "10" | "15" | "30" | "60" | "all";
const WINDOW_OPTIONS: { value: ChangeWindow; label: string }[] = [
  { value: "last", label: "od ostatniej aktualizacji" },
  { value: "5", label: "ostatnie 5 min" },
  { value: "10", label: "ostatnie 10 min" },
  { value: "15", label: "ostatnie 15 min" },
  { value: "30", label: "ostatnie 30 min" },
  { value: "60", label: "ostatnia 1 godzina" },
  { value: "all", label: "bez limitu" },
];
type Options = { changeWindow: ChangeWindow; showBeat: boolean };
const DEFAULT_OPTIONS: Options = { changeWindow: "last", showBeat: true };
const OPTIONS_KEY = "kantor.options.v2";

function loadOptions(): Options {
  try {
    const raw = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? "null");
    if (raw && typeof raw === "object") {
      return {
        changeWindow: WINDOW_OPTIONS.some((o) => o.value === raw.changeWindow) ? raw.changeWindow : DEFAULT_OPTIONS.changeWindow,
        showBeat: typeof raw.showBeat === "boolean" ? raw.showBeat : DEFAULT_OPTIONS.showBeat,
      };
    }
  } catch {
    // brak dostępu do localStorage — zostają domyślne
  }
  return DEFAULT_OPTIONS;
}

/** Czy zmiana z `changedAt` mieści się w wybranym oknie czasu. */
function isFresh(changedAt: string | null, win: ChangeWindow, scrapedAt: string | null, now: number | null): boolean {
  if (win === "all") return true;
  if (!changedAt) return false;
  const at = Date.parse(changedAt);
  // Kursy z jednego scrapingu mają observed_at = początek scrapingu = scrapedAt kantoru.
  if (win === "last") return scrapedAt != null && at >= Date.parse(scrapedAt);
  if (now == null) return false;
  return now - at <= Number(win) * 60_000;
}

type Change = { dir: "up" | "down" | null; diff: number };

function changeOf(side: RateSide): Change {
  if (side.value == null || side.prev == null || side.prev === 0 || side.prev === side.value) {
    return { dir: null, diff: 0 };
  }
  const diff = side.value - side.prev;
  return { dir: diff > 0 ? "up" : "down", diff };
}

/** Zmiana do pokolorowania — tylko gdy mieści się w wybranym oknie czasu. */
const shownDir = (side: RateSide, fresh: boolean) => (fresh ? changeOf(side).dir : null);

/** Kurs + zmiana (kwotowo, bez procentów). Wspólne dla tabeli i kart na telefonie. */
function RateValue({ side, fresh }: { side: RateSide; fresh: boolean }) {
  const { dir, diff } = changeOf(side);
  // Starsza zmiana: bez koloru, wyszarzona (szczegóły w dymku).
  return (
    <>
      <div className="rate">{fmtRate(side.value)}</div>
      <div className={`delta${dir && fresh ? "" : " muted"}`}>
        {dir ? `${dir === "up" ? "▲ +" : "▼ "}${fmtDiff(diff)}` : "–"}
      </div>
    </>
  );
}

const changeTitle = (side: RateSide) =>
  changeOf(side).dir ? `Poprzednio: ${fmtRate(side.prev)} · zmiana: ${fmtTime(side.changedAt)}` : undefined;

/**
 * Porównanie z naszym kantorem (HOME_SOURCE_ID): zielona ramka, gdy konkurencja KUPUJE taniej
 * niż my, czerwona, gdy SPRZEDAJE drożej. Nasza kolumna nie dostaje ramek.
 */
type Beat = "beatBuy" | "beatSell" | null;

function beatOf(src: string, kind: "buy" | "sell", r: StoredRate | undefined, home: StoredRate | undefined): Beat {
  if (src === HOME_SOURCE_ID || !r || !home) return null;
  const mine = home[kind].value;
  const theirs = r[kind].value;
  if (mine == null || theirs == null) return null;
  if (kind === "buy") return theirs < mine ? "beatBuy" : null;
  return theirs > mine ? "beatSell" : null;
}

const beatTitle = (beat: Beat, home: StoredRate | undefined) =>
  beat === "beatBuy"
    ? `Kupuje taniej niż Dorex (${fmtRate(home?.buy.value)})`
    : beat === "beatSell"
      ? `Sprzedaje drożej niż Dorex (${fmtRate(home?.sell.value)})`
      : undefined;

const joinTitle = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ") || undefined;

type CellProps = { side: RateSide | undefined; fresh: boolean; beat: Beat; beatInfo?: string };

function RateCell({ side, fresh, beat, beatInfo }: CellProps) {
  if (!side || side.value == null) return <td className="cell muted">—</td>;
  const dir = shownDir(side, fresh);
  return (
    <td className={`cell${dir ? ` ${dir}` : ""}${beat ? ` ${beat}` : ""}`} title={joinTitle(beatInfo, changeTitle(side))}>
      <RateValue side={side} fresh={fresh} />
    </td>
  );
}

function RateBox({ label, side, fresh, beat, beatInfo }: CellProps & { label: string }) {
  const dir = side ? shownDir(side, fresh) : null;
  return (
    <div
      className={`rateBox${dir ? ` ${dir}` : ""}${beat ? ` ${beat}` : ""}`}
      title={joinTitle(beatInfo, side ? changeTitle(side) : undefined)}
    >
      <div className="rateLabel">{label}</div>
      {side && side.value != null ? <RateValue side={side} fresh={fresh} /> : <div className="rate muted">—</div>}
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
  const [now, setNow] = useState<number | null>(null); // tylko w przeglądarce
  const [preview, setPreview] = useState<Anchor | null>(null);
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Numer kolumny (1-based, jak w :nth-child) pod kursorem — podświetlamy całą kolumnę.
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const trackColumn = (e: React.MouseEvent<HTMLTableElement>) => {
    const cell = (e.target as HTMLElement).closest("td");
    const col = cell && cell.cellIndex > 0 && cell.colSpan === 1 ? cell.cellIndex + 1 : null;
    setHoverCol((prev) => (prev === col ? prev : col));
  };

  useEffect(() => setOptions(loadOptions()), []);
  const updateOptions = (patch: Partial<Options>) =>
    setOptions((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(OPTIONS_KEY, JSON.stringify(next));
      } catch {
        // nie zapisze się między wizytami — trudno
      }
      return next;
    });

  // Zamknij panel opcji / menu po kliknięciu poza nimi.
  useEffect(() => {
    if (!optionsOpen && !menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (optionsRef.current && !optionsRef.current.contains(t)) setOptionsOpen(false);
      if (menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [optionsOpen, menuOpen]);

  // Ramki porównania z Dorexem — wyłączane w opcjach.
  const beatFor = (src: string, kind: "buy" | "sell", r: StoredRate | undefined, home: StoredRate | undefined) =>
    options.showBeat ? beatOf(src, kind, r, home) : null;
  const freshFor = (side: RateSide | undefined, scrapedAt: string | null) =>
    isFresh(side?.changedAt ?? null, options.changeWindow, scrapedAt, now);
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
    return [...bySymbol.values()];
  }, [sources]);

  const errors = sources.filter((s) => s.error);
  // Kantor aktualny = bez błędu i dane nie starsze niż 2 cykle scrapingu.
  const statusOf = (src: (typeof sources)[number]) => {
    const ok =
      !src.error && src.scrapedAt != null && now != null && now - Date.parse(src.scrapedAt) <= 2 * intervalMs;
    const info = `Ostatnia aktualizacja: ${fmtTime(src.scrapedAt)}${src.error ? ` · błąd: ${src.error}` : ""}`;
    return { ok, info };
  };
  const statusDot = (src: (typeof sources)[number]) => {
    if (now == null) return null; // status liczony dopiero w przeglądarce
    const { ok, info } = statusOf(src);
    return <span className={`statusDot ${ok ? "ok" : "stale"}`} title={info} aria-label={info} role="img" />;
  };

  return (
    <main>
      <header className="topBar">
        <div className="titleBlock">
          <h1>Kursy walut</h1>
          <p className="muted">
            Ostatnia aktualizacja: <strong>{fmtTime(state.updatedAt)}</strong>
          </p>
        </div>
        <div className="controls">
          <div className="optionsWrap" ref={optionsRef}>
            <button className="secondary" onClick={() => setOptionsOpen((o) => !o)} aria-expanded={optionsOpen}>
              Opcje
            </button>
            {optionsOpen && (
              <div className="optionsPanel">
                <label>
                  <span>Pokazuj zmiany kursu</span>
                  <select
                    value={options.changeWindow}
                    onChange={(e) => updateOptions({ changeWindow: e.target.value as ChangeWindow })}
                  >
                    {WINDOW_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={options.showBeat}
                    onChange={(e) => updateOptions({ showBeat: e.target.checked })}
                  />
                  <span>Ramki porównania z Dorexem (zielona / czerwona)</span>
                </label>
              </div>
            )}
          </div>
          <button onClick={() => load(true)} disabled={loading}>
            {loading ? "Pobieram…" : "Odśwież teraz"}
          </button>
          <div className="optionsWrap" ref={menuRef}>
            <button
              className="secondary menuButton"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="Menu"
            >
              <span /><span /><span />
            </button>
            {menuOpen && (
              <div className="menuPanel">
                <div className="menuUser">
                  Zalogowano jako <strong>{user.username}</strong>
                </div>
                {user.isAdmin && (
                  <Link href="/uzytkownicy" className="menuItem" onClick={() => setMenuOpen(false)}>
                    Użytkownicy
                  </Link>
                )}
                <form action={logout}>
                  <button type="submit" className="menuItem">Wyloguj</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {errors.map((s) => (
        <p key={s.id} className="error">
          {s.name}: {s.error}. Pokazuję ostatnie znane kursy.
        </p>
      ))}

      <div className="tableWrap">
        {hoverCol != null && (
          <style>{`
            table.rates tbody td:nth-child(${hoverCol}),
            table.rates thead tr:nth-child(2) th:nth-child(${hoverCol - 1}) { background-image: linear-gradient(var(--hover), var(--hover)); }
          `}</style>
        )}
        <table className="rates" onMouseOver={trackColumn} onMouseLeave={() => setHoverCol(null)}>
          <colgroup>
            <col className="colCurrency" />
            {sources.map((src) => [<col key={`${src.id}-b`} className="colRate" />, <col key={`${src.id}-s`} className="colRate" />])}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} className="stick">Waluta</th>
              {sources.map((src) => (
                <th key={src.id} colSpan={2} className={`group${src.id === HOME_SOURCE_ID ? " home" : ""}`}>
                  <a href={src.url} target="_blank" rel="noreferrer">{src.name}</a>
                  {src.id === HOME_SOURCE_ID && <span className="homeTag">mój kantor</span>}
                  {statusDot(src)}
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
                {sources.map((src) => {
                  const r = row.perSource[src.id];
                  const home = row.perSource[HOME_SOURCE_ID];
                  const bb = beatFor(src.id, "buy", r, home);
                  const bs = beatFor(src.id, "sell", r, home);
                  return [
                    <RateCell key={`${src.id}-b`} side={r?.buy} fresh={freshFor(r?.buy, src.scrapedAt)} beat={bb} beatInfo={beatTitle(bb, home)} />,
                    <RateCell key={`${src.id}-s`} side={r?.sell} fresh={freshFor(r?.sell, src.scrapedAt)} beat={bs} beatInfo={beatTitle(bs, home)} />,
                  ];
                })}
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
                const home = row.perSource[HOME_SOURCE_ID];
                const bb = beatFor(src.id, "buy", r, home);
                const bs = beatFor(src.id, "sell", r, home);
                const isHome = src.id === HOME_SOURCE_ID;
                return (
                  <div key={src.id} className={`sourceBox${r ? "" : " missing"}${isHome ? " home" : ""}`}>
                    <div className="sourceName">
                      {src.name}
                      {statusDot(src)}
                      {isHome && <span className="homeTag">mój kantor</span>}
                    </div>
                    <div className="sourceRates">
                      <RateBox label="Kupuje" side={r?.buy} fresh={freshFor(r?.buy, src.scrapedAt)} beat={bb} beatInfo={beatTitle(bb, home)} />
                      <RateBox label="Sprzedaje" side={r?.sell} fresh={freshFor(r?.sell, src.scrapedAt)} beat={bs} beatInfo={beatTitle(bs, home)} />
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
        ▲ zielony — kurs wzrósł, ▼ czerwony — kurs spadł (o tyle zł względem poprzedniej różnej wartości;
        kolorem: {WINDOW_OPTIONS.find((o) => o.value === options.changeWindow)?.label}).
        {options.showBeat && (
          <>
            {" "}Porównanie z Dorexem: <span className="legendBox beatBuy">zielona ramka</span> — kupuje taniej niż my,{" "}
            <span className="legendBox beatSell">czerwona ramka</span> — sprzedaje drożej niż my.
          </>
        )}
        Najedź na walutę, aby zobaczyć wykres z 24 h (kliknij, by otworzyć szczegóły).
      </p>
    </main>
  );
}
