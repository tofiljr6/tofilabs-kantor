import { NextResponse } from "next/server";
import { getRates, scrapeAll } from "@/lib/scrape";

export const dynamic = "force-dynamic";

// GET: aktualny stan (scrape, jeśli dane mają > 5 min)
export async function GET() {
  return NextResponse.json(await getRates());
}

// POST: wymuszony scrape „na zawołanie”
export async function POST() {
  return NextResponse.json(await scrapeAll());
}
