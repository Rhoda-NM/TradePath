import { journalWorkspace } from "@/lib/journal/server";
import { tradesCSV } from "@/lib/journal/csv";
import { authConfig } from "@/lib/auth/config";
import { serverClient } from "@/lib/auth/server";
import { accountWorkspace } from "@/lib/practice/server";
import { curriculumWorkspace } from "@/lib/curriculum/server";
import { collectRows } from "@/lib/practice/pagination";
export async function GET(request?: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!authConfig())
    return Response.json(
      { error: "Account storage is not configured." },
      { status: 503, headers },
    );
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    return Response.json(
      { error: "Sign in before exporting." },
      { status: 401, headers },
    );
  try {
    const [practice, learning, reviews, journal, gates, audit, equity] =
      await Promise.all([
        accountWorkspace(),
        curriculumWorkspace(),
        collectRows((from, to) =>
          client
            .from("weekly_reviews")
            .select(
              "week_start_local_date,reflection,commitment,facts,state,reviewed_at,revision,created_at,updated_at",
            )
            .eq("user_id", user.id)
            .order("week_start_local_date")
            .range(from, to),
        ),
        journalWorkspace(),
        collectRows((from, to) =>
          client
            .from("gate_evaluations")
            .select(
              "id,setup_id,evaluated_at,rules_version,state,reasons,inputs_hash",
            )
            .eq("user_id", user.id)
            .order("id")
            .range(from, to),
        ),
        collectRows((from, to) =>
          client
            .from("audit_events")
            .select(
              "id,entity_type,entity_id,verb,before_hash,after_jsonb,occurred_at",
            )
            .eq("user_id", user.id)
            .order("id")
            .range(from, to),
        ),
        collectRows((from, to) =>
          client
            .from("equity_snapshots")
            .select(
              "id,account_mode,account_ref,at,balance_usd,equity_usd,deposits_usd,withdrawals_usd,cashflows_confirmed,notes,revision,created_at",
            )
            .eq("user_id", user.id)
            .order("at")
            .order("id")
            .range(from, to),
        ),
      ]);
    if (!journal.ready || gates.error || audit.error || equity.error)
      throw new Error("Incomplete journal export");
    const query = request
      ? new URL(request.url).searchParams
      : new URLSearchParams();
    if (query.get("format") === "csv") {
      const mode = query.get("mode") || "demo";
      if (!["demo", "backtest", "free_trial"].includes(mode))
        return Response.json(
          { error: "Choose a supported mode." },
          { status: 400, headers },
        );
      return new Response(
        tradesCSV(
          journal.trades.filter((t) => t.mode === mode),
          practice.profile.timezone,
        ),
        {
          headers: {
            ...headers,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="tradepath-${mode}-trades.csv"`,
          },
        },
      );
    }
    if (!learning.ready || reviews.error) throw new Error("Incomplete export");
    return Response.json(
      {
        format: "tradepath-account-v1",
        equitySnapshots: equity.data,
        exportedAt: new Date().toISOString(),
        profile: practice.profile,
        practice: practice.data,
        taskOutcomes: practice.taskOutcomes,
        curriculum: {
          phases: learning.phases,
          lessons: learning.lessons,
          evidence: learning.evidence,
        },
        weeklyReviews: reviews.data,
        journal,
        gateEvaluations: gates.data,
        auditRevisions: audit.data,
      },
      {
        headers: {
          ...headers,
          "Content-Disposition":
            'attachment; filename="tradepath-account-export.json"',
        },
      },
    );
  } catch {
    return Response.json(
      {
        error:
          "Export unavailable. No partial account history has been returned.",
      },
      { status: 503, headers },
    );
  }
}
