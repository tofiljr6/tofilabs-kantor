import type { ScrapedRate } from "../types";
import { normalize } from "./util";

/**
 * kantorsprawa.pl (Next.js). W HTML widać tylko 5 walut — pełna lista siedzi w payloadzie
 * React Server Components: `self.__next_f.push([1,"..."])`. Sklejamy te fragmenty, szukamy
 * tablicy "currencies" należącej do oddziału o danym slugu (strona zawiera też inne miasta
 * oraz "onlineCurrencies" — kursy wymiany online, których nie bierzemy).
 */
type Item = { currency?: string; name?: string; subtitle?: string | null; buy?: number | null; sell?: number | null };

function decodePayload(html: string): string {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let out = "";
  for (let m; (m = re.exec(html)); ) out += JSON.parse(`"${m[1]}"`);
  return out;
}

function readArray(s: string, start: number): unknown[] | null {
  let depth = 0;
  for (let j = start; j < s.length; j++) {
    if (s[j] === "[") depth++;
    else if (s[j] === "]" && --depth === 0) {
      try {
        return JSON.parse(s.slice(start, j + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function parseKantorSprawa(html: string, slug: string): ScrapedRate[] {
  const s = decodePayload(html);
  const key = '"currencies":[';
  for (let i = s.indexOf(key); i >= 0; i = s.indexOf(key, i + 1)) {
    const before = s.slice(Math.max(0, i - 600), i);
    const slugs = [...before.matchAll(/"slug":"([^"]+)"/g)];
    if (slugs.at(-1)?.[1] !== slug) continue;
    const arr = readArray(s, i + key.length - 1) as Item[] | null;
    if (!arr?.length) continue;
    return normalize(
      arr.map((x) => ({
        symbol: x.currency ?? x.name ?? "",
        name: x.subtitle ?? x.name ?? "",
        buy: typeof x.buy === "number" && x.buy > 0 ? x.buy : null,
        sell: typeof x.sell === "number" && x.sell > 0 ? x.sell : null,
      })),
    );
  }
  return [];
}
