import { NextResponse, type NextRequest } from "next/server";
import { deleteOlderThan } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_HOURS = 48;

// Sprzątanie bazy — wołane np. raz dziennie przez cron-job.org.
// Wymaga nagłówka "Authorization: Bearer $CRON_SECRET" (jak /api/cron).
// ?hours=N — zmień próg (domyślnie 48 h, minimum 1 h).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const param = req.nextUrl.searchParams.get("hours");
  const hours = param == null ? DEFAULT_HOURS : Number(param);
  if (!Number.isFinite(hours) || hours < 1) {
    return NextResponse.json({ error: "Parametr hours musi być liczbą ≥ 1" }, { status: 400 });
  }

  const { cutoff, rates, runs } = await deleteOlderThan(hours);
  return NextResponse.json({ hours, cutoff, deleted: { rateHistory: rates, scrapeRuns: runs } });
}
