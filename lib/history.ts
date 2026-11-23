import { tzOffset } from "./format";
import { loadHistory } from "./repo";
import { SOURCES } from "./sources";

/** Godziny (czasu warszawskiego), które pokazujemy na wykresach — reszta doby nas nie interesuje. */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 22;

const H = 3600_000;

/** Chwila (UTC ms) odpowiadająca godzinie `hour`:00 dzisiaj w Warszawie. */
function warsawToday(now: number, hour: number): number {
  const off = tzOffset(now);
  const localMidnight = Math.floor((now + off) / (24 * H)) * 24 * H; // północ jako "czas lokalny zapisany w UTC"
  const guess = localMidnight + hour * H;
  return guess - tzOffset(guess - off);
}

/** Okno dzisiejszego dnia: 7:00–22:00 czasu warszawskiego. */
export function todayWindow(now = Date.now()) {
  return { from: warsawToday(now, DAY_START_HOUR), to: warsawToday(now, DAY_END_HOUR) };
}

export function getHistory(symbol: string) {
  const now = Date.now();
  const { from, to } = todayWindow(now);
  return loadHistory(SOURCES, symbol, new Date(from), new Date(to), new Date(Math.min(now, to)));
}
