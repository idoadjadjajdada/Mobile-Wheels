"use client";

import { Plus, Trash2 } from "lucide-react";
import type { SpecialHours, WeeklyPeriod } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface HoursDraft {
  regular: WeeklyPeriod[];
  special: SpecialHours[];
}

/** Weekly + special-date editor. A close time earlier than the open time means "past midnight". */
export function HoursEditor({ value, onChange }: { value: HoursDraft; onChange: (v: HoursDraft) => void }) {
  const setDay = (day: number, periods: { open: string; close: string }[]) =>
    onChange({ ...value, regular: [...value.regular.filter((p) => p.day !== day), ...periods.map((p) => ({ day, ...p }))].sort((a, b) => a.day - b.day || a.open.localeCompare(b.open)) });

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {ORDER.map((d) => {
          const periods = value.regular.filter((p) => p.day === d);
          return (
            <div key={d} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
              <span className="w-10 font-medium">{DAYS[d]}</span>
              {periods.length === 0 && <span className="text-mute">Closed</span>}
              {periods.map((p, i) => (
                <span key={i} className="flex items-center gap-1">
                  <input type="time" value={p.open} onChange={(e) => setDay(d, periods.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} className="rounded bg-white/5 px-1.5 py-1" aria-label={`${DAYS[d]} open`} />
                  –
                  <input type="time" value={p.close === "24:00" ? "00:00" : p.close} onChange={(e) => setDay(d, periods.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} className="rounded bg-white/5 px-1.5 py-1" aria-label={`${DAYS[d]} close`} />
                  {p.close <= p.open && <span className="text-[10px] text-honey">+1 day</span>}
                  <button type="button" onClick={() => setDay(d, periods.filter((_, j) => j !== i))} className="p-1 text-mute hover:text-flame" aria-label="Remove period"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              ))}
              <button type="button" onClick={() => setDay(d, [...periods, { open: "10:00", close: "22:00" }])} className="ml-auto rounded-full bg-white/5 p-1.5" aria-label={`Add period ${DAYS[d]}`}><Plus className="h-3.5 w-3.5" /></button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="text-xs text-dust underline"
        onClick={() => {
          const mon = value.regular.filter((p) => p.day === 1);
          onChange({ ...value, regular: [0, 1, 2, 3, 4, 5, 6].flatMap((day) => mon.map((p) => ({ ...p, day }))) });
        }}
      >
        Copy Monday to every day
      </button>

      <div>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-mute">Special dates (holidays, closures)</h4>
        {value.special.map((s, i) => (
          <div key={i} className="mb-1.5 flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
            <input type="date" value={s.date} onChange={(e) => onChange({ ...value, special: value.special.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })} className="rounded bg-white/5 px-1.5 py-1" />
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!s.closed} onChange={(e) => onChange({ ...value, special: value.special.map((x, j) => (j === i ? { ...x, closed: e.target.checked, periods: e.target.checked ? undefined : [{ open: "10:00", close: "18:00" }] } : x)) })} /> Closed</label>
            {!s.closed && s.periods?.map((p, k) => (
              <span key={k} className="flex items-center gap-1">
                <input type="time" value={p.open} onChange={(e) => onChange({ ...value, special: value.special.map((x, j) => (j === i ? { ...x, periods: x.periods!.map((y, m) => (m === k ? { ...y, open: e.target.value } : y)) } : x)) })} className="rounded bg-white/5 px-1.5 py-1" />–
                <input type="time" value={p.close} onChange={(e) => onChange({ ...value, special: value.special.map((x, j) => (j === i ? { ...x, periods: x.periods!.map((y, m) => (m === k ? { ...y, close: e.target.value } : y)) } : x)) })} className="rounded bg-white/5 px-1.5 py-1" />
              </span>
            ))}
            <input value={s.note ?? ""} onChange={(e) => onChange({ ...value, special: value.special.map((x, j) => (j === i ? { ...x, note: e.target.value || undefined } : x)) })} placeholder="Note" className="min-w-0 flex-1 rounded bg-white/5 px-2 py-1" />
            <button type="button" onClick={() => onChange({ ...value, special: value.special.filter((_, j) => j !== i) })} className="p-1 text-mute hover:text-flame" aria-label="Remove date"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...value, special: [...value.special, { date: new Date().toISOString().slice(0, 10), closed: true }] })} className="text-xs text-dust underline">
          Add special date
        </button>
      </div>
    </div>
  );
}
