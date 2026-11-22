"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authConfig,
  createSessionToken,
  isAdminCredentials,
  passwordFingerprint,
  SESSION_COOKIE,
  SESSION_TTL_S,
  type SessionPayload,
} from "@/lib/auth";
import { burnPasswordCheck, findUser, verifyPassword } from "@/lib/users";

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
  const session = await authenticate(username, password);
  if (!session) {
    await new Promise((r) => setTimeout(r, 600)); // spowalnia zgadywanie haseł
    return { error: "Nieprawidłowy login lub hasło.", username };
  }
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
  redirect(safeNext(form.get("next")));
}

/** Najpierw konto administratora z env, potem użytkownicy z bazy. */
async function authenticate(username: string, password: string): Promise<Omit<SessionPayload, "exp"> | null> {
  if (await isAdminCredentials(username, password)) {
    return { u: authConfig()!.username, k: "a", v: await passwordFingerprint(password) };
  }
  const user = await findUser(username);
  if (!user) {
    await burnPasswordCheck(password);
    return null;
  }
  if (!(await verifyPassword(password, user.password_hash))) return null;
  return { u: user.username, k: "u", v: await passwordFingerprint(user.password_hash) };
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
