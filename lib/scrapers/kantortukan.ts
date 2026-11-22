import * as cheerio from "cheerio";
import type { ScrapedRate } from "../types";
import { normalize, parseRate } from "./util";

/**
 * kantortukan.pl — tabela #desk-table (wersja desktopowa; #phone-table to te same dane).
 * Wiersz: <tr data-waluta="USD"> flaga | kraj | kod | kupno | sprzedaż.
 * Na stronie są ceny hurtowe (od 1000 zł, po podaniu hasła).
 */
export function parseKantorTukan(html: string): ScrapedRate[] {
  const $ = cheerio.load(html);
  const rates: ScrapedRate[] = [];
  $("#desk-table tbody tr[data-waluta]").each((_, tr) => {
    const row = $(tr);
    const cells = row.children().map((_, c) => $(c).text().replace(/\s+/g, " ").trim()).get();
    if (cells.length < 5) return;
    rates.push({
      symbol: row.attr("data-waluta") ?? "",
      name: cells[1],
      buy: parseRate(cells[3]),
      sell: parseRate(cells[4]),
    });
  });
  return normalize(rates);
}
