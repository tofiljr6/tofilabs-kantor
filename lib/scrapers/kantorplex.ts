import * as cheerio from "cheerio";
import type { ScrapedRate } from "../types";
import { normalize, parseRate } from "./util";

/**
 * kantorplex.pl — stary layout tabelkowy; strona główna = kursy hurtowe,
 * /wroclaw-kurs-detal = detaliczne (inne klasy CSS). Dlatego parser ogólny:
 * w wierszu szukamy komórki z kodem waluty, a po niej dwóch liczb (kupno, sprzedaż).
 * Nazwa waluty jest w komórce przed kodem. Przelicznik bywa w nazwie, np. "DONG(X1000)" —
 * dzielimy wtedy kurs, żeby wszystko było za 1 jednostkę (jak w innych kantorach).
 */
const CODE = /^[A-Z]{3}[A-Z0-9]?$/;
const NUM = /^\d+[.,]\d+$/;

export function parseKantorPlex(html: string): ScrapedRate[] {
  const $ = cheerio.load(html);
  const rates: ScrapedRate[] = [];
  $("tr").each((_, tr) => {
    const cells = $(tr)
      .children("td")
      .map((_, td) => $(td).text().replace(/\s+/g, " ").trim())
      .get();
    for (let i = 0; i + 2 < cells.length; i++) {
      if (!CODE.test(cells[i]) || !NUM.test(cells[i + 1]) || !NUM.test(cells[i + 2])) continue;
      const name = cells[i - 1] ?? "";
      const unit = Number(name.match(/\(\s*X\s*(\d+)\s*\)/i)?.[1] ?? 1);
      const perUnit = (v: number | null) => (v == null ? null : v / unit);
      rates.push({
        symbol: cells[i],
        name,
        buy: perUnit(parseRate(cells[i + 1])),
        sell: perUnit(parseRate(cells[i + 2])),
      });
      break;
    }
  });
  return normalize(rates);
}
