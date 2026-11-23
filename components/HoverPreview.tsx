"use client";

import { useEffect, useState } from "react";
import HistoryChart, { Legend } from "./HistoryChart";
import type { CurrencyHistory } from "@/lib/types";

// Pamięć podręczna po stronie klienta (60 s), żeby kolejne najechania nie odpytywały API.
const cache = new Map<string, { at: number; data: CurrencyHistory | null }>();

async function fetchHistory(symbol: string): Promise<CurrencyHistory | null> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < 60_000) return hit.data;
  const res = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}`);
  const data = res.ok ? ((await res.json()) as CurrencyHistory) : null;
  cache.set(symbol, { at: Date.now(), data });
  return data;
}

export type Anchor = { symbol: string; rect: DOMRect };

export default function HoverPreview({ anchor }: { anchor: Anchor }) {
  const [data, setData] = useState<CurrencyHistory | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setData(undefined);
    fetchHistory(anchor.symbol).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [anchor.symbol]);

  // Siatka: 1 kolumna dla 1 kantoru, 2 dla więcej; ~118 px wysokości na wiersz wykresów
  const n = data?.sources.length ?? 1;
  const cols = n > 1 ? 2 : 1;
  const W = cols === 1 ? 380 : 620;
  const estHeight = 44 + Math.ceil(n / cols) * 118;
  const left = Math.min(anchor.rect.right + 12, window.innerWidth - W - 12);
  const top = Math.max(12, Math.min(anchor.rect.top - 20, window.innerHeight - estHeight - 12));

  return (
    <div className="preview" style={{ left, top, width: W }}>
      <div className="previewHead">
        <strong>{anchor.symbol}</strong> <span className="muted small">· dziś 7:00–22:00 · kliknij, by otworzyć</span>
        <Legend />
      </div>
      {data === undefined && <p className="muted small">Ładuję…</p>}
      {data === null && <p className="muted small">Brak historii.</p>}
      <div className="previewGrid">
        {data?.sources.map((s) => (
          <div key={s.id} className="previewSource">
            <div className="small">{s.name}</div>
            <HistoryChart points={s.points} from={data.from} to={data.to} until={data.until} height={80} compact legend={false} />
          </div>
        ))}
      </div>
    </div>
  );
}
