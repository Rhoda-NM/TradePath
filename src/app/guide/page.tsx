import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "How to use TradePath · Walkthrough",
  description:
    "A step-by-step guide to daily practice, learning evidence, journal records and progress in TradePath.",
};
const sections = [
  {
    id: "start",
    title: "Set up your workspace",
    href: "/welcome",
    action: "Open sign-in",
    steps: [
      "Request a magic link from the app you intend to use, then open the newest email once in the same browser. No password or broker credentials are needed.",
      "Complete onboarding: choose your curriculum start date, timezone, daily time budget and optional capital in KES. The original curriculum start date stays fixed; preferences can be edited in Settings.",
      "Use the signed-in account workspace for saved learning and journal records. The device-only preview is separate: its records stay in that browser and are not automatically imported.",
    ],
    note: "If a link expires, request a new one. If email sending is limited, wait for the limit to reset instead of repeatedly requesting links. A link returning to localhost needs the deployed app’s redirect settings corrected by its administrator.",
  },
  {
    id: "today",
    title: "Follow your daily mission",
    href: "/today",
    action: "Open Today",
    steps: [
      "Choose Start session or Session check-in and record how you feel. Calm allows an active practice session; distraction, fatigue or pressure to recover puts the session into study-only mode.",
      "Work through the daily checklist. Expand a task’s Outcome to record done, skipped or missed as appropriate, including the requested reason. Weekend tasks focus on study and review.",
      "Write what you noticed or learned in Daily journal remarks and save. Remarks are optional, can be edited, and appear by date in Journal. Saving remarks does not automatically complete the checklist.",
      "If you sit out, choose Record a no-trade decision, select the reason and add context. A no-trade decision is process evidence, not a trade or a profit.",
    ],
    note: "Wait for a saved confirmation. Your daily session follows your selected timezone; reload if the local date changes while a form is open.",
  },
  {
    id: "learning",
    title: "Build learning evidence",
    href: "/plan",
    action: "Open My plan",
    steps: [
      "Open a phase and its weekly lessons. Read the instructions and the required record count before starting an exercise.",
      "Choose Add evidence to open the form. Enter the observation date, your explanation and the exercise details requested, then save. Examples include your written plan, chart annotations, position-sizing exercises and reflections.",
      "Watch the evidence count update. Prior evidence stays in the record; add new evidence rather than assuming an old record can be overwritten.",
      "Use phase dates to organize practice. Time passing and lesson reflections alone do not satisfy trade or readiness requirements.",
    ],
    note: "There are 24 weekly lessons across six phases. Later phase completion remains conservative: a readiness indicator is not automatic permission to advance.",
  },
  {
    id: "risk",
    title: "Practise position sizing",
    href: "/tools/risk",
    action: "Open position sizer",
    steps: [
      "Enter the account balance and currency, entry and initial stop, then the risk and cost inputs. For a KES account, supply the KES-per-USD conversion rate.",
      "Include spread/cost assumptions, commission, the broker’s minimum lot and lot increment. Read the calculated risk and suggested lot size.",
      "If the permitted size is below the broker minimum, skip the setup instead of rounding up. The calculator is an exercise; it does not record an execution or submit an order.",
    ],
    note: "Sizing alone is not a complete setup check. Use Evaluate a setup to document the full H4/H1 evidence.",
  },
  {
    id: "setup",
    title: "Evaluate a setup before execution",
    href: "/setups/new",
    action: "Evaluate a setup",
    steps: [
      "Choose demo, backtest or free trial, direction and a consistent account label. Use the same label later for executions and equity snapshots.",
      "Paste H4 candles as JSON or CSV with timestamp, open, high, low and close. Supply at least 50 closed bars and enough confirmed swings. Document the H1 confirmation candle and the zone’s creation and test times.",
      "Enter entry, initial stop, target, lots, equity, costs and broker constraints. Add dated currency-conversion evidence when required. Record your manual news check and relevant event times.",
      "Save the evaluation and read every reason. Eligible means the documented checks passed. Unknown means evidence is missing. Ineligible means at least one check failed. None of these labels predicts a profitable result.",
      "Where revision is available, create a new evaluation to correct or update evidence. Earlier snapshots remain readable; held-out candidates and frozen development records cannot be revised.",
    ],
    note: "Setup and execution time fields are explicitly UTC. For example, 15:00 in Nairobi is 12:00 UTC. Forward checks use a 15-minute signal/entry window, an equity reference within one hour, and a manual news check within one hour. This app supplies no live market or news feed.",
  },
  {
    id: "journal",
    title: "Record and review actual outcomes",
    href: "/journal",
    action: "Open Journal",
    steps: [
      "From a saved setup, choose Record external execution to keep it linked to the precheck. Use Journal’s manual entry option for an execution that already happened without a recorded setup; missing checks and breaches remain visible.",
      "Enter the actual execution details, account label, costs and notes. This records an external demo, backtest or free-trial execution; TradePath never places orders.",
      "Open the trade record when it closes and enter the exit, closing time, costs and reflection. Open trades do not contribute realized results. The app calculates net P/L and R from the stored initial risk.",
      "Use the closing correction form if needed. Corrections are audited and never change the original risk denominator or erase a rule breach. An execution without known initial risk has no invented R value.",
      "Attach PNG, JPEG or WebP screenshots to a setup or trade. Uploads are private, and the stored file limit is 5 MB. Filter Journal by mode, dates, outcome or breaches; export the selected mode’s trades as CSV.",
    ],
    note: "Initial execution details are fixed. There is no destructive trade-delete or separate open-trade notes amendment form. Daily remarks and no-trade decisions remain separate from execution results.",
  },
  {
    id: "backtest",
    title: "Keep historical testing honest",
    href: "/journal",
    action: "Open historical records",
    steps: [
      "Choose backtest mode and the development dataset. Record sequential historical candidates, including rejected setups and losses, using their historical decision times.",
      "After at least 70 fully documented development candidates, use Freeze development rules in Journal. Review your records before freezing: development edits are locked afterward.",
      "Record at least 30 later candidates in the held-out dataset. Held-out records require a freeze first and cannot be revised afterward.",
      "Record known-risk closed results in both datasets and complete the related learning evidence. Candidate counts alone are not the whole historical curriculum gate.",
    ],
    note: "Development and held-out samples answer different questions. Use the dataset filter in Insights to compare them separately, and never count backtests as forward demo executions.",
  },
  {
    id: "review",
    title: "Reflect on the week",
    href: "/review",
    action: "Open weekly review",
    steps: [
      "Select the current or a previous available week. Reviews use Monday–Sunday in Africa/Nairobi. Read the logged practice facts and account-specific journal results.",
      "Write what helped, what went wrong and one actionable commitment. Save a draft while thinking, or submit when your reflection has at least 80 characters and your commitment at least 10.",
      "After submitting, compare Current logged facts with Facts captured at submission. Later journal edits change current facts; the submitted snapshot changes only when you explicitly update the review.",
    ],
    note: "Reviews concern your process, not a requirement to place more trades. A week with valid no-trade decisions still deserves reflection.",
  },
  {
    id: "insights",
    title: "Understand your progress",
    href: "/insights",
    action: "Open Insights",
    steps: [
      "Select a mode and account, then a date range. Trade results use closing dates; entries and mistakes use opening dates. Backtests have a separate dataset filter.",
      "Read net P/L alongside the eligible-setup average R, all-outcome average R and sample sizes. Missing initial-risk records are counted separately. Profit factor is unavailable when there are no losing trades.",
      "Inspect discipline components and their denominators: eligible execution adherence, risk/day-limit compliance, journal completeness and scheduled reviews. The weighted score appears only when all four can be measured.",
      "Review recurring breach reasons and daily process separately. No-trade decisions never become winning trades, and profitable rule breaches remain breaches.",
    ],
    note: "Insufficient data means evidence is missing, not that you achieved a perfect score. Reviews and daily process are workspace-wide; execution statistics remain account-specific.",
  },
  {
    id: "equity",
    title: "Track equity and readiness",
    href: "/insights",
    action: "Record equity in Insights",
    steps: [
      "In demo or free-trial Insights, record a starting snapshot before your first execution. Match the account label exactly. Enter USD balance, equity including floating P/L, and a UTC observation time; use zero flows for the starting snapshot.",
      "Record later snapshots with all deposits and withdrawals since the previous one. Bracket a transfer with snapshots immediately before and after it for accurate treatment, then confirm the cash-flow context.",
      "Read the equity curve and observed drawdown. Missing cash-flow confirmation makes the curve unavailable. Expand an existing snapshot to make an audited correction; its account and timestamp stay fixed.",
      "Read the all-time demo readiness panel or open Readiness. It checks historical samples, forward demo evidence, expectancy, adherence and recorded drawdown. Free evaluations and eligibility remain unverified until supported by the later workflow.",
    ],
    note: "For the drawdown evidence indicator, the app requires 30 daily equity dates without gaps, coverage of the execution period, confirmed flows and no open trades. These are application evidence minimums, not a guarantee of profitability or funding. Readiness never unlocks live orders.",
  },
  {
    id: "settings",
    title: "Manage your account and install the app",
    href: "/settings",
    action: "Open Settings",
    steps: [
      "Edit practice preferences and download the account JSON export. It includes practice, learning, review, journal, equity and audit records. Journal also provides mode-specific CSV exports.",
      "Install from Android Chrome’s Install app / Add to Home screen menu, or iPhone’s Share → Add to Home Screen. Installation requires the HTTPS app. Desktop use does not require installation.",
      "Offline navigation shows general read-only practice guidance, not cached private records. Account edits are not queued. Keep unsaved forms open until the connection returns and wait for confirmation after saving.",
      "To delete an account, export first, sign in with a fresh magic link and type DELETE MY ACCOUNT in Settings within 15 minutes. Once queued, writes stop while files and account records are removed. A pending message is not a completed deletion.",
    ],
    note: "Deletion must be enabled by the administrator and cannot be undone. Provider backups follow their retention settings. Downloaded exports and device-preview records on other devices remain separate.",
  },
];
export default function Guide() {
  return (
    <div className="guide-page">
      <a className="skip-link" href="#guide-main">
        Skip to walkthrough
      </a>
      <header className="guide-header">
        <Link className="auth-brand" href="/today">
          ↗ TradePath.
        </Link>
        <Link className="button secondary" href="/today">
          Open workspace
        </Link>
      </header>
      <main id="guide-main" className="guide-main">
        <section className="guide-intro">
          <span className="eyebrow">YOUR FIRST DAY AND BEYOND</span>
          <h1>How to use TradePath</h1>
          <p>
            Build a repeatable practice: check in, document your decisions,
            reflect, and review the evidence. TradePath is a learning and
            journaling workspace, not a trading platform.
          </p>
          <p>
            This guide describes the signed-in account features. Links to
            account pages ask you to sign in when needed. The device-only
            preview has a smaller, separate feature set.
          </p>
        </section>
        <section className="panel guide-quick">
          <h2>A simple first session</h2>
          <ol>
            <li>Sign in and complete onboarding.</li>
            <li>Open Today, check in and work through your checklist.</li>
            <li>
              Add learning evidence, or evaluate a setup when you have complete
              information.
            </li>
            <li>
              Record an execution or a reason to sit out; write your daily
              remarks.
            </li>
            <li>
              Finish with a weekly review when it is due. Use Insights once you
              have records.
            </li>
          </ol>
          <Link className="button primary" href="/today">
            Start with Today →
          </Link>
        </section>
        <nav className="guide-contents" aria-label="Walkthrough topics">
          <h2>Jump to a topic</h2>
          <ol>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={"#" + s.id}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="guide-sections">
          {sections.map((s, i) => (
            <section
              className="panel guide-section"
              id={s.id}
              key={s.id}
              aria-labelledby={s.id + "-title"}
            >
              <span className="eyebrow">
                STEP {String(i + 1).padStart(2, "0")}
              </span>
              <h2 id={s.id + "-title"}>{s.title}</h2>
              <ol>
                {s.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="guide-note">{s.note}</p>
              <Link className="text-link dark-link" href={s.href}>
                {s.action} →
              </Link>
              {s.id === "equity" && (
                <Link
                  className="text-link dark-link guide-extra"
                  href="/funding"
                >
                  Open readiness →
                </Link>
              )}
              <a className="guide-top" href="#guide-main">
                Back to top ↑
              </a>
            </section>
          ))}
        </div>
        <section className="panel guide-section">
          <h2>If something does not save</h2>
          <p>
            Keep a copy of your text. Reconnect and retry the same action if the
            result was not confirmed. If the app reports that a record changed
            elsewhere, copy your edits before reloading and compare the latest
            saved version. Do not assume a pending request succeeded.
          </p>
          <p>
            If a feature says it is awaiting a workspace update, contact the
            administrator. Simulator rules, automatic later-phase graduation and
            offline write queues are not available yet.
          </p>
        </section>
      </main>
      <footer className="guide-footer">
        Process before profit · Take your time. There is no daily trade quota.
      </footer>
    </div>
  );
}
