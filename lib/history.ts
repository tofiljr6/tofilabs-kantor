import { loadHistory } from "./repo";
import { SOURCES } from "./sources";

export const RANGES = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 } as const;
export type RangeKey = keyof typeof RANGES;

export function parseRange(v: string | null | undefined): RangeKey {
  return v && v in RANGES ? (v as RangeKey) : "24h";
}

export function getHistory(symbol: string, range: RangeKey) {
  return loadHistory(SOURCES, symbol, RANGES[range]);
}
