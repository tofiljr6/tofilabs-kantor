import Link from "next/link";
import Flag from "@/components/Flag";
import { fmtDateTime, fmtDiff, fmtNbpDate, fmtPct, fmtRate } from "@/lib/format";
import { HOME_SOURCE_ID } from "@/lib/home";
import { getNbpRates, NBP_PRIORITY, type NbpRate } from "@/lib/nbp";
import { getRates } from "@/lib/scrape";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dorex vs NBP" };

const SUMMARY = ["EUR", "USD", "GBP", "CHF"];

type Row = NbpRate & { buy: number | null; sell: number | null };

const signed = (v: number, f: (n: number) => string) => `${v > 0 ? "+" : ""}${f(v)}`;

/** Różnica kursu Dorexu do średniego NBP: "−0,0412 zł (−0,93%)". */
function VsMid({ value, mid, side }: { value: number | null; mid: number; side: "buy" | "sell" }) {
  if (value == null) return <span className="muted">—</span>;
  const diff = value - mid;
  const pct = (diff / mid) * 100;
  // Kupujemy powyżej średniego / sprzedajemy poniżej — tracimy na każdej transakcji (albo błąd kursu).
  const alarm = side === "buy" ? diff > 0 : diff < 0;
  return (
    <>
      {fmtRate(value)}
      <span
        className={`sub${alarm ? " alarm" : ""}`}
        title={alarm ? (side === "buy" ? "Kupujemy drożej niż kurs średni NBP" : "Sprzedajemy taniej niż kurs średni NBP") : undefined}
      >
        {signed(diff, fmtDiff)} ({signed(pct, fmtPct)}%)
      </span>
    </>
  );
}

function DayChange({ r }: { r: NbpRate }) {
  if (r.prevMid == null) return <span className="muted">—</span>;
  const pct = ((r.mid - r.prevMid) / r.prevMid) * 100;
  if (Math.abs(pct) < 0.005) return <span className="muted">0,00%</span>;
  return <span className={pct > 0 ? "up" : "down"}>{pct > 0 ? "▲" : "▼"} {signed(pct, fmtPct)}%</span>;
}

const spreadPct = (r: Row) => (r.buy != null && r.sell != null ? ((r.sell - r.buy) / r.mid) * 100 : null);

