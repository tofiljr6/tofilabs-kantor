import { HOME_SOURCE_ID } from "@/lib/home";
import { fmtDiff, fmtRate } from "@/lib/format";
import type { Options } from "@/lib/options";
import type { RatesState, StoredRate } from "@/lib/types";

export type Toast = {
  id: number;
  kind: "change" | "worst" | "alert";
  title: string;
  lines: string[];
};
type NewToast = Omit<Toast, "id">;

type Kind = "buy" | "sell";
const KINDS: Kind[] = ["buy", "sell"];
const KIND_LABEL = { buy: "kupno", sell: "sprzedaż" } as const;
const EPS = 1e-9;

/**
 * Czy Dorex ma najgorszy kurs dla klienta: nikt nie jest od nas gorszy, a ktoś jest lepszy
 * (remis wszystkich to nie „najgorszy”; remis na ostatnim miejscu — tak).
 */
export function isWorst(kind: Kind, perSource: Record<string, StoredRate>): boolean {
  const mine = perSource[HOME_SOURCE_ID]?.[kind].value;
  if (mine == null) return false;
  const values = Object.values(perSource)
    .map((r) => r[kind].value)
    .filter((v): v is number => v != null);
  const worse = values.some((v) => (kind === "buy" ? v < mine : v > mine));
  const better = values.some((v) => (kind === "buy" ? v > mine : v < mine));
  return better && !worse;
}

/** O ile zł Dorex jest gorszy od najlepszego kursu konkurencji (0, gdy nie jest gorszy). */
function lossToBest(kind: Kind, perSource: Record<string, StoredRate>): number {
  const mine = perSource[HOME_SOURCE_ID]?.[kind].value;
  if (mine == null) return 0;
  const others = Object.entries(perSource)
    .filter(([id]) => id !== HOME_SOURCE_ID)
    .map(([, r]) => r[kind].value)
    .filter((v): v is number => v != null);
  if (others.length === 0) return 0;
  const best = kind === "buy" ? Math.max(...others) : Math.min(...others);
  return Math.max(0, kind === "buy" ? best - mine : mine - best);
}

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

const inverted = (r: StoredRate | undefined) =>
  r != null && r.buy.value != null && r.sell.value != null && r.buy.value > r.sell.value + EPS;

/** Zdarzenie zmiany kursu — zbierane z `changedAt`/`prev` kolejnych stanów, żeby liczyć ruchy w oknie czasu. */
type ChangeEvent = { key: string; t: number; src: string; srcName: string; symbol: string; kind: Kind; from: number; to: number };

/** Pamięć silnika między odświeżeniami (ref w Dashboardzie). */
export type NotifyMemory = {
  events: ChangeEvent[];
  seen: Set<string>;
  /** Kiedy ostatnio pokazaliśmy dane powiadomienie (klucz → ms), żeby nie powtarzać go co 30 s. */
  cooldown: Map<string, number>;
};
export const newMemory = (): NotifyMemory => ({ events: [], seen: new Set(), cooldown: new Map() });

/** Dodaje do pamięci zmiany widoczne w stanie; zwraca tylko te, których wcześniej nie znaliśmy. */
export function collectEvents(state: RatesState, mem: NotifyMemory): ChangeEvent[] {
  const added: ChangeEvent[] = [];
  for (const src of Object.values(state.sources)) {
    for (const r of src.rates) {
      for (const kind of KINDS) {
        const side = r[kind];
        if (side.value == null || side.prev == null || !side.changedAt) continue;
        const key = `${src.id}|${r.symbol}|${kind}|${side.changedAt}`;
        if (mem.seen.has(key)) continue;
        mem.seen.add(key);
        const ev = { key, t: Date.parse(side.changedAt), src: src.id, srcName: src.name, symbol: r.symbol, kind, from: side.prev, to: side.value };
        mem.events.push(ev);
        added.push(ev);
      }
    }
  }
  // Pamięć nie rośnie w nieskończoność: zdarzenia starsze niż 4 h nikomu nie są potrzebne.
  const cutoff = Date.now() - 4 * 3600_000;
  if (mem.events.length > 2000) mem.events = mem.events.filter((e) => e.t >= cutoff);
  return added;
}

/** Zapamiętuje, że powiadomienie `key` poszło; zwraca false, jeśli jeszcze obowiązuje blokada. */
function once(mem: NotifyMemory, key: string, ms: number, now: number): boolean {
  const last = mem.cooldown.get(key);
  if (last != null && now - last < ms) return false;
  mem.cooldown.set(key, now);
  return true;
}

/**
 * Porównuje poprzedni i nowy stan i zwraca powiadomienia zgodnie z opcjami.
 * `added` — zmiany kursów, które pojawiły się dopiero w `next` (z `collectEvents`).
 */
