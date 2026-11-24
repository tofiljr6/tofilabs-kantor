import { HOME_SOURCE_ID } from "@/lib/home";
import { fmtRate } from "@/lib/format";
import type { RatesState, StoredRate } from "@/lib/types";

export type Toast = {
  id: number;
  kind: "change" | "worst";
  title: string;
  lines: string[];
};

/**
 * Czy Dorex ma najgorszy kurs dla klienta: nikt nie jest od nas gorszy, a ktoś jest lepszy
 * (remis wszystkich to nie „najgorszy”; remis na ostatnim miejscu — tak).
 */
export function isWorst(kind: "buy" | "sell", perSource: Record<string, StoredRate>): boolean {
  const mine = perSource[HOME_SOURCE_ID]?.[kind].value;
  if (mine == null) return false;
  const values = Object.values(perSource)
    .map((r) => r[kind].value)
    .filter((v): v is number => v != null);
  const worse = values.some((v) => (kind === "buy" ? v < mine : v > mine));
  const better = values.some((v) => (kind === "buy" ? v > mine : v < mine));
  return better && !worse;
}

const KIND_LABEL = { buy: "kupno", sell: "sprzedaż" } as const;

function perSymbol(state: RatesState): Map<string, Record<string, StoredRate>> {
  const map = new Map<string, Record<string, StoredRate>>();
  for (const src of Object.values(state.sources)) {
    for (const r of src.rates) {
      const row = map.get(r.symbol) ?? {};
      row[src.id] = r;
      map.set(r.symbol, row);
    }
  }
  return map;
}

/** Porównuje dwa stany i zwraca powiadomienia: zmiany kursów (po kantorze) i nowe „najgorsze” kursy Dorexu. */
export function diffStates(
  prev: RatesState,
  next: RatesState,
  want: { changes: boolean; worst: boolean },
): Omit<Toast, "id">[] {
  const out: Omit<Toast, "id">[] = [];

  if (want.changes) {
    for (const src of Object.values(next.sources)) {
      const before = new Map((prev.sources[src.id]?.rates ?? []).map((r) => [r.symbol, r]));
      if (before.size === 0) continue; // brak punktu odniesienia — to nie zmiana
      const lines: string[] = [];
      for (const r of src.rates) {
        const old = before.get(r.symbol);
        if (!old) continue;
        for (const kind of ["buy", "sell"] as const) {
          const a = old[kind].value;
          const b = r[kind].value;
          if (a != null && b != null && a !== b) {
            lines.push(`${r.symbol} ${KIND_LABEL[kind]}: ${fmtRate(a)} → ${fmtRate(b)}`);
          }
        }
      }
      if (lines.length) out.push({ kind: "change", title: `${src.name} zmienił kursy`, lines });
    }
  }

  if (want.worst) {
    const before = perSymbol(prev);
    const lines: string[] = [];
    for (const [symbol, row] of perSymbol(next)) {
      const old = before.get(symbol);
      if (!old) continue;
      for (const kind of ["buy", "sell"] as const) {
        if (isWorst(kind, row) && !isWorst(kind, old)) lines.push(`${symbol} — ${KIND_LABEL[kind]}`);
      }
    }
    if (lines.length) out.push({ kind: "worst", title: "Dorex najgorszy na rynku", lines });
  }

  return out;
}

let audioCtx: AudioContext | null = null;

/** Delikatny, krótki dwutonowy sygnał. Przeglądarka może go zablokować do pierwszej interakcji — wtedy cisza. */
export function playPing() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = t0 + i * 0.14;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  } catch {
    // brak dźwięku — trudno
  }
}
