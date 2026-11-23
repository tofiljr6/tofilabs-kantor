import * as cheerio from "cheerio";
import type { ScrapedRate } from "../types";
import { isKnownCurrency } from "../currencies";
import { normalize, parseRate } from "./util";

/**
 * tavex.pl/kantor-wroclaw-kursy-walut/?officeId=61 (Wrocław, Oławska) — <table class="list-table">,
 * wiersz: <abbr>KOD</abbr> · .list-table__col-title (nazwa) · 2× td.list-table__col--value (skup, sprzedaż).
 * Przelicznik bywa w nazwie, np. "Won południowokoreański (1000)" — dzielimy, żeby kurs był za 1 jednostkę.
 * Pomijamy waluty spoza słownika (wycofane: DEM, ATS…, stare banknoty CHFO/GBPO) — Tavex tylko je skupuje.
 */
export function parseTavex(html: string): ScrapedRate[] {
  const $ = cheerio.load(html);
  const rates: ScrapedRate[] = [];
  $("table.list-table tbody tr").each((_, tr) => {
    const row = $(tr);
    const symbol = row.find("abbr").first().text().trim();
    const vals = row.find("td.list-table__col--value");
    if (!symbol || vals.length < 2 || !isKnownCurrency(symbol)) return;
    const rawName = row.find(".list-table__col-title").first().text().replace(/\s+/g, " ").trim();
    const unitMatch = rawName.match(/\((\d+)\)\s*$/);
    const unit = unitMatch ? Number(unitMatch[1]) : 1;
    const perUnit = (v: number | null) => (v == null ? null : v / unit);
    rates.push({
      symbol,
      name: unitMatch ? rawName.slice(0, unitMatch.index).trim() : rawName,
      buy: perUnit(parseRate($(vals[0]).text())),
      sell: perUnit(parseRate($(vals[1]).text())),
    });
  });
  return normalize(rates);
}
