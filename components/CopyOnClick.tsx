"use client";

import { useEffect, useRef, useState } from "react";

/** Kopiowanie do schowka: Clipboard API, a gdy niedostępne (stary Safari, brak HTTPS) — ukryte pole + execCommand. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // spróbujemy starszą metodą
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  // font-size 16px — iOS nie przybliża strony przy zaznaczeniu
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px;";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

/**
 * Klik (lub tapnięcie) w dowolny element z atrybutem `data-copy` kopiuje jego wartość do schowka
 * i pokazuje krótki komunikat. Montowane raz w layoucie — działa na każdej stronie.
 */
export default function CopyOnClick() {
  const [toast, setToast] = useState<{ text: string; ok: boolean; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-copy]");
      if (!el) return;
      // Nie przeszkadzaj w zaznaczaniu tekstu myszą.
      if (window.getSelection()?.toString()) return;
      const text = el.dataset.copy;
      if (!text) return;
      const ok = await copyText(text);
      el.classList.remove("copied");
      void el.offsetWidth; // restart animacji przy kolejnym kliknięciu
      if (ok) el.classList.add("copied");
      setToast({ text, ok, id: Date.now() });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), 1600);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!toast) return null;
  return (
    <div key={toast.id} className={`copyToast${toast.ok ? "" : " fail"}`} role="status" aria-live="polite">
      {toast.ok ? <>Skopiowano <strong>{toast.text}</strong></> : "Nie udało się skopiować"}
    </div>
  );
}
