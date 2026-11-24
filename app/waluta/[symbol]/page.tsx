import Link from "next/link";
import { notFound } from "next/navigation";
import Flag from "@/components/Flag";
import HistoryChart from "@/components/HistoryChart";
import { DAY_END_HOUR, DAY_START_HOUR, getHistory } from "@/lib/history";
import { fmtDateTime, fmtDiff, fmtPct, fmtRate } from "@/lib/format";
import { HOME_SOURCE_ID } from "@/lib/home";
import { requireUser } from "@/lib/session";
import type { HistoryPoint } from "@/lib/types";

export const dynamic = "force-dynamic";

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

export default async function CurrencyPage({ params }: { params: Promise<{ symbol: string }> }) {
  await requireUser();
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw);
  const data = await getHistory(symbol);
  if (!data) notFound();

  // Aktualne kursy każdego kantoru (ostatni punkt historii) + najlepsze dla klienta.
  const current = data.sources.map((src) => ({
    src,
    buy: windowChange(src.points, "buy"),
    sell: windowChange(src.points, "sell"),
  }));
  const buys = current.map((c) => c.buy.last).filter((v): v is number => v != null);
  const sells = current.map((c) => c.sell.last).filter((v): v is number => v != null);
  const bestBuy = buys.length > 1 ? Math.max(...buys) : null; // klient dostaje najwięcej
  const bestSell = sells.length > 1 ? Math.min(...sells) : null; // klient płaci najmniej

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
        <p className="muted">Dzisiaj, {DAY_START_HOUR}:00–{DAY_END_HOUR}:00</p>
      </header>

      <h2 className="sectionTitle">Aktualne kursy</h2>
      <div className="overviewGrid">
        {current.map(({ src, buy, sell }) => (
          <section key={src.id} className={`card overviewCard${src.id === HOME_SOURCE_ID ? " home" : ""}`}>
            <h3>
              <a href={src.url} target="_blank" rel="noreferrer">{src.name}</a>
              {src.id === HOME_SOURCE_ID && <span className="homeTag">mój kantor</span>}
            </h3>
            <div className="overviewRates">
              <div className={`overviewRate${bestBuy != null && buy.last === bestBuy ? " best" : ""}`}>
                <span className="muted small">Kupuje{bestBuy != null && buy.last === bestBuy ? " · najlepszy" : ""}</span>
                <strong data-copy={buy.last != null ? fmtRate(buy.last) : undefined}>{fmtRate(buy.last)}</strong>
                <span className="small"><Delta cur={buy.last} prev={buy.first} /></span>
              </div>
              <div className={`overviewRate${bestSell != null && sell.last === bestSell ? " best" : ""}`}>
                <span className="muted small">Sprzedaje{bestSell != null && sell.last === bestSell ? " · najlepszy" : ""}</span>
                <strong data-copy={sell.last != null ? fmtRate(sell.last) : undefined}>{fmtRate(sell.last)}</strong>
                <span className="small"><Delta cur={sell.last} prev={sell.first} /></span>
              </div>
            </div>
          </section>
        ))}
      </div>

      <h2 className="sectionTitle">Wykresy i zmiany kursu</h2>
      <div className="cardGrid">
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
                  <strong data-copy={buy.last != null ? fmtRate(buy.last) : undefined}>{fmtRate(buy.last)}</strong>
                  <span className="small"><Delta cur={buy.last} prev={buy.first} /></span>
                </div>
                <div>
                  <span className="muted small">Sprzedaje teraz</span>
                  <strong data-copy={sell.last != null ? fmtRate(sell.last) : undefined}>{fmtRate(sell.last)}</strong>
                  <span className="small"><Delta cur={sell.last} prev={sell.first} /></span>
                </div>
              </div>
            </div>
            <p className="muted small">Zmiana względem kursu z {DAY_START_HOUR}:00.</p>

            <HistoryChart points={src.points} from={data.from} to={data.to} until={data.until} height={240} />

            <h3>Zmiany kursu ({changes.length})</h3>
            {changes.length === 0 ? (
              <p className="muted">Dzisiaj kurs się nie zmienił.</p>
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
                        <td className="num" data-copy={p.buy != null ? fmtRate(p.buy) : undefined}>{fmtRate(p.buy)}</td>
                        <td className="num"><Delta cur={p.buy} prev={prev?.buy ?? null} /></td>
                        <td className="num" data-copy={p.sell != null ? fmtRate(p.sell) : undefined}>{fmtRate(p.sell)}</td>
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
      </div>
    </main>
  );
}
