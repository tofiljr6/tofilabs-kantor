import * as cheerio from "cheerio";
import type { ScrapedRate } from "../types";
import { normalize, parseRate } from "./util";

/**
 * kantorygant.pl/kantor/<Miasto>/<Adres> — <table class="currency-table-full">, wiersz:
 * td.curr-col-cash-full (kod) · td.curr-col-cash-name-full (nazwa) · 2× td.curr-col-val-full (kupno, sprzedaż)
 */
export function parseKantorGant(html: string): ScrapedRate[] {
  const $ = cheerio.load(html);
  const rates: ScrapedRate[] = [];
  $("table.currency-table-full tbody tr").each((_, tr) => {
    const row = $(tr);
    const symbol = row.find(".curr-col-cash-full").text().trim();
    const vals = row.find(".curr-col-val-full");
    if (!symbol || vals.length < 2) return;
    rates.push({
      symbol,
      name: row.find(".curr-col-cash-name-full").text().trim(),
      buy: parseRate($(vals[0]).text()),
      sell: parseRate($(vals[1]).text()),
    });
  });
  return normalize(rates);
}
