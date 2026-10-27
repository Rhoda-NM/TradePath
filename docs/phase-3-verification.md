# Phase 3: setup evidence and trade journal

Daily remarks were confirmed working by the user on 27 October 2026. Phase 3 adds setup evaluation, immutable evaluation history, trade entry and closing corrections, private screenshots, journal export and curriculum evidence counts. The oxblood, pearl and black interface is preserved.

## Activate on your existing Supabase project

Run these **new migrations in order**, once each, in the SQL editor:

1. `supabase/migrations/202610270006_setup_trade_journal.sql`
2. `supabase/migrations/202610270007_private_journal_screenshots.sql`
3. `supabase/migrations/202610270008_journal_curriculum.sql`

Do not rerun migrations 1–5. Migration 7 creates the private `tradepath-journal` storage bucket and ownership policies. No additional environment variables or SMTP changes are needed. Restart the application if running an older build.

## Walkthrough

1. From Today choose **Evaluate setup**, or open Journal. Enter a demo/backtest/free-trial account label. All form timestamps are explicitly UTC.
2. Paste H4 OHLC candles as JSON or CSV: `timestamp,open,high,low,close`. Supply at least 50 closed candles, with enough confirmed pivots for structure. Supply H1, zone, entry/stop/target, equity, sizing and manual news evidence. Missing evidence cannot pass the gate.
3. Save and inspect reasons, EMA, risk and the frozen input snapshot. Revising an unfrozen development or forward candidate creates a new evaluation; prior versions remain readable.
4. Record an actual external demo execution. This application does not place orders. Breaches are recorded honestly, including ungated executions, missing stops and differences from the evaluated setup.
5. Close the execution and verify net result and R. Correct a closing record and verify the initial risk stays fixed. A profitable outcome cannot erase a rule breach. Missing initial risk leaves R unavailable.
6. Attach a PNG, JPEG or WebP screenshot. Reload and view it. Repeat while signed out and with a second account: the file and metadata must be inaccessible.
7. Filter Journal by mode/date/outcome/breach and export CSV. Export Settings JSON for evaluations, audit history and saved account records. Verify a loss and multiline notes survive export.
8. For historical learning, document 70 sequential development candidates, freeze the strategy, then document 30 later held-out candidates. Held-out data cannot be added before freezing or revised afterward. Phase 2 also requires its lesson evidence, prior foundation completion and closed results with known R in both datasets.

## Operational rules and limits

The server evaluates H4H1-v1 using PostgreSQL numeric arithmetic. EMA50 starts with the first 50-bar SMA of the supplied history; use consistent history when comparing results. Pivots require two bars on each side. The evaluator checks zone timing, closed-candle geometry, direction, stop buffer, 2R target, opposing structure, costs, broker increments and 0.5% risk.

Forward signal/entry evidence uses a conservative 15-minute freshness limit. Equity references must be within one hour; KES/USD references within 24 hours and have a source. Manual news checks must be within one hour; events within 30 minutes block eligibility. These are recorded application policies, not a live market/calendar feed. Data accuracy still depends on supplied evidence.

Forward daily entry/stop-out limits use Africa/Nairobi dates; recorded session check-ins are evaluated at execution time. Initial execution fields are immutable. Closing corrections are audited; there is no destructive trade deletion or separate open-trade notes amendment UI. Screenshot files remain private and attached evidence cannot be removed by ordinary client writes.

Basic Insights are separated by mode and account and show explicit R sample counts. Equity-based drawdown, full readiness/evaluation rules, account purge and PWA remain later-phase work. Later curriculum phases do not auto-pass from lesson reflections.

## Verification boundary

Automated checks cover schemas, UTC conversion, CSV escaping, server exports and disposable PostgreSQL migrations, BUY/SELL gates, missing/future evidence, sizing, accounting, idempotency, closing conflicts, immutable risk, 70/30 freeze sequencing and cross-user isolation. Screenshot metadata/storage ownership is checked in a local storage-schema fixture.

The user confirmed that the Phase 3 migrations and test flow work in the hosted account. This is user-reported verification; the agent did not independently observe the browser flow. Individual security and device checks (including second-account access and mobile layouts) are not separately recorded as completed. Local storage-policy tests do not replace those specific hosted checks.
