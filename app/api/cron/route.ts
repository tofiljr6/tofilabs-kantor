import { NextResponse, type NextRequest } from "next/server";
import { lastRunAt } from "@/lib/repo";
import { scrapeAll } from "@/lib/scrape";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Jeśli ktoś (inny harmonogram albo użytkownik) scrapował przed chwilą — pomijamy,
// żeby kilka harmonogramów naraz (np. cron-job.org + GitHub Actions) nie odpytywało kantorów podwójnie.
const MIN_GAP_MS = 4 * 60 * 1000;

// Wywoływane co 5 minut przez zewnętrzny harmonogram (cron-job.org / GitHub Actions / Vercel Cron).
// Wymaga nagłówka "Authorization: Bearer $CRON_SECRET" (Vercel Cron dokleja go sam).
// ?force=1 — scrapuj niezależnie od tego, kiedy był ostatni raz.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const last = await lastRunAt();
  const age = last ? Date.now() - last.getTime() : Infinity;
  if (age < MIN_GAP_MS && req.nextUrl.searchParams.get("force") !== "1") {
    return NextResponse.json({ skipped: true, reason: "recent scrape", lastRunAt: last!.toISOString() });
  }

  const state = await scrapeAll();
  const sources = Object.values(state.sources).map((s) => ({ id: s.id, ok: !s.error, error: s.error, rates: s.rates.length }));
  return NextResponse.json({ updatedAt: state.updatedAt, sources });
}
