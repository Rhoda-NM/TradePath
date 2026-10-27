import { z } from "zod";
export const timezones = [
  "Africa/Nairobi",
  "UTC",
  "Europe/London",
  "America/New_York",
] as const;
export const weekdayTasks = [
  "Check the economic calendar",
  "Mark H4 structure and bias",
  "Define your H4 zone",
  "Assess the closed H1 candle",
  "Journal and reflect",
] as const;
export const weekendTasks = [
  "Annotate historical charts",
  "Practise position sizing",
  "Review your journal",
  "Write your weekly reflection",
] as const;
export const emotions = [
  "Calm",
  "Distracted",
  "Fatigued",
  "Pressure to recover",
] as const;
export const reasons = [
  "No qualifying setup",
  "High-impact news window",
  "Risk exceeds broker minimum",
  "Daily risk limit reached",
  "Study-only session",
] as const;
export const onboardingSchema = z
  .object({
    startDate: z.iso.date(),
    timezone: z.enum(timezones),
    availableMinutes: z.union([z.literal(60), z.literal(90), z.literal(120)]),
    capitalKes: z.number().finite().nonnegative().max(100000000).nullable(),
  })
  .strict();
export const commandSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("remarks"),
      date: z.iso.date(),
      notes: z.string().trim().max(6000),
      expectedNotes: z.string().max(6000),
    })
    .strict(),
  z
    .object({
      kind: z.literal("taskOutcome"),
      date: z.iso.date(),
      task: z.enum([...weekdayTasks, ...weekendTasks]),
      state: z.enum(["pending", "done", "skipped", "missed"]),
      reason: z.string().trim().max(500),
      revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      id: z.uuid(),
    })
    .strict()
    .superRefine((v, ctx) => {
      if (v.state === "skipped" ? v.reason.length < 10 : v.reason.length > 0)
        ctx.addIssue({
          code: "custom",
          message:
            "A skipped task needs a reason of at least 10 characters; other states use no reason.",
          path: ["reason"],
        });
    }),
  z
    .object({
      kind: z.literal("task"),
      date: z.iso.date(),
      task: z.enum([...weekdayTasks, ...weekendTasks]),
      done: z.boolean(),
      revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      id: z.uuid(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("session"),
      date: z.iso.date(),
      emotion: z.enum(emotions),
    })
    .strict(),
  z
    .object({
      kind: z.literal("decision"),
      date: z.iso.date(),
      id: z.uuid(),
      reason: z.enum(reasons),
      notes: z.string().trim().max(2000),
    })
    .strict(),
]);
export type PracticeCommand = z.infer<typeof commandSchema>;
export type Stored = {
  version: 1;
  days: Record<string, string[]>;
  decisions: { id: string; date: string; reason: string; notes: string }[];
  sessions: Record<string, string>;
  remarks: Record<string, string>;
};
export type Profile = {
  timezone: string;
  available_minutes: number;
  start_date: string;
  capital_kes: number | null;
};
export const storedSchema = z.object({
  version: z.literal(1),
  days: z.record(z.string(), z.array(z.string())),
  decisions: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      reason: z.string(),
      notes: z.string(),
    }),
  ),
  sessions: z.record(z.string(), z.string()),
  remarks: z.record(z.string(), z.string()).default({}),
});
export const empty: Stored = {
  version: 1,
  days: {},
  decisions: [],
  sessions: {},
  remarks: {},
};
export function isWeekend(date: string) {
  return [0, 6].includes(new Date(date + "T12:00:00Z").getUTCDay());
}
