import { canonicalSymbol, currencyName } from "../currencies";
import type { ScrapedRate } from "../types";

/** "4,4200" / "4.4200" → 4.42; 0 i śmieci → null (kantor nie prowadzi tej strony transakcji). */
export function parseRate(text: string): number | null {
  const n = parseFloat(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Ujednolica symbol i nazwę, odrzuca puste/zdublowane wiersze. */
export function normalize(rows: ScrapedRate[]): ScrapedRate[] {
  const seen = new Set<string>();
  const out: ScrapedRate[] = [];
  for (const r of rows) {
    const symbol = canonicalSymbol(r.symbol);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({ ...r, symbol, name: currencyName(symbol, r.name) });
  }
  return out;
}
