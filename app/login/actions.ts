"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authConfig, checkCredentials, createSessionToken, SESSION_COOKIE, SESSION_TTL_S } from "@/lib/auth";

export type LoginState = { error: string | null; username?: string };

/** Tylko ścieżki wewnątrz aplikacji (ochrona przed open redirect). */
function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/login") ? s : "/";
}

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  if (!authConfig()) {
    return { error: "Logowanie nie jest skonfigurowane (brak AUTH_USERNAME / AUTH_PASSWORD / AUTH_SECRET)." };
  }
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!(await checkCredentials(username, password))) {
    await new Promise((r) => setTimeout(r, 600)); // spowalnia zgadywanie haseł
    return { error: "Nieprawidłowy login lub hasło.", username };
  }
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
