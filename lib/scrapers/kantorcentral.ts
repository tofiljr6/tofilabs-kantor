import * as cheerio from "cheerio";
import type { ScrapedRate } from "../types";
import { normalize, parseRate } from "./util";

/**
 * kantorcentral.pl — <table class="currency-table">, wiersz:
 * <strong class="currency-code">EUR</strong><span class="currency-name">Euro</span>
 * <td class="currency-rate">kupno</td><td class="currency-rate">sprzedaż</td>
 * Kod "NEW" = banknoty 100$ od 2009 r. (→ USN, zob. lib/currencies.ts)
 */

export function parseKantorCentral(html: string): ScrapedRate[] {
  const $ = cheerio.load(html);
  const rates: ScrapedRate[] = [];
  $("table.currency-table tr").each((_, tr) => {
    const row = $(tr);
    const code = row.find(".currency-code").text().trim();
    const vals = row.find(".currency-rate");
    if (!code || vals.length < 2) return;
    rates.push({
      symbol: code,
      name: row.find(".currency-name").text().trim(),
      buy: parseRate($(vals[0]).text()),
      sell: parseRate($(vals[1]).text()),
    });
  });
  return normalize(rates);
}
