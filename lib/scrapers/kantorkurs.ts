import * as cheerio from "cheerio";
import type { ScrapedRate } from "../types";
import { normalize, parseRate } from "./util";

/**
 * kantorkurs.pl — na stronie są dwie tabele: "Ceny hurtowe" (od 7 000 zł) i "Ceny detaliczne".
 * Tabelę wybieramy po nagłówku <h3>, który ją poprzedza.
 * Wiersz: <td><img></td><td>EUR <span class="waluta">Euro</span></td><td>kupno</td><td>sprzedaż</td>
 */
function parseTable(html: string, heading: string): ScrapedRate[] {
  const $ = cheerio.load(html);
  const h3 = $("h3")
    .filter((_, el) => $(el).text().trim().toLowerCase() === heading.toLowerCase())
    .first();
  const table = h3.nextAll("table").first();
  const rates: ScrapedRate[] = [];
  table.find("tr").each((_, tr) => {
    const td = $(tr).find("td");
    if (td.length < 4) return;
    const cell = $(td[1]).clone();
    const name = cell.find(".waluta").text().trim();
    cell.find(".waluta").remove();
    const symbol = cell.text().trim();
    if (!symbol) return;
    rates.push({ symbol, name, buy: parseRate($(td[2]).text()), sell: parseRate($(td[3]).text()) });
  });
  return normalize(rates);
}

export const parseKantorKursHurt = (html: string) => parseTable(html, "Ceny hurtowe");
export const parseKantorKursDetal = (html: string) => parseTable(html, "Ceny detaliczne");
