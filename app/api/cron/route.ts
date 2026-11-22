import { NextResponse, type NextRequest } from "next/server";
import { scrapeAll } from "@/lib/scrape";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Wywoływane przez Vercel Cron albo zewnętrzny harmonogram (GitHub Actions) co 5 minut.
// Vercel Cron sam dokleja nagłówek "Authorization: Bearer $CRON_SECRET".
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const state = await scrapeAll();
  const sources = Object.values(state.sources).map((s) => ({ id: s.id, ok: !s.error, error: s.error, rates: s.rates.length }));
  return NextResponse.json({ updatedAt: state.updatedAt, sources });
}
