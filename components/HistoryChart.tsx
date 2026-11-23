"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDateTime, fmtDay, fmtHour, fmtRate, tzOffset } from "@/lib/format";
import type { HistoryPoint } from "@/lib/types";

type Props = {
  points: HistoryPoint[];
  from: string;
  to: string;
  /** Do kiedy rysować ostatni kurs (domyślnie `to`). */
  until?: string;
  height?: number;
  compact?: boolean;
  /** false = legenda rysowana wyżej (np. raz dla kilku wykresów) */
  legend?: boolean;
};

export const SERIES = [
  { key: "buy", label: "Kupuje", cls: "buy" },
  { key: "sell", label: "Sprzedaje", cls: "sell" },
] as const;

function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

function timeTicks(from: number, to: number, maxTicks: number): number[] {
  const H = 3600_000;
  const steps = [H, 2 * H, 3 * H, 6 * H, 12 * H, 24 * H, 48 * H, 7 * 24 * H];
  const step = steps.find((s) => (to - from) / s <= maxTicks) ?? steps[steps.length - 1];
  // wyrównanie do pełnych godzin/dób czasu warszawskiego (identycznie na serwerze i w przeglądarce)
  const off = tzOffset(from);
  let t = Math.ceil((from + off) / step) * step - off;
  const out: number[] = [];
  for (; t <= to; t += step) out.push(t);
  return out;
}

/** Kurs obowiązujący w chwili t (ostatnia zmiana <= t). */
function valueAt(points: HistoryPoint[], t: number): HistoryPoint | null {
  let cur: HistoryPoint | null = null;
  for (const p of points) {
    if (Date.parse(p.t) <= t) cur = p;
    else break;
  }
  return cur;
}

export default function HistoryChart({ points, from, to, until, height = 260, compact = false, legend = true }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hoverT, setHoverT] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const t0 = Date.parse(from);
  const t1 = Date.parse(to);
  const tEnd = Math.max(t0, Math.min(t1, until ? Date.parse(until) : t1));
  const pad = compact
    ? { top: 8, right: 8, bottom: 20, left: 52 }
    : { top: 12, right: 16, bottom: 28, left: 64 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;

  const { yMin, yMax, yTicks } = useMemo(() => {
    const vals = points.flatMap((p) => [p.buy, p.sell]).filter((v): v is number => v != null);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (!Number.isFinite(lo)) return { yMin: 0, yMax: 1, yTicks: [0, 1] };
    const span = hi - lo || Math.abs(hi) * 0.01 || 1;
    lo -= span * 0.15;
    hi += span * 0.15;
    const ticks = niceTicks(lo, hi, compact ? 3 : 5);
    return { yMin: Math.min(lo, ticks[0]), yMax: Math.max(hi, ticks[ticks.length - 1]), yTicks: ticks };
  }, [points, compact]);

  const x = (t: number) => pad.left + ((Math.min(Math.max(t, t0), t1) - t0) / (t1 - t0)) * iw;
  const y = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * ih;

  // Linia schodkowa: kurs obowiązuje do następnej zmiany, a ostatni — do "teraz".
  const path = (key: "buy" | "sell") => {
    let d = "";
    let prevY: number | null = null;
    points.forEach((p, i) => {
      const v = p[key];
      if (v == null) {
        prevY = null;
        return;
      }
      const px = x(Date.parse(p.t));
      const py = y(v);
      d += prevY == null ? `M${px},${py}` : `H${px}V${py}`;
      prevY = py;
      if (i === points.length - 1) d += `H${x(tEnd)}`;
    });
    return d;
  };

  const xTicks = timeTicks(t0, t1, Math.max(2, Math.floor(iw / (compact ? 70 : 90))));
  const multiDay = t1 - t0 > 26 * 3600_000;
  const fmtTick = (t: number) => (multiDay ? fmtDay(t) : fmtHour(t));

  const hover = hoverT != null ? valueAt(points, hoverT) : null;
  const firstT = points.length ? Date.parse(points[0].t) : t1;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - rect.left) / rect.width) * (t1 - t0);
    setHoverT(t >= firstT && t <= tEnd ? t : null);
  };

  const tipLeft = hoverT != null ? x(hoverT) : 0;
  const tipOnLeft = tipLeft > width / 2;

  return (
    <div className={`chart ${compact ? "compact" : ""}`} ref={wrapRef}>
      {legend && <Legend />}
      <div className="plot">
        <svg width={width} height={height} role="img" aria-label="Wykres kursu kupna i sprzedaży">
          {yTicks.map((v) => (
            <g key={v}>
              <line className="grid" x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} />
              <text className="axis" x={pad.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">
                {v.toLocaleString("pl-PL", { maximumFractionDigits: 5 })}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} className="axis" x={x(t)} y={height - 6} textAnchor="middle">
              {fmtTick(t)}
            </text>
          ))}
          <line className="baseline" x1={pad.left} x2={width - pad.right} y1={pad.top + ih} y2={pad.top + ih} />

          {SERIES.map((s) => (
            <path key={s.key} className={`line ${s.cls}`} d={path(s.key)} />
          ))}

          {hover && hoverT != null && (
            <g>
              <line className="crosshair" x1={x(hoverT)} x2={x(hoverT)} y1={pad.top} y2={pad.top + ih} />
              {SERIES.map((s) =>
                hover[s.key] != null ? (
                  <circle key={s.key} className={`dot ${s.cls}`} cx={x(hoverT)} cy={y(hover[s.key]!)} r={4} />
                ) : null,
              )}
            </g>
          )}
          <rect
            x={pad.left}
            y={pad.top}
            width={iw}
            height={ih}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHoverT(null)}
          />
        </svg>
        {hover && hoverT != null && (
          <div
            className="tooltip"
            style={{
              left: tipOnLeft ? undefined : tipLeft + 12,
              right: tipOnLeft ? width - tipLeft + 12 : undefined,
              top: pad.top,
            }}
          >
            <div className="tipTime">
              {fmtDateTime(hoverT)}
            </div>
            {SERIES.map((s) => (
              <div key={s.key} className="tipRow">
                <span className={`swatch ${s.cls}`} />
                <span>{s.label}</span>
                <strong>{fmtRate(hover[s.key])}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend">
      {SERIES.map((s) => (
        <span key={s.key} className="legendItem">
          <span className={`swatch ${s.cls}`} /> {s.label}
        </span>
      ))}
    </div>
  );
}
