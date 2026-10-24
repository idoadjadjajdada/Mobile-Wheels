import { describe, expect, it } from "vitest";
import {
  availableLaterTonight,
  getHoursStatus,
  joinOvernight,
  normalizeOsmHours,
  weeklySchedule,
  zonedTimeToUtc,
} from "@/lib/hours";
import type { HoursSet } from "@/lib/types";

const PHX = "America/Phoenix";
const NY = "America/New_York";
const prov = { source: "manual", verification: "verified" } as const;
const set = (regular: HoursSet["regular"], special: HoursSet["special"] = []): HoursSet => ({ regular, special, provenance: prov });
const everyDay = (open: string, close: string) => [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open, close }));
// Phoenix is UTC-7 year round.
const phx = (iso: string) => new Date(`${iso}-07:00`);

describe("zonedTimeToUtc", () => {
  it("handles Phoenix (no DST)", () => {
    expect(new Date(zonedTimeToUtc(2026, 7, 4, 12, 0, PHX)).toISOString()).toBe("2026-07-04T19:00:00.000Z");
    expect(new Date(zonedTimeToUtc(2026, 1, 4, 12, 0, PHX)).toISOString()).toBe("2026-01-04T19:00:00.000Z");
  });
  it("handles New York DST both ways", () => {
    expect(new Date(zonedTimeToUtc(2026, 7, 4, 12, 0, NY)).toISOString()).toBe("2026-07-04T16:00:00.000Z");
    expect(new Date(zonedTimeToUtc(2026, 1, 4, 12, 0, NY)).toISOString()).toBe("2026-01-04T17:00:00.000Z");
    // Spring-forward gap 2026-03-08 02:30 doesn't exist → shifted to 03:30 EDT.
    expect(new Date(zonedTimeToUtc(2026, 3, 8, 2, 30, NY)).toISOString()).toBe("2026-03-08T07:30:00.000Z");
    // Fall-back 2026-11-01 01:30 is ambiguous → first occurrence (EDT).
    expect(new Date(zonedTimeToUtc(2026, 11, 1, 1, 30, NY)).toISOString()).toBe("2026-11-01T05:30:00.000Z");
    expect(new Date(zonedTimeToUtc(2026, 11, 1, 3, 0, NY)).toISOString()).toBe("2026-11-01T08:00:00.000Z");
  });
});

