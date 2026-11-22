import Link from "next/link";
import { notFound } from "next/navigation";
import Flag from "@/components/Flag";
import HistoryChart from "@/components/HistoryChart";
import { getHistory, parseRange, RANGES, type RangeKey } from "@/lib/history";
import { fmtDateTime, fmtDiff, fmtPct, fmtRate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { HistoryPoint } from "@/lib/types";

export const dynamic = "force-dynamic";

const RANGE_LABEL: Record<RangeKey, string> = { "24h": "24 godziny", "7d": "7 dni", "30d": "30 dni" };

const fmtTime = (iso: string) => fmtDateTime(iso);

function Delta({ cur, prev }: { cur: number | null; prev: number | null }) {
  if (cur == null || prev == null || prev === 0 || cur === prev) return <span className="muted">—</span>;
  const diff = cur - prev;
  const pct = (diff / prev) * 100;
  const sign = diff > 0 ? "+" : "";
  return (
    <span className={diff > 0 ? "up" : "down"}>
      {diff > 0 ? "▲" : "▼"} {sign}
      {fmtDiff(diff)} ({sign}
      {fmtPct(pct)}%)
    </span>
  );
}

/** Zmiana od początku okna do teraz. */
function windowChange(points: HistoryPoint[], key: "buy" | "sell") {
  return { first: points[0]?.[key] ?? null, last: points[points.length - 1]?.[key] ?? null };
}

export default async function CurrencyPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  await requireUser();
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw);
  const range = parseRange((await searchParams).range);
  const data = await getHistory(symbol, range);
  if (!data) notFound();

  return (
    <main>
      <p className="back">
        <Link href="/">← Wszystkie kursy</Link>
      </p>
      <header>
        <div className="titleRow">
          <Flag symbol={data.symbol} />
          <div>
            <h1>{data.symbol}</h1>
            <p className="muted">{data.name}</p>
          </div>
        </div>
        <nav className="ranges">
          {(Object.keys(RANGES) as RangeKey[]).map((r) => (
            <Link key={r} href={`?range=${r}`} className={r === range ? "active" : ""} scroll={false}>
              {RANGE_LABEL[r]}
            </Link>
          ))}
        </nav>
      </header>

      {data.sources.map((src) => {
        const buy = windowChange(src.points, "buy");
        const sell = windowChange(src.points, "sell");
        // lista zmian (bez pierwszego punktu, który jest stanem na początek okna)
        const changes = src.points
          .map((p, i) => ({ p, prev: i > 0 ? src.points[i - 1] : null }))
          .slice(1)
          .reverse();
        return (
          <section key={src.id} className="card">
            <div className="cardHead">
              <h2>
                <a href={src.url} target="_blank" rel="noreferrer">{src.name}</a>
              </h2>
              <div className="stats">
                <div>
                  <span className="muted small">Kupuje teraz</span>
                  <strong>{fmtRate(buy.last)}</strong>
                  <span className="small"><Delta cur={buy.last} prev={buy.first} /></span>
                </div>
                <div>
                  <span className="muted small">Sprzedaje teraz</span>
                  <strong>{fmtRate(sell.last)}</strong>
                  <span className="small"><Delta cur={sell.last} prev={sell.first} /></span>
                </div>
              </div>
            </div>
            <p className="muted small">Zmiana względem kursu sprzed {RANGE_LABEL[range]}.</p>

            <HistoryChart points={src.points} from={data.from} to={data.to} height={300} />

            <h3>Zmiany kursu ({changes.length})</h3>
            {changes.length === 0 ? (
              <p className="muted">W tym okresie kurs się nie zmienił.</p>
            ) : (
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Kiedy</th>
                      <th className="num">Kupuje</th>
                      <th className="num">Zmiana</th>
                      <th className="num">Sprzedaje</th>
                      <th className="num">Zmiana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map(({ p, prev }) => (
                      <tr key={p.t}>
                        <td>{fmtTime(p.t)}</td>
                        <td className="num">{fmtRate(p.buy)}</td>
                        <td className="num"><Delta cur={p.buy} prev={prev?.buy ?? null} /></td>
                        <td className="num">{fmtRate(p.sell)}</td>
                        <td className="num"><Delta cur={p.sell} prev={prev?.sell ?? null} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
