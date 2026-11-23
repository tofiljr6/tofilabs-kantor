import Link from "next/link";
import Flag from "@/components/Flag";
import { fmtNbpDate, fmtPct, fmtRate } from "@/lib/format";
import { getNbpRates, type NbpRate } from "@/lib/nbp";

function Item({ r }: { r: NbpRate }) {
  const pct = r.prevMid ? ((r.mid - r.prevMid) / r.prevMid) * 100 : null;
  const dir = pct == null || Math.abs(pct) < 0.005 ? "flat" : pct > 0 ? "up" : "down";
  return (
    <span className="tickerItem">
      <Flag symbol={r.symbol} />
      <span className="tickerSym">{r.symbol}</span>
      <span className="tickerRate">{fmtRate(r.mid)}</span>
      {pct != null && (
        <span className={`tickerChg ${dir}`}>
          {dir === "up" ? "▲" : dir === "down" ? "▼" : "■"} {pct > 0 ? "+" : ""}
          {fmtPct(pct)}%
        </span>
      )}
    </span>
  );
}

/** Pasek „jak w telewizji” z kursami średnimi NBP; klik → /nbp (porównanie z Dorexem). */
export default async function NbpTicker() {
  const nbp = await getNbpRates();
  if (!nbp || nbp.rates.length === 0) return null;

  const items = nbp.rates.map((r) => <Item key={r.symbol} r={r} />);
  // ~3,5 s na walutę — tempo czytelne niezależnie od liczby walut
  const duration = `${Math.max(30, nbp.rates.length * 3.5)}s`;

  return (
    <Link
      href="/nbp"
      className="ticker"
      title="Porównaj kursy Dorexu z NBP"
      aria-label={`Kursy średnie NBP z ${fmtNbpDate(nbp.tableA.date)} — otwórz porównanie z Dorexem`}
    >
      <span className="tickerLabel">
        NBP <span className="tickerDate">{fmtNbpDate(nbp.tableA.date)}</span>
      </span>
      <span className="tickerViewport">
        <span className="tickerTrack" style={{ animationDuration: duration }}>
          <span className="tickerGroup">{items}</span>
          <span className="tickerGroup" aria-hidden>{items}</span>
        </span>
      </span>
      <span className="tickerCta">Porównaj z Dorexem →</span>
    </Link>
  );
}
