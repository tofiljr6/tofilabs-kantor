import { NextResponse, type NextRequest } from "next/server";
import { getHistory, parseRange } from "@/lib/history";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Wymagane logowanie" }, { status: 401 });

// GET /api/history?symbol=EUR&range=24h
export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return unauthorized();
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "Brak parametru symbol" }, { status: 400 });
  const data = await getHistory(symbol, parseRange(req.nextUrl.searchParams.get("range")));
  if (!data) return NextResponse.json({ error: "Brak danych" }, { status: 404 });
  return NextResponse.json(data);
}
