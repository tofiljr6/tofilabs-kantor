"use client";

import { useEffect } from "react";
import type { Toast } from "@/lib/notify";

export const TOAST_MS = 30_000;

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onClose(toast.id), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast.id, onClose]);
  const shown = toast.lines.slice(0, 6);
  return (
    <div className={`toast ${toast.kind}`} role="status">
      <button className="toastClose" onClick={() => onClose(toast.id)} aria-label="Zamknij powiadomienie">×</button>
      <div className="toastTitle">{toast.kind === "worst" && <span className="legendDot">!</span>} {toast.title}</div>
      <ul>
        {shown.map((l) => <li key={l}>{l}</li>)}
        {toast.lines.length > shown.length && <li className="muted">…i {toast.lines.length - shown.length} więcej</li>}
      </ul>
      <div className="toastTimer" style={{ animationDuration: `${TOAST_MS}ms` }} />
    </div>
  );
}

export default function Toasts({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} onClose={onClose} />)}
    </div>
  );
}
