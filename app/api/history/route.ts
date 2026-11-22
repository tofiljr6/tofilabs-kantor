import { NextResponse, type NextRequest } from "next/server";
import { getHistory, parseRange } from "@/lib/history";

export const dynamic = "force-dynamic";

// GET /api/history?symbol=EUR&range=24h
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "Brak parametru symbol" }, { status: 400 });
  const data = await getHistory(symbol, parseRange(req.nextUrl.searchParams.get("range")));
  if (!data) return NextResponse.json({ error: "Brak danych" }, { status: 404 });
  return NextResponse.json(data);
}
