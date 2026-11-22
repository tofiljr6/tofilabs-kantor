"use client";

import { useActionState, useState } from "react";
import { addUserAction, deleteUserAction, resetPasswordAction, type FormState } from "./actions";

const initial: FormState = { error: null, ok: null };

function Message({ state }: { state: FormState }) {
  if (state.error) return <p className="formError" role="alert">{state.error}</p>;
  if (state.ok) return <p className="formOk" role="status">{state.ok}</p>;
  return null;
}

export function AddUserForm() {
  const [state, action, pending] = useActionState(addUserAction, initial);
  return (
    <form action={action} className="userForm" key={state.ok ?? "form"}>
      <label>
        Login
        <input name="username" autoComplete="off" required minLength={3} maxLength={32} />
      </label>
      <label>
        Hasło
        <input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </label>
      <button type="submit" disabled={pending}>{pending ? "Dodaję…" : "Dodaj użytkownika"}</button>
      <Message state={state} />
    </form>
  );
}

export function ResetPasswordForm({ id, username }: { id: number; username: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(resetPasswordAction, initial);
  if (!open) {
    return (
      <>
        <button type="button" className="secondary small" onClick={() => setOpen(true)}>Zmień hasło</button>
        <Message state={state} />
      </>
    );
  }
  return (
    <form
      action={async (fd) => {
        await action(fd);
        setOpen(false);
      }}
      className="inlineForm"
    >
      <input type="hidden" name="id" value={id} />
      <input
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder={`Nowe hasło dla ${username}`}
        required
        minLength={8}
        autoFocus
      />
      <button type="submit" className="small" disabled={pending}>Zapisz</button>
      <button type="button" className="secondary small" onClick={() => setOpen(false)}>Anuluj</button>
    </form>
  );
}

export function DeleteUserButton({ id, username }: { id: number; username: string }) {
  return (
    <form
      action={deleteUserAction}
      onSubmit={(e) => {
        if (!confirm(`Usunąć użytkownika „${username}”? Zostanie od razu wylogowany.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="danger small">Usuń</button>
    </form>
  );
}
