// Opcje użytkownika zapisywane w localStorage przeglądarki (wspólne dla dashboardu i strony powiadomień).

export type ChangeWindow = "last" | "5" | "10" | "15" | "30" | "60" | "all";
export const WINDOW_OPTIONS: { value: ChangeWindow; label: string }[] = [
  { value: "last", label: "od ostatniej aktualizacji" },
  { value: "5", label: "ostatnie 5 min" },
  { value: "10", label: "ostatnie 10 min" },
  { value: "15", label: "ostatnie 15 min" },
  { value: "30", label: "ostatnie 30 min" },
  { value: "60", label: "ostatnia 1 godzina" },
  { value: "all", label: "bez limitu" },
];

export type Options = {
  changeWindow: ChangeWindow;
  showBeat: boolean;
  /** Główny wyłącznik wszystkich powiadomień. */
  notifyEnabled: boolean;
  /** Waluty, których dotyczą powiadomienia. */
  notifySymbols: string[];
  /** Kantory, których zmian NIE zgłaszamy (id źródeł). */
  mutedSources: string[];
  notifySound: boolean;
  notifyChanges: boolean; // kantor zmienił kursy
  notifyWorst: boolean; // Dorex najgorszy (czerwony wykrzyknik)
  notifyLoss: boolean; // duża strata do najlepszego kursu
  lossThreshold: number; // zł
  notifyJump: boolean; // skok kursu
  jumpThreshold: number; // zł
  notifyInverted: boolean; // odwrócony spread (kupno > sprzedaż)
  notifyFast: boolean; // szybkie ruchy jednego kantora
  fastCount: number; // tyle zmian…
  fastMinutes: number; // …w tylu minutach
  notifyHerd: boolean; // wszyscy ruszyli w jedną stronę
  herdMinutes: number;
  herdMinSources: number;
};

export const DEFAULT_OPTIONS: Options = {
  changeWindow: "last",
  showBeat: true,
  notifyEnabled: true,
  notifySymbols: ["EUR", "USD", "CHF", "GBP", "CZK"],
  mutedSources: ["tavex-olawska"],
  notifySound: true,
  notifyChanges: true,
  notifyWorst: true,
  notifyLoss: true,
  lossThreshold: 0.05,
  notifyJump: true,
  jumpThreshold: 0.1,
  notifyInverted: true,
  notifyFast: true,
  fastCount: 3,
  fastMinutes: 15,
  notifyHerd: true,
  herdMinutes: 15,
  herdMinSources: 3,
};

export const OPTIONS_KEY = "kantor.options.v2";

const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const numIn = (v: unknown, d: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

export function parseSymbols(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
}

export function loadOptions(): Options {
  const d = DEFAULT_OPTIONS;
  try {
    const raw = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? "null");
    if (raw && typeof raw === "object") {
      return {
        changeWindow: WINDOW_OPTIONS.some((o) => o.value === raw.changeWindow) ? raw.changeWindow : d.changeWindow,
        showBeat: bool(raw.showBeat, d.showBeat),
        notifyEnabled: bool(raw.notifyEnabled, d.notifyEnabled),
        notifySymbols:
          Array.isArray(raw.notifySymbols) && raw.notifySymbols.every((s: unknown) => typeof s === "string")
            ? raw.notifySymbols
            : d.notifySymbols,
        mutedSources:
          Array.isArray(raw.mutedSources) && raw.mutedSources.every((s: unknown) => typeof s === "string")
            ? raw.mutedSources
            : d.mutedSources,
        notifySound: bool(raw.notifySound, d.notifySound),
        notifyChanges: bool(raw.notifyChanges, d.notifyChanges),
        notifyWorst: bool(raw.notifyWorst, d.notifyWorst),
        notifyLoss: bool(raw.notifyLoss, d.notifyLoss),
        lossThreshold: numIn(raw.lossThreshold, d.lossThreshold, 0.0001, 100),
        notifyJump: bool(raw.notifyJump, d.notifyJump),
        jumpThreshold: numIn(raw.jumpThreshold, d.jumpThreshold, 0.0001, 100),
        notifyInverted: bool(raw.notifyInverted, d.notifyInverted),
        notifyFast: bool(raw.notifyFast, d.notifyFast),
        fastCount: Math.round(numIn(raw.fastCount, d.fastCount, 2, 50)),
        fastMinutes: Math.round(numIn(raw.fastMinutes, d.fastMinutes, 1, 240)),
        notifyHerd: bool(raw.notifyHerd, d.notifyHerd),
        herdMinutes: Math.round(numIn(raw.herdMinutes, d.herdMinutes, 1, 240)),
        herdMinSources: Math.round(numIn(raw.herdMinSources, d.herdMinSources, 2, 20)),
      };
    }
  } catch {
    // brak dostępu do localStorage — zostają domyślne
  }
  return d;
}

export function saveOptions(o: Options) {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(o));
  } catch {
    // nie zapisze się między wizytami — trudno
  }
}
