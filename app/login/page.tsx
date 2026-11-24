import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Logowanie" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="loginPage">
      <div className="loginCard">
        <h1>Kursy walut</h1>
        <p className="muted">Zaloguj się, aby zobaczyć kursy.</p>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
