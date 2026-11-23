import { Suspense } from "react";
import Dashboard from "./Dashboard";
import NbpTicker from "@/components/NbpTicker";
import { getRates, SCRAPE_INTERVAL_MS } from "@/lib/scrape";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  const initial = await getRates();
  return (
    <>
      {/* Pasek NBP doczytuje się osobno — wolne API NBP nie opóźnia tabeli kursów */}
      <Suspense fallback={<div className="ticker tickerPlaceholder" aria-hidden />}>
        <NbpTicker />
      </Suspense>
      <Dashboard initial={initial} intervalMs={SCRAPE_INTERVAL_MS} user={user} />
    </>
  );
}
