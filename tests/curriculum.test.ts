import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  evidenceSchema,
  reviewSchema,
  weekStart,
  lessons,
} from "../src/lib/curriculum/model";
import { localDate } from "../src/lib/trading";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const notes =
  "I documented the practice rules, time budget, risk limit and valid reasons to sit out before considering any demo execution.";
describe("learning contracts", () => {
  it("has four weekly lessons per phase and the specified foundation counts", () => {
    for (let phase = 1; phase <= 6; phase++)
      expect(lessons.filter((l) => l.phase_number === phase)).toHaveLength(4);
    expect(
      lessons
        .filter((l) => l.phase_number === 1 && l.evidence_kind === "chart")
        .reduce((sum, l) => sum + l.required_count, 0),
    ).toBe(20);
    expect(lessons.find((l) => l.code === "p1-w2")?.required_count).toBe(10);
  });
  it("accepts a written plan but rejects owner fields or count overrides", () => {
    const value = {
      id,
      lessonCode: "p1-w1",
      observedOn: "2026-10-27",
      notes,
      details: {},
    };
    expect(evidenceSchema.safeParse(value).success).toBe(true);
    expect(
      evidenceSchema.safeParse({ ...value, user_id: "victim" }).success,
    ).toBe(false);
    expect(evidenceSchema.safeParse({ ...value, quantity: 100 }).success).toBe(
      false,
    );
  });
  it("requires chart context and a timestamp with timezone", () => {
    const value = {
      id,
      lessonCode: "p1-w3",
      observedOn: "2026-10-27",
      notes,
      details: {},
    };
    expect(evidenceSchema.safeParse(value).success).toBe(false);
    expect(
      evidenceSchema.safeParse({
        ...value,
        details: {
          symbol: "EURUSD",
          timeframe: "H4",
          chartTime: "2026-10-20T12:00:00+03:00",
        },
      }).success,
    ).toBe(true);
  });
  it("validates risk orientation before evidence can be saved", () => {
    const details = {
      balance: 10000,
      currency: "KES",
      rate: 129.89,
      side: "buy",
      entry: 1.08,
      stop: 1.082,
      riskPercent: 0.5,
      pipCost: 1,
      commission: 0,
      minLot: 0.01,
      lotStep: 0.01,
    };
    expect(
      evidenceSchema.safeParse({
        id,
        lessonCode: "p1-w2",
        observedOn: "2026-10-27",
        notes,
        details,
      }).success,
    ).toBe(false);
  });
  it("rejects unknown lessons and impossible dates", () => {
    expect(
      evidenceSchema.safeParse({
        id,
        lessonCode: "fake",
        observedOn: "2026-02-30",
        notes,
        details: {},
      }).success,
    ).toBe(false);
  });
});
describe("reviews", () => {
  it("supports drafts without manufacturing a submitted reflection", () =>
    expect(
      reviewSchema.safeParse({
        id,
        week: "2026-10-26",
        reflection: "",
        commitment: "",
        revision: 0,
        submit: false,
      }).success,
    ).toBe(true));
  it("requires reflection and a commitment for submission", () =>
    expect(
      reviewSchema.safeParse({
        id,
        week: "2026-10-26",
        reflection: "",
        commitment: "",
        revision: 0,
        submit: true,
      }).success,
    ).toBe(false));
  it("rejects non-Monday weeks and spoofed summary facts", () => {
    expect(
      reviewSchema.safeParse({
        id,
        week: "2026-10-27",
        reflection: notes,
        commitment: "Annotate one historical chart.",
        revision: 0,
        submit: true,
      }).success,
    ).toBe(false);
    expect(
      reviewSchema.safeParse({
        id,
        week: "2026-10-26",
        reflection: notes,
        commitment: "Annotate one historical chart.",
        revision: 0,
        submit: true,
        facts: { realised_r: 999 },
      }).success,
    ).toBe(false);
  });
  it("uses Mon–Sun Nairobi boundaries, including year rollover", () => {
    expect(
      weekStart(localDate(new Date("2026-11-01T20:59:59Z"), "Africa/Nairobi")),
    ).toBe("2026-10-26");
    expect(
      weekStart(localDate(new Date("2026-11-01T21:00:00Z"), "Africa/Nairobi")),
    ).toBe("2026-11-02");
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
  });
});

it("keeps the database lesson seed in sync with the application catalogue", () => {
  const sql = readFileSync(
    "supabase/migrations/202610270004_curriculum_reviews.sql",
    "utf8",
  );
  const match = sql.match(/\$catalog\$([\s\S]*?)\$catalog\$/);
  expect(match).toBeTruthy();
  expect(JSON.parse(match![1])).toEqual(lessons);
});
