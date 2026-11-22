import * as cheerio from "cheerio";
import type { ScrapedRate } from "../types";
import { normalize, parseRate } from "./util";

export function parseCentKantor(html: string): ScrapedRate[] {
  const $ = cheerio.load(html);
  const rates: ScrapedRate[] = [];
  $("#ex_table tbody tr").each((_, tr) => {
    const row = $(tr);
    const symbol = row.find(".c_symbol").text().trim();
    if (!symbol) return;
    rates.push({
      symbol,
      name: row.find(".c_name").text().trim(),
      buy: parseRate(row.find(".c_buy").text()),
      sell: parseRate(row.find(".c_sell").text()),
    });
  });
  return normalize(rates);
}
