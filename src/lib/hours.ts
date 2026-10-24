import type { HoursSet, HoursStatus, SpecialHours, WeeklyPeriod } from "./types";

/**
 * Hours engine. All schedules are stored as local wall-clock periods for the
 * restaurant's market timezone and expanded into absolute instants on demand,
 * which makes overnight hours, DST transitions and special dates fall out
 * naturally. Published hours describe when a business says it's open — never
 * whether a delivery platform is accepting orders.
 */

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    weekday: DAY_SHORT.indexOf(out.weekday),
  };
}

function offsetMs(utcMs: number, timeZone: string): number {
  const p = zonedParts(new Date(utcMs), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(utcMs / MIN_MS) * MIN_MS;
}

/**
 * Convert a local wall-clock time in `timeZone` to a UTC instant.
 * Non-existent times (spring-forward gap) resolve to the instant just after the gap;
 * ambiguous times (fall-back) resolve to the first occurrence.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const o1 = offsetMs(guess, timeZone);
  let result = guess - o1;
  const o2 = offsetMs(result, timeZone);
  if (o1 !== o2) {
    const alt = guess - o2;
    const p = zonedParts(new Date(alt), timeZone);
    // If the alternate offset reproduces the wall time, it's the right one.
    // Otherwise the time sits in a spring-forward gap and `result` is already shifted past it.
    if (p.hour === hour && p.minute === minute) result = alt;
  }
  return result;
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

function fmtHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function localDateKey(p: { year: number; month: number; day: number }) {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function addLocalDays(p: { year: number; month: number; day: number }, n: number) {
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() };
}

export type Interval = [start: number, end: number];

/** Expand a schedule into merged absolute intervals covering [from - 1 day, from + days]. */
export function expandIntervals(hours: HoursSet, timeZone: string, from: Date, days = 8): Interval[] {
  const base = zonedParts(from, timeZone);
  const specials = new Map<string, SpecialHours>(hours.special.map((s) => [s.date, s]));
  const raw: Interval[] = [];

  for (let i = -1; i <= days; i++) {
    const d = addLocalDays(base, i);
    const key = localDateKey(d);
    const special = specials.get(key);
    let periods: { open: string; close: string }[];
    if (special) periods = special.closed ? [] : (special.periods ?? []);
    else periods = hours.regular.filter((p) => p.day === d.weekday);

    for (const p of periods) {
      const o = parseHHMM(p.open);
      const c = parseHHMM(p.close);
      const start = zonedTimeToUtc(d.year, d.month, d.day, Math.floor(o / 60), o % 60, timeZone);
      const overnight = c <= o;
      const endDay = overnight || c >= 1440 ? addLocalDays(d, 1) : d;
      const cm = c >= 1440 ? c - 1440 : c;
      const end = zonedTimeToUtc(endDay.year, endDay.month, endDay.day, Math.floor(cm / 60), cm % 60, timeZone);
      if (end > start) raw.push([start, end]);
    }
  }

  raw.sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [];
  for (const iv of raw) {
    const last = merged[merged.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else merged.push([iv[0], iv[1]]);
  }
  return merged;
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
export function formatTime(ms: number, timeZone: string): string {
  let f = timeFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
    timeFormatters.set(timeZone, f);
  }
  return f.format(new Date(ms));
}

function formatPeriodTime(hhmm: string): string {
  let m = parseHHMM(hhmm);
  if (m >= 1440) m -= 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

function isAllDay(periods: { open: string; close: string }[]) {
  return periods.some((p) => p.open === "00:00" && (p.close === "24:00" || p.close === "00:00"));
}

export function hasHours(hours?: HoursSet): hours is HoursSet {
  return !!hours && (hours.regular.length > 0 || hours.special.length > 0);
}

export function todayPeriodsLabel(hours: HoursSet, timeZone: string, now: Date): string {
  const p = zonedParts(now, timeZone);
  const special = hours.special.find((s) => s.date === localDateKey(p));
  const periods = special ? (special.closed ? [] : (special.periods ?? [])) : hours.regular.filter((r) => r.day === p.weekday);
  if (!periods.length) return special ? `Closed today${special.note ? ` (${special.note})` : ""}` : "Closed today";
  if (isAllDay(periods)) return "Open 24 hours";
  return periods.map((r) => `${formatPeriodTime(r.open)} – ${formatPeriodTime(r.close)}`).join(", ");
}

export function getHoursStatus(
  hours: HoursSet | undefined,
  timeZone: string,
  now: Date = new Date(),
  opts: { closingSoonMinutes?: number; cutoffMinutes?: number } = {},
): HoursStatus {
  if (!hasHours(hours)) return { state: "unknown", label: "Hours not available" };
  const closingSoon = opts.closingSoonMinutes ?? 30;
  const cutoff = opts.cutoffMinutes ?? 0;
  const t = now.getTime();
  const intervals = expandIntervals(hours, timeZone, now, 8);
  const todayLabel = todayPeriodsLabel(hours, timeZone, now);

  const current = intervals.find(([s, e]) => s <= t && t < e - cutoff * MIN_MS);
  if (current) {
    const horizon = t + 7 * DAY_MS;
    if (current[1] >= horizon) {
      return { state: "open", label: "Open 24 hours", todayLabel };
    }
    const effectiveEnd = current[1] - cutoff * MIN_MS;
    const minutesUntilClose = Math.max(0, Math.floor((effectiveEnd - t) / MIN_MS));
    const closesAt = formatTime(current[1], timeZone);
    const verb = cutoff ? `Kitchen closes at ${formatTime(effectiveEnd, timeZone)}` : `Closes at ${closesAt}`;
    return {
      state: minutesUntilClose <= closingSoon ? "closing_soon" : "open",
      label: `Open · ${verb} · ${formatDuration(minutesUntilClose)} remaining`,
      minutesUntilClose,
      closesAt,
      todayLabel,
    };
  }

  const next = intervals.find(([s]) => s > t);
  if (!next) return { state: "closed", label: "Closed · no upcoming hours listed", todayLabel };
  const minutesUntilOpen = Math.ceil((next[0] - t) / MIN_MS);
  const nowP = zonedParts(now, timeZone);
  const nextP = zonedParts(new Date(next[0]), timeZone);
  const dayDiff = Math.round(
    (Date.UTC(nextP.year, nextP.month - 1, nextP.day) - Date.UTC(nowP.year, nowP.month - 1, nowP.day)) / DAY_MS,
  );
  const when = dayDiff === 0 ? "" : dayDiff === 1 ? "tomorrow " : `${DAY_SHORT[nextP.weekday]} `;
  const opensAt = `${when}${formatTime(next[0], timeZone)}`;
  return { state: "closed", label: `Closed · Opens ${opensAt}`, minutesUntilOpen, opensAt, todayLabel };
}

/** True if the schedule has any open time overlapping [startMs, endMs). */
export function openDuring(hours: HoursSet | undefined, timeZone: string, startMs: number, endMs: number): boolean {
  if (!hasHours(hours)) return false;
  return expandIntervals(hours, timeZone, new Date(startMs), 2).some(([s, e]) => s < endMs && e > startMs);
}

/** "Later tonight": open at some point between now+30m and 2 AM local. */
export function availableLaterTonight(hours: HoursSet | undefined, timeZone: string, now: Date = new Date()): boolean {
  const p = zonedParts(now, timeZone);
  const base = p.hour < 4 ? addLocalDays(p, -1) : p;
  const twoAm = addLocalDays(base, 1);
  const end = zonedTimeToUtc(twoAm.year, twoAm.month, twoAm.day, 2, 0, timeZone);
  const start = Math.max(now.getTime() + 30 * MIN_MS, zonedTimeToUtc(base.year, base.month, base.day, 18, 0, timeZone));
  return start < end && openDuring(hours, timeZone, start, end);
}

export function weeklySchedule(hours: HoursSet | undefined): { day: string; text: string }[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((d) => {
    const periods = hours?.regular.filter((p) => p.day === d) ?? [];
    const text = !hasHours(hours)
      ? "Not available"
      : !periods.length
        ? "Closed"
        : isAllDay(periods)
          ? "Open 24 hours"
          : periods.map((p) => `${formatPeriodTime(p.open)} – ${formatPeriodTime(p.close)}`).join(", ");
    return { day: DAY_NAMES[d], text };
  });
}

export function upcomingSpecialHours(hours: HoursSet | undefined, timeZone: string, now = new Date(), days = 21) {
  if (!hours) return [];
  const today = localDateKey(zonedParts(now, timeZone));
  const last = localDateKey(addLocalDays(zonedParts(now, timeZone), days));
  return hours.special
    .filter((s) => s.date >= today && s.date <= last)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({
      date: s.date,
      text: s.closed
        ? "Closed"
        : (s.periods ?? []).map((p) => `${formatPeriodTime(p.open)} – ${formatPeriodTime(p.close)}`).join(", "),
      note: s.note,
    }));
}

// ---------- Normalization from OpenStreetMap `opening_hours` ----------

type OHCtor = new (
  value: string,
  nominatim?: object | null,
  optionalConf?: object,
) => { getOpenIntervals(from: Date, to: Date): [Date, Date, boolean, string | undefined][] };

/**
 * Convert an OSM opening_hours string into weekly periods plus special dates for
 * the next `specialDays` days (holidays, `Dec 25 off`, etc.).
 *
 * The opening_hours library evaluates in the host's local time, so we work in
 * "floating" wall-clock dates (local getters only) and never mix in real instants.
 */
export async function normalizeOsmHours(
  raw: string,
  opts: { countryCode?: string; state?: string; lat?: number; lng?: number; today?: { year: number; month: number; day: number }; specialDays?: number } = {},
): Promise<{ regular: WeeklyPeriod[]; special: SpecialHours[] } | null> {
  const mod = (await import("opening_hours")) as unknown as { default?: OHCtor } & OHCtor;
  const OpeningHours: OHCtor = mod.default ?? mod;
  let oh: InstanceType<OHCtor>;
  try {
    oh = new OpeningHours(raw, {
      lat: opts.lat ?? 32.22,
      lon: opts.lng ?? -110.97,
      address: { country_code: opts.countryCode ?? "us", state: opts.state ?? "Arizona" },
    });
  } catch {
    return null;
  }

  const periodsForDay = (y: number, m: number, d: number) => {
    const start = new Date(y, m - 1, d, 0, 0);
    const end = new Date(y, m - 1, d + 1, 0, 0);
    return oh
      .getOpenIntervals(start, end)
      .map(([s, e]) => ({
        open: fmtHHMM(s.getHours() * 60 + s.getMinutes()),
        close: e.getTime() >= end.getTime() ? "24:00" : fmtHHMM(e.getHours() * 60 + e.getMinutes()),
      }));
  };

  // Reference week without DST changes or common holidays: Sun 2025-03-02 … Sat 2025-03-08.
  const segs: { day: number; open: string; close: string }[] = [];
  for (let i = 0; i < 7; i++) for (const p of periodsForDay(2025, 3, 2 + i)) segs.push({ day: i, ...p });
  const regular = joinOvernight(segs);

  const special: SpecialHours[] = [];
  const today = opts.today;
  const span = opts.specialDays ?? 60;
  if (today) {
    for (let i = 0; i < span; i++) {
      const d = new Date(today.year, today.month - 1, today.day + i);
      const actual = periodsForDay(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const expected = segs.filter((s) => s.day === d.getDay()).map(({ open, close }) => ({ open, close }));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        const date = localDateKey({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
        special.push(actual.length ? { date, periods: actual } : { date, closed: true });
      }
    }
  }
  return { regular, special };
}

/** Join "Sat 22:00–24:00" + "Sun 00:00–02:00" into "Sat 22:00–02:00". */
export function joinOvernight(segs: WeeklyPeriod[]): WeeklyPeriod[] {
  const out = segs.map((s) => ({ ...s }));
  const remove = new Set<number>();
  out.forEach((s) => {
    if (s.close !== "24:00" || s.open === "00:00") return;
    const nextDay = (s.day + 1) % 7;
    const j = out.findIndex((t, k) => !remove.has(k) && t.day === nextDay && t.open === "00:00" && t.close !== "24:00");
    if (j >= 0) {
      s.close = out[j].close;
      remove.add(j);
    }
  });
  return out.filter((_, i) => !remove.has(i)).sort((a, b) => a.day - b.day || a.open.localeCompare(b.open));
}
