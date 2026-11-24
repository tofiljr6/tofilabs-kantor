"use client";

import { useEffect, useState } from "react";
import { DEFAULT_OPTIONS, loadOptions, parseSymbols, saveOptions, type Options } from "@/lib/options";
import { playPing } from "@/lib/notify";

type NumKey = "lossThreshold" | "jumpThreshold" | "fastCount" | "fastMinutes" | "herdMinutes" | "herdMinSources";

export default function NotificationSettings({ sources }: { sources: { id: string; name: string }[] }) {
  const [o, setO] = useState<Options>(DEFAULT_OPTIONS);
  const [symbols, setSymbols] = useState(DEFAULT_OPTIONS.notifySymbols.join(", "));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = loadOptions();
    setO(loaded);
    setSymbols(loaded.notifySymbols.join(", "));
    setReady(true);
  }, []);

  // Zapisujemy od razu po każdej zmianie — przez loadOptions, żeby poprawić/odrzucić niepoprawne liczby.
  const update = (patch: Partial<Options>) => {
    const next = { ...o, ...patch };
    setO(next);
    saveOptions(next);
  };
  const num = (key: NumKey, raw: string) => {
    const v = Number(raw.replace(",", "."));
    if (Number.isFinite(v) && v > 0) update({ [key]: v } as Partial<Options>);
  };
  const toggle = (key: keyof Options, label: string, hint?: string) => (
    <label className="check">
      <input type="checkbox" checked={o[key] as boolean} onChange={(e) => update({ [key]: e.target.checked } as Partial<Options>)} />
      <span>
        {label}
        {hint && <span className="muted small"> — {hint}</span>}
      </span>
    </label>
  );
  const field = (key: NumKey, unit: string, step: number) => (
    <input
      type="number"
      className="numInput"
      min={step}
      step={step}
      defaultValue={o[key]}
      key={`${key}-${ready}`}
      onChange={(e) => num(key, e.target.value)}
      aria-label={unit}
    />
  );

  return (
    <div className={`settings${o.notifyEnabled ? "" : " off"}`}>
      <section className="card">
        <div className="settingsRow">{toggle("notifyEnabled", "Powiadomienia włączone", "główny wyłącznik wszystkich powiadomień")}</div>
      </section>

      <section className="card">
        <h2>Waluty</h2>
        <p className="muted small">Powiadomienia dotyczą tylko tych walut (symbole oddzielone przecinkami).</p>
        <input
          type="text"
          className="symbolsInput"
          value={symbols}
          onChange={(e) => {
            setSymbols(e.target.value);
            update({ notifySymbols: parseSymbols(e.target.value) });
          }}
          spellCheck={false}
          autoComplete="off"
          aria-label="Waluty"
        />
      </section>

      <section className="card">
        <h2>Kantory</h2>
        <p className="muted small">Odznacz kantora, żeby wyciszyć powiadomienia o jego zmianach (kursy, skoki, spread, ruchy).</p>
        <div className="settingsList">
          {sources.map((s) => (
            <label key={s.id} className="check">
              <input
                type="checkbox"
                checked={!o.mutedSources.includes(s.id)}
                onChange={(e) =>
                  update({ mutedSources: e.target.checked ? o.mutedSources.filter((x) => x !== s.id) : [...o.mutedSources, s.id] })
                }
              />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Zdarzenia</h2>
        <div className="settingsList">
          {toggle("notifyChanges", "Kantor zmienił kursy")}
          {toggle("notifyWorst", "Dorex najgorszy na rynku", "czerwony wykrzyknik przy walucie")}

          <div className="settingsRow">
            {toggle("notifyLoss", "Duża strata do najlepszego kursu")}
            <span className="inline">od {field("lossThreshold", "zł", 0.01)} zł</span>
          </div>
          <div className="settingsRow">
            {toggle("notifyJump", "Skok kursu")}
            <span className="inline">o co najmniej {field("jumpThreshold", "zł", 0.01)} zł naraz</span>
          </div>
          {toggle("notifyInverted", "Odwrócony spread", "kupno wyższe niż sprzedaż u któregokolwiek kantora")}
          <div className="settingsRow">
            {toggle("notifyFast", "Szybkie ruchy")}
            <span className="inline">
              {field("fastCount", "zmian", 1)} zmian kursu jednego kantora w {field("fastMinutes", "minut", 1)} min
            </span>
          </div>
          <div className="settingsRow">
            {toggle("notifyHerd", "Wszyscy ruszyli w jedną stronę", "bez Dorexu")}
            <span className="inline">
              co najmniej {field("herdMinSources", "kantorów", 1)} kantorów w {field("herdMinutes", "minut", 1)} min
            </span>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Dźwięk</h2>
        <div className="settingsRow">
          {toggle("notifySound", "Delikatny sygnał przy powiadomieniu")}
          <button type="button" className="secondary" onClick={playPing}>Odsłuchaj</button>
        </div>
      </section>

      <p className="muted small">
        Szybkie ruchy i ruch całego rynku liczą zmiany widziane od otwarcia strony (oraz ostatnią zmianę każdego
        kursu zapisaną w bazie), więc tuż po wejściu na stronę mogą jeszcze nie wykryć wszystkiego.
      </p>
    </div>
  );
}
