import { NextResponse } from "next/server";
import { getRates, scrapeAll } from "@/lib/scrape";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Wymagane logowanie" }, { status: 401 });

// GET: aktualny stan (scrape, jeśli dane mają > 5 min)
export async function GET() {
  if (!(await getCurrentUser())) return unauthorized();
  return NextResponse.json(await getRates());
}

// POST: wymuszony scrape „na zawołanie”
export async function POST() {
  if (!(await getCurrentUser())) return unauthorized();
  return NextResponse.json(await scrapeAll());
}
