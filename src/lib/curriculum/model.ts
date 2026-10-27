import { z } from "zod";
import catalog from "@/content/lessons.json";
import { riskSchema } from "@/lib/trading";
export const lessons = catalog;
export type Lesson = (typeof catalog)[number];
export const lessonCodes = catalog.map((l) => l.code);
const date = z.iso.date();
export const evidenceSchema = z
  .object({
    id: z.uuid(),
    lessonCode: z.string().refine((v) => lessonCodes.includes(v)),
    observedOn: date,
    notes: z.string().trim().min(80).max(6000),
    details: z.record(z.string(), z.unknown()),
  })
  .strict()
  .superRefine((v, ctx) => {
    const lesson = catalog.find((l) => l.code === v.lessonCode);
    if (
      lesson?.evidence_kind === "risk" &&
      !riskSchema.safeParse(v.details).success
    )
      ctx.addIssue({
        code: "custom",
        message: "Complete the risk exercise inputs.",
        path: ["details"],
      });
    if (lesson?.evidence_kind === "chart") {
      const result = z
        .object({
          symbol: z.literal("EURUSD"),
          timeframe: z.enum(["H4", "H1"]),
          chartTime: z.iso.datetime({ offset: true }),
        })
        .strict()
        .safeParse(v.details);
      if (!result.success)
        ctx.addIssue({
          code: "custom",
          message: "Include the chart timestamp and timeframe.",
          path: ["details"],
        });
    }
    if (
      ["plan", "reflection"].includes(lesson?.evidence_kind || "") &&
      Object.keys(v.details).length
    )
      ctx.addIssue({
        code: "custom",
        message: "Unexpected evidence details.",
        path: ["details"],
      });
  });
export const reviewSchema = z
  .object({
    week: date,
    reflection: z.string().trim().max(6000),
    commitment: z.string().trim().max(1000),
    submit: z.boolean(),
    revision: z.number().int().nonnegative(),
    id: z.uuid(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (weekStart(v.week) !== v.week)
      ctx.addIssue({
        code: "custom",
        message: "Week must start on Monday.",
        path: ["week"],
      });
    if (v.submit && (v.reflection.length < 80 || v.commitment.length < 10))
      ctx.addIssue({
        code: "custom",
        message:
          "Add a reflection of at least 80 characters and a concrete commitment of at least 10 characters.",
      });
  });
export function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function weekStart(date: string) {
  const d = new Date(date + "T12:00:00Z");
  return addDays(date, -((d.getUTCDay() + 6) % 7));
}
export type Evidence = {
  id: string;
  lesson_code: string;
  observed_on: string;
  notes: string;
  details: Record<string, unknown>;
  backdated: boolean;
  created_at: string;
};
export type LearningPhase = {
  phase_number: number;
  planned_start: string;
  planned_end: string;
  state: string;
};
export type Learning =
  | {
      ready: true;
      journalEvidence?: {
        development: number;
        held_out: number;
        development_results: number;
        held_out_results: number;
        frozen: boolean;
        forward_accounts: {
          account_ref: string;
          closed_trades: number;
          prechecked_trades: number;
        }[];
      };
      lessons: Lesson[];
      evidence: Evidence[];
      phases: LearningPhase[];
    }
  | { ready: false; message: string };
export type ReviewFacts = {
  journal_accounts?: {
    mode: string;
    account_ref: string;
    closed: number;
    r_sample: number;
    net_usd: number | null;
    eligible_average_r: number | null;
    eligible_r_sample: number;
    breaches: number;
  }[];
  weekday_sessions_due: number;
  recorded_sessions: number;
  setups_inspected: number;
  no_trade_decisions: number;
  rule_breaches: number;
  closed_demo_trades: number;
  realised_r: number | null;
  learning_records: number;
};
export type WeeklyReview = {
  week_start_local_date: string;
  reflection: string | null;
  commitment: string | null;
  reviewed_at: string | null;
  revision: number;
  state: string;
  facts: ReviewFacts;
};
export type ReviewData =
  | {
      ready: true;
      week: string;
      facts: ReviewFacts;
      review: WeeklyReview | null;
    }
  | { ready: false; message: string };
export const phaseNames = [
  "Foundations",
  "Historical testing",
  "Forward practice",
  "Consistency",
  "Free simulations",
  "Independent review",
];
export const additionalGates = [
  "",
  "Requires 70 validated development candidates, 30 untouched held-out candidates and a frozen rule version. Counts come from immutable journal evaluations; both datasets need recorded after-cost results.",
  "Requires validated forward demo records, risk prechecks and weekly reviews. There is no trade-volume target for a particular day.",
  "Requires 50 genuine forward demo records, positive after-cost average R, at least 90% adherence and measured equity drawdown below 5%.",
  "Requires two documented free evaluations without breaches. The evaluation simulator is a later release.",
  "Requires a full evidence audit and independent affordability, identity and payout-terms review.",
];
