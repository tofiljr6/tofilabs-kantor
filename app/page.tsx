import Dashboard from "./Dashboard";
import { getRates, SCRAPE_INTERVAL_MS } from "@/lib/scrape";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initial = await getRates();
  return <Dashboard initial={initial} intervalMs={SCRAPE_INTERVAL_MS} />;
}