export function detect(
  prev: RatesState,
  next: RatesState,
  added: ChangeEvent[],
  o: Options,
  mem: NotifyMemory,
  now = Date.now(),
): NewToast[] {
  const out: NewToast[] = [];
  const symbols = new Set(o.notifySymbols);
  const muted = new Set(o.mutedSources); // wyciszone kantory: ich zmiany nie dają powiadomień
  const prevRows = perSymbol(prev);
  const nextRows = perSymbol(next);

  // 1. Kantor zmienił kursy (ostatnia wartość vs poprzedni odczyt).
  if (o.notifyChanges) {
    for (const src of Object.values(next.sources)) {
      if (muted.has(src.id)) continue;
      const before = new Map((prev.sources[src.id]?.rates ?? []).map((r) => [r.symbol, r]));
      if (before.size === 0) continue; // brak punktu odniesienia
      const lines: string[] = [];
      for (const r of src.rates) {
        const old = before.get(r.symbol);
        if (!old || !symbols.has(r.symbol)) continue;
        for (const kind of KINDS) {
          const a = old[kind].value;
          const b = r[kind].value;
          if (a != null && b != null && a !== b) lines.push(`${r.symbol} ${KIND_LABEL[kind]}: ${fmtRate(a)} → ${fmtRate(b)}`);
        }
      }
      if (lines.length) out.push({ kind: "change", title: `${src.name} zmienił kursy`, lines });
    }
  }

  // 2. Dorex stał się najgorszy (czerwony wykrzyknik) / 3. strata do najlepszego kursu / 4. odwrócony spread.
  const worst: string[] = [];
  const loss: string[] = [];
  const inv: string[] = [];
  for (const [symbol, row] of nextRows) {
    const old = prevRows.get(symbol);
    if (!old || !symbols.has(symbol)) continue;
    for (const kind of KINDS) {
      if (o.notifyWorst && isWorst(kind, row) && !isWorst(kind, old)) worst.push(`${symbol} — ${KIND_LABEL[kind]}`);
      if (o.notifyLoss) {
        const now_ = lossToBest(kind, row);
        if (now_ >= o.lossThreshold - EPS && lossToBest(kind, old) < o.lossThreshold - EPS) {
          loss.push(`${symbol} ${KIND_LABEL[kind]}: o ${fmtDiff(now_)} zł gorzej niż najlepszy`);
        }
      }
    }
    if (o.notifyInverted) {
      for (const [id, r] of Object.entries(row)) {
        if (!muted.has(id) && inverted(r) && !inverted(old[id])) {
          const name = next.sources[id]?.name ?? id;
          inv.push(`${name} ${symbol}: kupno ${fmtRate(r.buy.value)} > sprzedaż ${fmtRate(r.sell.value)}`);
        }
      }
    }
  }
  if (worst.length) out.push({ kind: "worst", title: "Dorex najgorszy na rynku", lines: worst });
  if (loss.length) out.push({ kind: "alert", title: "Duża strata do najlepszego kursu", lines: loss });
  if (inv.length) out.push({ kind: "alert", title: "Odwrócony spread", lines: inv });

  // 5. Skok kursu o co najmniej próg.
  if (o.notifyJump) {
    const lines = added
      .filter((e) => symbols.has(e.symbol) && !muted.has(e.src) && Math.abs(e.to - e.from) >= o.jumpThreshold - EPS)
      .map((e) => `${e.srcName} ${e.symbol} ${KIND_LABEL[e.kind]}: ${fmtRate(e.from)} → ${fmtRate(e.to)} (${e.to > e.from ? "+" : "−"}${fmtDiff(Math.abs(e.to - e.from))})`);
    if (lines.length) out.push({ kind: "alert", title: "Duży skok kursu", lines });
  }

  // 6. Szybkie ruchy: jeden kantor zmienił ten sam kurs ≥ N razy w oknie.
  if (o.notifyFast && added.length > 0) {
    const from = now - o.fastMinutes * 60_000;
    const lines: string[] = [];
    const touched = new Set(added.filter((e) => symbols.has(e.symbol) && !muted.has(e.src)).map((e) => `${e.src}|${e.symbol}|${e.kind}`));
    for (const k of touched) {
      const evs = mem.events.filter((e) => `${e.src}|${e.symbol}|${e.kind}` === k && e.t >= from);
      if (evs.length >= o.fastCount && once(mem, `fast|${k}`, o.fastMinutes * 60_000, now)) {
        const e = evs[0];
        lines.push(`${e.srcName} ${e.symbol} ${KIND_LABEL[e.kind]}: ${evs.length} zmiany w ${o.fastMinutes} min`);
      }
    }
    if (lines.length) out.push({ kind: "alert", title: "Szybkie ruchy kursu", lines });
  }

  // 7. Wszyscy (konkurenci) ruszyli w jedną stronę w oknie.
  if (o.notifyHerd && added.length > 0) {
    const from = now - o.herdMinutes * 60_000;
    const lines: string[] = [];
    const touched = new Set(added.filter((e) => symbols.has(e.symbol) && e.src !== HOME_SOURCE_ID && !muted.has(e.src)).map((e) => `${e.symbol}|${e.kind}`));
    for (const k of touched) {
      const [symbol, kind] = k.split("|") as [string, Kind];
      const net = new Map<string, number>();
      for (const e of mem.events) {
        if (e.symbol === symbol && e.kind === kind && e.t >= from && e.src !== HOME_SOURCE_ID && !muted.has(e.src)) {
          net.set(e.src, (net.get(e.src) ?? 0) + (e.to - e.from));
        }
      }
      const ups = [...net.values()].filter((v) => v > EPS).length;
      const downs = [...net.values()].filter((v) => v < -EPS).length;
      const dir = ups >= o.herdMinSources && downs === 0 ? "w górę" : downs >= o.herdMinSources && ups === 0 ? "w dół" : null;
      if (dir && once(mem, `herd|${k}|${dir}`, o.herdMinutes * 60_000, now)) {
        lines.push(`${symbol} ${KIND_LABEL[kind]}: ${Math.max(ups, downs)} kantorów ${dir} w ${o.herdMinutes} min`);
      }
    }
    if (lines.length) out.push({ kind: "alert", title: "Wszyscy ruszyli w jedną stronę", lines });
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
