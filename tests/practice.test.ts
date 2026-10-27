import { describe, it, expect } from "vitest";
import {
  commandSchema,
  onboardingSchema,
  isWeekend,
} from "../src/lib/practice/model";
describe("practice mutation contracts", () => {
  it("rejects forged ownership and arbitrary fields", () =>
    expect(
      commandSchema.safeParse({
        kind: "task",
        date: "2026-10-26",
        task: "Check the economic calendar",
        done: true,
        revision: 0,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        user_id: "someone-else",
      }).success,
    ).toBe(false));
  it("rejects unknown tasks and invalid dates", () => {
    expect(
      commandSchema.safeParse({
        kind: "task",
        date: "2026-02-30",
        task: "Check the economic calendar",
        done: true,
        revision: 0,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        kind: "task",
        date: "2026-10-26",
        task: "Make a profit",
        done: true,
        revision: 0,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }).success,
    ).toBe(false);
  });
  it("requires an idempotency identifier for no-trade decisions", () =>
    expect(
      commandSchema.safeParse({
        kind: "decision",
        date: "2026-10-26",
        reason: "No qualifying setup",
        notes: "",
      }).success,
    ).toBe(false));
  it("validates and trims decision notes", () =>
    expect(
      commandSchema.parse({
        kind: "decision",
        date: "2026-10-26",
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        reason: "No qualifying setup",
        notes: " Observed only ",
      }),
    ).toMatchObject({ kind: "decision", notes: "Observed only" }));
  it("rejects notes above the storage limit", () =>
    expect(
      commandSchema.safeParse({
        kind: "decision",
        date: "2026-10-26",
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        reason: "No qualifying setup",
        notes: "x".repeat(2001),
      }).success,
    ).toBe(false));
  it("does not accept an arbitrary check-in status", () =>
    expect(
      commandSchema.safeParse({
        kind: "session",
        date: "2026-10-26",
        emotion: "Calm",
        status: "eligible",
      }).success,
    ).toBe(false));
  it("uses calendar-day weekend templates", () => {
    expect(isWeekend("2026-10-31")).toBe(true);
    expect(isWeekend("2026-11-01")).toBe(true);
    expect(isWeekend("2026-10-26")).toBe(false);
  });
});
describe("onboarding validation", () => {
  const base = {
    startDate: "2026-10-26",
    timezone: "Africa/Nairobi",
    availableMinutes: 90,
    capitalKes: null,
  };
  it("accepts optional capital and supported schedules", () =>
    expect(onboardingSchema.parse(base)).toEqual(base));
  it("rejects unsupported timezone, budget and nonfinite capital", () => {
    for (const change of [
      { timezone: "Invalid/City" },
      { availableMinutes: 7 },
      { capitalKes: Infinity },
      { capitalKes: -1 },
      { mode: "live" },
    ])
      expect(onboardingSchema.safeParse({ ...base, ...change }).success).toBe(
        false,
      );
  });
});
