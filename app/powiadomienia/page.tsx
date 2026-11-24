import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import NotificationSettings from "./NotificationSettings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Powiadomienia" };

export default async function NotificationsPage() {
  await requireUser();
  return (
    <main className="narrow">
      <p className="back">
        <Link href="/">← Wszystkie kursy</Link>
      </p>
      <h1>Powiadomienia</h1>
      <p className="muted">
        Powiadomienia pokazują się w prawym dolnym rogu po odświeżeniu kursów, gdy strona z kursami jest otwarta.
        Ustawienia zapisują się w tej przeglądarce.
      </p>
      <NotificationSettings />
    </main>
  );
}
