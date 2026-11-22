"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });
  return (
    <form action={action} className="loginForm">
      <input type="hidden" name="next" value={next} />
      <label>
        Login
        <input name="username" autoComplete="username" required autoFocus={!state.username} defaultValue={state.username} />
      </label>
      <label>
        Hasło
        <input name="password" type="password" autoComplete="current-password" required autoFocus={!!state.username} />
      </label>
      {state.error && <p className="loginError" role="alert">{state.error}</p>}
      <button type="submit" disabled={pending}>{pending ? "Loguję…" : "Zaloguj"}</button>
    </form>
  );
}
