import Dashboard from "./Dashboard";
import { getRates, SCRAPE_INTERVAL_MS } from "@/lib/scrape";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  const initial = await getRates();
  return <Dashboard initial={initial} intervalMs={SCRAPE_INTERVAL_MS} user={user} />;
}
