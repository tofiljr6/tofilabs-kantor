import * as cheerio from "cheerio";
import type { ScrapedRate } from "../types";
import { normalize, parseRate } from "./util";

/**
 * dorex.com.pl/kursy-walut — <div class="currency-table"><table>, wiersz:
 * kraj (flaga) · kraj · nazwa waluty · symbol · kupno · sprzedaż · link
 */
export function parseDorex(html: string): ScrapedRate[] {
  const $ = cheerio.load(html);
  const rates: ScrapedRate[] = [];
  $(".currency-table table tbody tr").each((_, tr) => {
    const td = $(tr).find("td");
    if (td.length < 6) return;
    const symbol = $(td[3]).text().trim();
    if (!symbol) return;
    const buy = parseRate($(td[4]).text());
    const sell = parseRate($(td[5]).text());
    if (buy == null && sell == null) return;
    rates.push({ symbol, name: $(td[2]).text().trim(), buy, sell });
  });
  return normalize(rates);
}