describe("getHoursStatus", () => {
  const lateNight = set(everyDay("10:00", "02:00"));

  it("matches the spec example: overnight close with minutes remaining", () => {
    const s = getHoursStatus(lateNight, PHX, phx("2026-10-24T01:13:00"));
    expect(s.state).toBe("open");
    expect(s.label).toBe("Open · Closes at 2:00 AM · 47 minutes remaining");
  });

  it("is open in the evening and reports hours remaining", () => {
    const s = getHoursStatus(lateNight, PHX, phx("2026-10-24T20:00:00"));
    expect(s.label).toBe("Open · Closes at 2:00 AM · 6 hr remaining");
  });

  it("flags closing soon", () => {
    expect(getHoursStatus(lateNight, PHX, phx("2026-10-24T01:45:00")).state).toBe("closing_soon");
  });

  it("reports next opening when closed", () => {
    const s = getHoursStatus(lateNight, PHX, phx("2026-10-24T03:00:00"));
    expect(s.state).toBe("closed");
    expect(s.label).toBe("Closed · Opens 10:00 AM");
    expect(s.minutesUntilOpen).toBe(420);
  });

  it("reports tomorrow / weekday for later openings", () => {
    const weekdays = set([1, 2, 3, 4, 5].map((day) => ({ day, open: "09:00", close: "17:00" })));
    // Friday 2026-10-23 18:00 → opens Mon.
    expect(getHoursStatus(weekdays, PHX, phx("2026-10-23T18:00:00")).label).toBe("Closed · Opens Mon 9:00 AM");
    // Thursday 18:00 → tomorrow.
    expect(getHoursStatus(weekdays, PHX, phx("2026-10-22T18:00:00")).label).toBe("Closed · Opens tomorrow 9:00 AM");
  });

  it("respects special closures", () => {
    const s = set(everyDay("10:00", "22:00"), [{ date: "2026-12-25", closed: true, note: "Christmas" }]);
    const st = getHoursStatus(s, PHX, phx("2026-12-25T12:00:00"));
    expect(st.state).toBe("closed");
    expect(st.label).toBe("Closed · Opens tomorrow 10:00 AM");
    expect(st.todayLabel).toBe("Closed today (Christmas)");
  });

  it("handles 24 hour places", () => {
    expect(getHoursStatus(set(everyDay("00:00", "24:00")), PHX, phx("2026-10-24T03:00:00")).label).toBe("Open 24 hours");
  });

  it("applies a kitchen cutoff", () => {
    const s = getHoursStatus(set(everyDay("10:00", "22:00")), PHX, phx("2026-10-24T21:00:00"), { cutoffMinutes: 30 });
    expect(s.label).toBe("Open · Kitchen closes at 9:30 PM · 30 minutes remaining");
    expect(getHoursStatus(set(everyDay("10:00", "22:00")), PHX, phx("2026-10-24T21:45:00"), { cutoffMinutes: 30 }).state).toBe("closed");
  });

  it("is honest about missing hours", () => {
    expect(getHoursStatus(undefined, PHX).state).toBe("unknown");
  });

  it("keeps wall-clock hours across a DST change in New York", () => {
    const s = set(everyDay("11:00", "23:00"));
    // Sunday 2026-11-01 (fall back) at 22:30 EST → 30 minutes left.
    const now = new Date("2026-11-02T03:30:00Z");
    expect(getHoursStatus(s, NY, now).label).toBe("Open · Closes at 11:00 PM · 30 minutes remaining");
  });
});

describe("later tonight", () => {
  it("detects restaurants that open for the evening", () => {
    const dinner = set(everyDay("17:00", "23:00"));
    expect(availableLaterTonight(dinner, PHX, phx("2026-10-24T13:00:00"))).toBe(true);
    const lunch = set(everyDay("10:00", "15:00"));
    expect(availableLaterTonight(lunch, PHX, phx("2026-10-24T13:00:00"))).toBe(false);
  });
});

describe("OSM normalization", () => {
  it("parses overnight and joins segments", async () => {
    const n = await normalizeOsmHours("Mo-Su 10:30-02:00");
    expect(n?.regular).toHaveLength(7);
    expect(n?.regular[0]).toEqual({ day: 0, open: "10:30", close: "02:00" });
  });

  it("parses mixed weekday rules", async () => {
    const n = await normalizeOsmHours("Mo-Th 10:00-22:00; Fr-Sa 10:00-23:00; Su off");
    expect(n?.regular.find((p) => p.day === 0)).toBeUndefined();
    expect(n?.regular.find((p) => p.day === 5)).toEqual({ day: 5, open: "10:00", close: "23:00" });
    expect(weeklySchedule(set(n!.regular))[6]).toEqual({ day: "Sunday", text: "Closed" });
  });

  it("parses 24/7", async () => {
    const n = await normalizeOsmHours("24/7");
    expect(n?.regular).toEqual([0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "00:00", close: "24:00" })));
  });

  it("derives special dates from date rules", async () => {
    const n = await normalizeOsmHours("Mo-Su 10:00-22:00; Dec 25 off", { today: { year: 2026, month: 12, day: 20 }, specialDays: 10 });
    expect(n?.special).toEqual([{ date: "2026-12-25", closed: true }]);
  });

  it("rejects garbage", async () => {
    expect(await normalizeOsmHours("whenever we feel like it")).toBeNull();
  });

  it("joinOvernight leaves full days alone", () => {
    expect(joinOvernight(everyDay("00:00", "24:00"))).toHaveLength(7);
  });
});