export default async function NbpPage() {
  await requireUser();
  const [nbp, state] = await Promise.all([getNbpRates(), getRates()]);
  const dorex = state.sources[HOME_SOURCE_ID];
  const dorexBy = new Map(dorex?.rates.map((r) => [r.symbol, r]) ?? []);

  const rows: Row[] = (nbp?.rates ?? [])
    .map((r) => ({ ...r, buy: dorexBy.get(r.symbol)?.buy.value ?? null, sell: dorexBy.get(r.symbol)?.sell.value ?? null }))
    .filter((r) => r.buy != null || r.sell != null);
  const summary = SUMMARY.map((s) => rows.find((r) => r.symbol === s)).filter((r): r is Row => r != null);
  const nbpOnly = (nbp?.rates ?? []).filter((r) => !dorexBy.has(r.symbol)).map((r) => r.symbol);

  return (
    <main>
      <p className="back">
        <Link href="/">← Wszystkie kursy</Link>
      </p>
      <header>
        <div>
          <h1>Dorex vs NBP</h1>
          {nbp ? (
            <p className="muted">
              Kurs średni: tabela A nr {nbp.tableA.no} z {fmtNbpDate(nbp.tableA.date)}
              {nbp.tableC && <> · kupno/sprzedaż NBP: tabela C nr {nbp.tableC.no} z {fmtNbpDate(nbp.tableC.date)}</>}
            </p>
          ) : null}
        </div>
        <p className="muted">Kursy Dorexu z: <strong>{fmtDateTime(dorex?.scrapedAt ?? null)}</strong></p>
      </header>

      {!nbp && <p className="error">Nie udało się pobrać kursów z NBP (api.nbp.pl). Spróbuj za chwilę.</p>}

      {summary.length > 0 && (
        <div className="nbpSummary">
          {summary.map((r) => {
            const sp = spreadPct(r);
            return (
              <section key={r.symbol} className="nbpStat">
                <Link href={`/waluta/${r.symbol}`} className="currency">
                  <Flag symbol={r.symbol} />
                  <span className="sym">{r.symbol}</span>
                </Link>
                <dl>
                  <dt>Średni NBP</dt>
                  <dd><strong data-copy={r.mid != null ? fmtRate(r.mid) : undefined}>{fmtRate(r.mid)}</strong></dd>
                  <dt>Dorex kupuje</dt>
                  <dd><span data-copy={r.buy != null ? fmtRate(r.buy) : undefined}>{fmtRate(r.buy)}</span>{r.buy != null && <> ({signed(((r.buy - r.mid) / r.mid) * 100, fmtPct)}%)</>}</dd>
                  <dt>Dorex sprzedaje</dt>
                  <dd><span data-copy={r.sell != null ? fmtRate(r.sell) : undefined}>{fmtRate(r.sell)}</span>{r.sell != null && <> ({signed(((r.sell - r.mid) / r.mid) * 100, fmtPct)}%)</>}</dd>
                  <dt>Spread</dt>
                  <dd>{sp == null ? "—" : `${fmtPct(sp)}%`}</dd>
                </dl>
              </section>
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <div className="nbpWrap">
          <table className="nbp">
            <thead>
              <tr>
                <th>Waluta</th>
                <th>Średni NBP</th>
                <th>Zmiana d/d</th>
                <th className="sep">Dorex kupuje<br /><span className="small">vs średni</span></th>
                <th>Dorex sprzedaje<br /><span className="small">vs średni</span></th>
                <th>Spread Dorex</th>
                <th className="sep">NBP kupno<br /><span className="small">tabela C</span></th>
                <th>NBP sprzedaż<br /><span className="small">tabela C</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sp = spreadPct(r);
                return (
                  <tr key={r.symbol} className={NBP_PRIORITY.slice(0, 4).includes(r.symbol) ? "major" : undefined}>
                    <td title={r.name}>
                      <Link href={`/waluta/${r.symbol}`} className="currency">
                        <Flag symbol={r.symbol} />
                        <span className="sym">{r.symbol}</span>
                        <span className="muted small">{r.name}</span>
                      </Link>
                    </td>
                    <td className="num" data-copy={r.mid != null ? fmtRate(r.mid) : undefined}><strong>{fmtRate(r.mid)}</strong></td>
                    <td className="num"><DayChange r={r} /></td>
                    <td className="num sep" data-copy={r.buy != null ? fmtRate(r.buy) : undefined}><VsMid value={r.buy} mid={r.mid} side="buy" /></td>
                    <td className="num" data-copy={r.sell != null ? fmtRate(r.sell) : undefined}><VsMid value={r.sell} mid={r.mid} side="sell" /></td>
                    <td className="num">{sp == null ? <span className="muted">—</span> : `${fmtPct(sp)}%`}</td>
                    <td className="num sep" data-copy={r.bid != null ? fmtRate(r.bid) : undefined}>{fmtRate(r.bid)}</td>
                    <td className="num" data-copy={r.ask != null ? fmtRate(r.ask) : undefined}>{fmtRate(r.ask)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted small foot">
        Różnica pod kursem Dorexu: o ile zł (i %) nasz kurs jest od kursu średniego NBP. Spread = (sprzedaż − kupno) / kurs
        średni. <span className="down">Na czerwono</span> — kupujemy powyżej średniego albo sprzedajemy poniżej (strata na
        transakcji lub błąd kursu). Tabela A ukazuje się w dni robocze ok. 12:00, tabela C ok. 8:00.
        {nbpOnly.length > 0 && <> Waluty z tabeli NBP, których Dorex nie prowadzi: {nbpOnly.join(", ")}.</>}
      </p>
    </main>
  );
}
