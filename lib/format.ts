// Wspólne formatowanie — zawsze w strefie Warszawy, żeby serwer (na Vercelu: UTC)
// i przeglądarka renderowały identyczny tekst.
export const TZ = "Europe/Warsaw";

export const fmtRate = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pl-PL", { minimumFractionDigits: 4, maximumFractionDigits: 5 });

export const fmtDiff = (v: number) =>
  v.toLocaleString("pl-PL", { minimumFractionDigits: 4, maximumFractionDigits: 5 });

export const fmtPct = (v: number) =>
  v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDateTime = (v: string | number | null, seconds = false) =>
  v == null
    ? "—"
    : new Date(v).toLocaleString("pl-PL", { timeZone: TZ, dateStyle: "short", timeStyle: seconds ? "medium" : "short" });

export const fmtHour = (t: number) =>
  new Date(t).toLocaleTimeString("pl-PL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export const fmtDay = (t: number) =>
  new Date(t).toLocaleDateString("pl-PL", { timeZone: TZ, day: "2-digit", month: "2-digit" });

/** Przesunięcie strefy Warszawy względem UTC (ms) w danej chwili. */
export function tzOffset(t: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(t));
  const g = (k: string) => Number(parts.find((p) => p.type === k)!.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(t / 1000) * 1000;
}

/** Data z API NBP: "2026-11-23" → "23.11.2026" */
export const fmtNbpDate = (d: string) => d.split("-").reverse().join(".");
