# TradePath — MVP Product Requirements & Delivery Blueprint
**Version:** 1.0  | **Date:** 26 October 2026  | **Owner:** Personal-use, designed for future multi-tenancy  
**Timezone:** Africa/Nairobi (EAT, UTC+03:00) | **Primary market:** EUR/USD  
**Platform:** Installable Android-first Progressive Web App (PWA), responsive desktop browser  
**Status:** Implementation-ready design proposal. No application has yet been coded/deployed.

## 1. Product thesis and boundaries
TradePath is a **process-first trading discipline assistant**, not a trading platform, copy-trading system, signal provider, financial adviser, or income-promise app. It supports a beginner with some chart knowledge, KSh 5,000–20,000 in potential capital, and 1–2 hours of daily availability. Default first six months: demo only. The core metric is **rule adherence rather than profit**.

**North-star:** Percentage of planned and executed trading decisions made according to documented rules, including intentionally skipping unsuitable setups. **Guardrail:** Never reward taking more trades; a rule-compliant no-trade day is successful. Keep loss data visible even when performance is poor.

**Personas:** P0 single Kenyan learner. Future P1 multiple individual users with strict tenant isolation. No public leaderboards, social features, paid signals, automated trading or prop-firm purchase funnels in MVP.

## 2. Goals, constraints and non-goals
**Six-month learning goals**: understand risk/structure; record >=100 sequential historical candidate setups (70 developmental, 30 frozen-rule held-out); record >=50 real-time demo executions; show positive after-cost average R with sufficient evidence; achieve >=90% documented rule compliance on eligible executed trades; demonstrate controlled drawdown; complete two free prop evaluation simulations before *considering* a paid challenge. Gates are not proof of profitability and should not unlock real-money orders.

**Constraints:** mobile first at 360px, reliable on modest Android devices, 1–2 hours/day, KES/USD, local EAT dates and reminders, low-data mode, limited or interrupted mobile connectivity; no broker API required. PWA install requires HTTPS and manifest; offline use must not claim server-backed writes succeeded until synced.

**Non-goals:** charts with tick-level market feeds; strategy signals; order placement; live account access; prop-firm API integration; investment performance predictions; subscriptions; MT5 account credential collection; in-app deposit/payment.

## 3. Navigation, screens and acceptance criteria
**Navigation:** bottom bar on mobile: Today, Plan, Journal, Insights, Settings. Contextual floating `+ Log` action on Journal/Today. Browser back and accessible deep-links. Desktop left navigation.

### S01 — Sign-in and onboarding (`/welcome`, `/onboarding`)
- User journey: sign in through email magic link / OTP; verify session; choose start date, timezone (defaults Africa/Nairobi), daily time budget (60/90/120 min), KES capital range (optional), trading mode fixed initially `demo`, EUR/USD as market, strategy version `H4H1-v1`.
- UI: 3 concise screens (identity, schedule/risk, confirmation); no password/broker credentials.
- Acceptance: cannot open private routes without auth; refresh retains session; onboarding can be edited; unsupported timezone input rejected; initial plan & six-month phases created idempotently.

### S02 — Today (`/today`)
- Top: current phase, progress, session time, process-score trend (with sample count), calm 2-line reminder.
- Tasks: calendar check, H4 bias, predefined zone, H1 assessment, journal/reflection; scheduled tasks adapt to month and weekend. User can mark `done`, `skipped/valid reason`, `missed`; a genuine no-trade day isn't a failure.
- Primary CTAs: `Start session`, `Record no-trade decision`, `Log idea/trade`; no 'Trade now' CTA.
- Acceptance: one active daily mission per local date; page reload persists; weekends use review/backtest templates; no-trade logged and credited when justified; tasks cannot be falsely treated as trades; show offline/pending-sync indicator.

### S03 — Plan / Curriculum (`/plan` and `/plan/:phase`)
- Six phase timeline; lessons, evidence requirement, milestone counters, review. A phase may extend beyond nominal dates until its evidence is verified.
- Acceptance: content organised by weeks; milestones derived from completed evidence, not manually checked flags; if date passes without requirements, phase shows `Needs more practice`; backdated evidence visibly labelled.

### S04 — Session check-in (`/session/new`)
- Short optional emotion/energy labels: calm, distracted, fatigued, pressure-to-recover, etc. Only user-entered, not diagnostic. Risk rules shown with hard warnings inside the app.
- Acceptance: when self-report is revenge/pressure/fatigue, default to study-only choice with explicit rationale; don't claim to stop MT5 execution; user can still record an externally executed trade without falsifying compliance.

### S05 — Setup and pre-trade gate (`/setups/new`, `/setups/:id`)
- Fields: symbol `EURUSD`, direction buy/sell, H4 EMA50 status, swing highs/lows confirmed using 2 bars each side, H4 zone bounds, H1 candle OHLC, candle close time, reference screenshot, entry, SL, TP, planned volume, spread, explicit news check, session state.
- Invariants: require completed closed H1 confirmation candle, zone pre-exists signal timestamp, buy close > zone top and in upper half of H1 candle; sell inverse; H4 bias same direction; risk <=0.5% of selected demo equity; target >=2R and sufficient opposing-structure room; max 2 trades/day, stop after 2 planned stop-outs; skip around scheduled high-impact EUR/USD event ±30 minutes (initially user-confirmed, not authoritative feed).
- Gate statuses: `eligible`, `ineligible`, `unknown` (insufficient inputs/news status). Present specific failed rules, and store evaluation snapshot + strategy version. User can log a trade taken anyway as `rule_breach`, but cannot mark it eligible retrospectively.
- Acceptance: changing entry/SL recomputes risk/eligibility; zero/negative or nonsensical values rejected; SELL calculations correct; missing data yields unknown, not pass; completed gate attached to trade with tamper-evident audit event.

### S06 — Risk calculator (`/tools/risk`)
- Inputs: account balance and denomination USD or KES, USD/KES manual/reference rate + source timestamp, entry, stop, target, risk 0.5% default, spread/commission allowance, EUR/USD standard-lot pip value approx USD10, broker min lot, lot increment, optionally margin assumptions.
- Formula for USD account: risk USD = balanceUSD * fraction; distancePips = |entry−stop|*10000; effectiveCostPerLotUSD = (distancePips+estimatedPipCost)*10 + explicitCommissionPerLot; maxLots = floor((riskUSD/effectiveCostPerLotUSD)/lotStep)*lotStep; `skip` if below minLot. Never round up.
- Acceptance: KSh 10,000, USD/KES=129.89, 0.5% risk, 20 pips + 1 pip cost => risk USD ≈0.3849, max theoretical lots ≈0.001833, rounded down to 0.001 if supported, 0.01-min -> SKIP. Validate BUY/SELL stop orientation and positive prices. Actual spread/slippage can exceed model.

### S07 — Journal and trade detail (`/journal`, `/journal/:id`)
- Manual journal for backtest/demo/free-trial (separate tags, never pool statistics silently). Record setup, screenshots, open & close timestamps, entry/exit price, lots, costs, planned USD risk, realized P/L, result in R, adherence flags, notes, emotion check.
- `No trade` as first-class separate record, with reason and relevant setup, no P/L.
- Acceptance: filters by mode/date/outcome/rule breaches; missing exit marked `open` and excluded from realised trade statistics; changes add audit revisions; screenshot private; export CSV including user-local timestamps and mode; import prior XLSX/CSV is optional later, not MVP.

### S08 — Insights (`/insights`)
- Separate panels: discipline (trade-rule adherence, timely journaling, session completion), performance (after-cost average R, win rate, profit factor, sample size, time-filtered equity curve, realized peak-to-trough drawdown), and mistakes (category counts).
- Discipline score proposal: 40% eligible executed trade adherence, 30% risk/day-limit compliance, 15% journal completeness, 15% scheduled review completion. If denominator missing, show `insufficient data` and score breakdown, not misleading 100%. Daily no-trade process adherence separately counted.
- Acceptance: backtests not mixed with demo; no hidden loss trades; P/L respects buy/sell sign and commissions; equity graph flags if missing starting equity or missing deposits/withdrawals; no profitability labels for low n; no fabricated market feed.

### S09 — Weekly review (`/review/:week`)
- Auto-summary of logged facts: scheduled sessions, setups inspected, valid no-trade decisions, total rule breaches, realized R, biggest recurring mistake. User writes reflection and one actionable weekly commitment. No generative AI required for MVP.
- Acceptance: week boundaries Mon–Sun Africa/Nairobi; can save drafts; review doesn't imply trade-volume goal; missed days treated neutrally.

### S10 — Funded readiness (`/funding`)
- Evidence gates: >=100 historical samples, held-out sample separate, >=50 forward demo trades, positive after-cost expectancy, rule adherence >=90%, maximum demo drawdown <5% with adequate equity records, 2 free evaluations with no violations, affordable fee, current firm eligibility/KYC/payout terms manually confirmed.
- Simulator (Release 3): provider and rules `rule_set_version`, notional equity, daily and overall loss rules, reset timezone, open position exposure; conservative warnings on unknown daily equity. User logs external trial results, not automatic trade execution.
- Acceptance: status `not ready / insufficient data / ready for independent review`; never says guaranteed funded or forces purchase; firm restrictions and timestamps versioned; no unverified live prop-firm availability claims.

### S11 — Settings, data privacy and exports (`/settings`)
- Set timezone, schedule, demo balance, lot steps, trading rules (new version only; historical records keep old rules), export data, delete account, turn off reminders, install tips.
- Acceptance: data download machine-readable; deletion confirmation and storage deletion path; device is supported offline for shell and locally queued unsynced drafts; logout clears local sensitive drafts; sync conflicts surfaced visibly.

## 4. User journeys
**Ordinary trading day:** Login → Today → session check-in → economic calendar manually checked → H4 bias+zone → H1 signal → gate evaluation → either `Log no trade` or record planned demo entry → close trade → journal → 5-minute reflection.

**Risk limit breached:** Planned position exceeds 0.5% or daily limit → gate shows explicit failed rule and safe lot/skip recommendation → idea can be saved but not marked eligible. If user executes externally, journal it honestly as non-compliant.

**Weekend:** App displays historical chart annotation, journaling clean-up and weekly review; never pressures weekday trade targets.

**Offline:** Cached Today/Plan displays last synced data with age; draft created offline gets local pending status and client UUID; reconnect sends upsert idempotently, surfaces conflict; no claim server saved until acknowledged.

## 5. Trading-rule engine: version H4H1-v1
- H4 directional filter: two most recently confirmed swing highs and swing lows progressively higher for BUY / lower for SELL; last closed H4 candle above/below EMA50.
- Confirmed swing: high or low compared against 2 closed candles before and after. Do not use look-ahead information in backtests.
- Support/resistance zone: ±2 pips around the most recent qualifying H4 confirmed swing low for BUY, high for SELL; created before price tests it; editable only with audit event and revalidation.
- H1 signal: candle trades into zone; bullish candle close above upper zone boundary, close above open, and close in upper half of its high-low range for BUY; reverse for SELL. Reject zero-range candle.
- Entry: next H1 candle open (historical) or first independently verified execution price after H1 close (demo; record deviation). Stop: 2 pip buffer beyond the lower of BUY zone low / H1 rejection candle low; SELL reverse. Target exactly 2x stop distance only when prior opposing H4 structure allows. Avoid ±30m around manually verified high-impact EUR/USD event. Do not treat this manual check as real-time automated screening.
- Planning risk 0.5% maximum; 2 entries per EAT local date; halt after 2 full planned losses. Gate checks must use existing plan version and be server-validated.
- These are **experimental rules**, not an endorsed profitable strategy. Avoid overfitting to history.

## 6. Database design (PostgreSQL / Supabase)
All user-owned tables include `user_id uuid` pointing to `auth.users`, `created_at timestamptz` and `updated_at timestamptz` where appropriate; UUID primary keys. Store UTC timestamps (`timestamptz`), calculate local calendar days with `Africa/Nairobi` explicitly at write/report boundary. Monetary values use `numeric`, not floating-point; require explicit currencies. Store `rule_snapshot` JSONB on evaluated ideas to protect history against strategy edits.

| Table | Essential columns | Indexes / invariants |
|---|---|---|
| `profiles` | `user_id PK`, timezone, display_preferences, available_minutes, capital_kes, mode | owner self-only |
| `strategy_versions` | id, user_id, code, version, params JSONB, active_from, archived_at | unique(user_id, code, version) |
| `curriculum_phases` | id, user_id, phase_number, planned_start/end, state, verified_at | unique(user_id, phase_number) |
| `lessons` | id, phase_no, code, title, instructions, evidence_type, sort_order | seed/static, admin-managed |
| `lesson_progress` | id, user_id, lesson_id, state, evidence_ref, completed_at | unique(user_id, lesson_id) |
| `daily_sessions` | id, user_id, local_date, stage, emotion, energy, session_status, reflection | unique(user_id, local_date) |
| `daily_tasks` | id, user_id, session_id, task_code, state, skip_reason, completed_at | unique(session_id, task_code) |
| `setups` | id, user_id, strategy_version_id, session_id, direction, mode, zone_low/high, OHLC, signal_close_at, entry/sl/tp, lot_size, cost_model, eligibility, rule_snapshot JSONB, failures JSONB | side/price constraints; keep evidence |
| `gate_evaluations` | id, user_id, setup_id, evaluated_at, rules_version, state, reasons JSONB, inputs_hash | immutable append-only |
| `trades` | id, user_id, setup_id nullable, mode, side, opened_at, closed_at, entry, stop, target, exit, volume_lots, cost_usd, planned_risk_usd, realised_pnl_usd, realised_r, rule_compliant, notes | one closed result; derive P/L server-side |
| `no_trade_decisions` | id, user_id, session_id, setup_id nullable, reason, notes | trade-neutral process record |
| `screenshots` | id, user_id, parent_type, parent_id, storage_path, content_type, bytes | storage RLS owner only |
| `equity_snapshots` | id, user_id, account_mode, account_ref, at, balance_usd, equity_usd, deposits_usd, withdrawals_usd | time index; avoid merging account contexts |
| `weekly_reviews` | id, user_id, week_start_local_date, facts JSONB, commitment, reviewed_at | unique(user_id, week_start_local_date) |
| `funding_evaluations` | id, user_id, provider, programme, rule_set_version, start_balance, max_daily_loss, max_total_loss, target, reset_timezone, status, self_verified_at | versioned provider rules |
| `audit_events` | id, user_id, entity_type, entity_id, verb, before_hash, after_jsonb, occurred_at | append-only; non-client writable |
| `sync_operations` | id, user_id, client_operation_id, entity, operation, processed_at | unique(user_id, client_operation_id) |

**RLS:** Enable RLS on every user-owned public table; revoke anon grants; grant only necessary operations; policies `user_id = (select auth.uid())` for SELECT and INSERT, plus UPDATE with `USING` + `WITH CHECK`; restrict deletes for audit/event and immutable gate records. Never expose service-role secret to browser. Storage bucket private, object path prefix `{auth.uid()}/...`, signed URLs for reads. New multiuser scope requires no schema rewrite because every row is already owner scoped. Implement immutable audit and gate writes through server-only actions / DB functions, not client direct writes.

**Account/money integrity:** No MT5 credentials stored; if future ingestion, accept read-only exports or account-history adapter. P/L and R calculated server-side; costs explicitly captured, open trades excluded from realised metrics; screenshot metadata stores no secret auth tokens. Currency conversion must preserve used exchange rate and timestamp.

## 7. API / service boundaries
- `GET /api/today?date=YYYY-MM-DD`: session/tasks + stage; auth required.
- `POST /api/sessions`: idempotent create local day; returns existing for duplicates.
- `PATCH /api/tasks/:id`: status update + optional reason; owner validated.
- `POST /api/setups/evaluate`: Zod-validated payload; deterministic rules engine; returns `eligible|ineligible|unknown`, reasons, risk and suggested lot; does not transmit trade.
- `POST /api/setups`: create immutable initial proposal + rule snapshot.
- `POST /api/trades`: journal external/demo trade; gate violations retained; derive realised metrics when closed.
- `GET /api/insights?mode=demo&from=&to=`: server-derived numerators/denominators and sample sizes.
- `POST /api/reviews`: weekly review upsert, owner-only.
- `GET /api/export`: CSV or JSON; no unrequested disclosures.
- `DELETE /api/account`: destructive confirm, retention disclosure, purge job.
Avoid separate API endpoints if typed authenticated Next.js server actions are simpler, but maintain identical boundaries and test contracts.

## 8. Key analytics definitions
**Rule adherence:** compliant closed executed trades / closed executed trades with sufficient checklist evidence; show excluded/missing-evidence count separately. **Risk compliance:** count within sizing and daily rules / all assessed entries. **Journal completeness:** fully documented closed trades / closed trades. **Scheduled reviews:** submitted reviews / reviews due. Weighted display score = 40/30/15/15 only when each component is measurable; otherwise show partial components and `insufficient data`.

**Realised R:** net realised USD P/L / initial planned USD loss; positive/negative; never revise denominator after exit. **Average R:** average of R across eligible closed trades in explicitly chosen mode. **Profit factor:** total positive net P/L divided by absolute total negative net P/L, null when no losing trades. **Maximum drawdown:** max peak-to-subsequent-trough percentage using a chronological, account-specific equity series; if no snapshots, display `unavailable` rather than substituting cumulative R. Include open exposure where the chosen funded rules require equity, or flag unsupported.

## 9. Six-month curriculum (26 October 2026 through 25 April 2027)
**Phase 1 (26 Oct–25 Nov): Foundations.** Week 1 setup app/demo/journal; week 2 pips/lots/spread/risk sizing; week 3 H4 2-left/2-right swing confirmation and EMA50; week 4 H4 levels/H1 candle closes. Evidence: 20 annotated charts, 10 hypothetical lot calculations, written plan, 0 pressure to place live trade.

**Phase 2 (26 Nov–25 Dec): Historical testing.** Weeks 5–6 mark 35 sequential candidate setups; weeks 7–8 bring to 70 development setups and freeze rules; remaining week test 30 untouched held-out examples. Evidence: 100 recorded candidate setups, news/time exclusion notes, after-cost metrics, documented rule version. Dates overlap Christmas; reschedule if needed.

**Phase 3 (26 Dec–25 Jan): Demo execution I.** Weekly targets are observation and journaling, not minimum trades. Perform pre-session check-ins; take only eligible simulated trades; record valid skips. Evidence: e.g. 15–25 legitimate demo trades if market provides them, 100% risk prechecks, weekly review.

**Phase 4 (26 Jan–25 Feb): Demo execution II.** Continue toward 50 real-time demo trades in total; compare with tested historic results; review mistakes by tag and perform honest drawdown review. Evidence: >=50 genuine demo trades, after-cost average R, >=90% adherence and measured peak-to-trough equity drawdown (<5% only if enough equity data), else extend phase.

**Phase 5 (26 Feb–25 Mar): Free funded simulations.** Create manually configurable, versioned rules per prop provider; practise trial with daily/total drawdown tracking; handle equity and reset timezone correctly; run 2 free trials when eligible. Evidence: two documented completed free trials with no breaches; optional if chosen provider does not offer free trials—do not replace with paid tests.

**Phase 6 (26 Mar–25 Apr): Audit / go-no-go.** Review full outcome: samples, forward/backtest divergence, months with loss, risk management, identity/payout eligibility, challenge fee at risk; decide no paid challenge / postpone / small affordable paid evaluation. Maintain regular reflection regardless of decision.

**Scheduling:** Activity templates keyed by phase and weekday; optional `remind at` 16:00 EAT for personally chosen weekdays, 18:00 weekend review or user-chosen time. Reminder opt-in; users can snooze; no shame-based streaks. Phases are evidence-gated and shift rather than forcing timeline.

## 10. UX visual system & accessibility
- Brand: **TradePath**, subtitle **Process before profit**. Dark navy #111C2C, deep panel #1E3045, teal #0D9488 (process/eligible), amber #D59A34 (caution), red #D45A5A (breach), light foreground #F5F7FA.
- Information hierarchy: current action > next step > evidence/progress; no giant charts or constantly changing price ticks in MVP. Use concise one-action cards, bottom nav, thumb-sized CTAs, no more than 5 primary tabs.
- Accessible contrast, keyboard navigation, labels and text for non-colour indications, error summary, focus management. Capture low bandwidth photo compression and prevent private screenshots from being cached publicly.
- Empty states show what can be logged, not a fabricated performance score. On mobile default to local date/time and KES budget, USD trading P/L explicitly labelled.

## 11. Technology / structure / delivery
**Recommended:** Next.js App Router + React + TypeScript, Tailwind CSS, accessible component primitives, Zod validation, Supabase Auth/Postgres/Storage, PostgreSQL migrations using Supabase CLI, Vitest for rule engine/unit testing, Playwright for end-to-end on mobile viewport, PWA manifest and carefully scoped service worker. Use active supported framework/security releases rather than hard-coding a version in code spec.

Suggested folders:
```
src/app/(public)/welcome/
src/app/(app)/today/ plan/ session/ setups/ journal/ insights/ review/ funding/ settings/
src/app/api/
src/components/ui/ src/components/trading/
src/lib/auth/ src/lib/db/ src/lib/rules/ src/lib/money/ src/lib/time/ src/lib/analytics/ src/lib/offline/
src/types/ src/content/curriculum/
supabase/migrations/ tests/unit/ tests/e2e/ public/icons/ public/manifest.webmanifest
```

**Security and resilience:** HTTPS; CSP; auth cookies protected; strict Zod server validation; rate limiting on sensitive actions; RLS tests with two distinct users; backups/export documented; no production secrets in `NEXT_PUBLIC_`; explicit feature flags; error logging without account balances or screenshots. Background push notifications opt-in and postpone until reliable core workflow. Offline drafts stored in IndexedDB, encrypted at rest where platform allows, but no claim of strong device-level confidentiality on shared devices; if offline complexity threatens delivery, ship read-only offline pages first and online-only writes prominently labelled.

**PWA acceptance:** manifest with `name`, icons at 192 and 512 pixels, `start_url`, display `standalone`, correct scope, HTTPS, install tested on Android Chrome; basic app shell offline; meaningful fallback and unsynced-draft warning. Desktop browser usable without install.

## 12. Four-sprint implementation backlog (4–6 weeks as planning capacity, not a delivery promise)
**Sprint 0 — Repo, auth, data security:** scaffold app, CI lint/typecheck/test, Supabase local migrations, auth onboarding, RLS owner tests, deploy preview, timezone/date utilities. Done when two test users cannot access each other's data.

**Sprint 1 — Today / Plan:** seed 6 phases and lessons, daily sessions/tasks, weekend templates, mobile nav, persistent completions and reviews. Done when reload and local-date rollover retain correct state.

**Sprint 2 — Rule engine / Risk / Journal:** deterministic validated H4H1-v1 gate, pip/lot calculator, no-trade records, journal CRUD + screenshots, after-cost P/L/R, audit events. Done when acceptance test matrix passes and inconsistent trades are flagged, never hidden.

**Sprint 3 — Insights / PWA / hardening:** metrics with denominators, weekly reviews, installability, offline UX, CSV export, privacy settings, E2E mobile tests, initial launch checklist. Done when a real user can complete one entire study/demo day across reload and poor connectivity without data loss or false save messages.

**Release 2:** import existing journal CSV, richer backtest evidence, notifications, expanded analytics. **Release 3:** versioned free funded evaluation simulator and optional read-only MT5 history import via local adapter, without credentials passing through PWA.

## 13. MVP test matrix
| ID | Acceptance scenario | Expected |
|---|---|---|
| AC-01 | Signed-out user requests /journal | Login/redirect, no private data leaked |
| AC-02 | User A guesses User B's setup UUID | 404/denied under RLS and API |
| AC-03 | 2026-10-26 at 23:59 EAT then next day | Two correctly separated local sessions |
| AC-04 | Missed weekday/market closed | No auto failed trade or forced entries |
| AC-05 | Buy H1 confirmation with only open candle | Gate unknown/ineligible |
| AC-06 | Signal zone created after signal | Ineligible; preserved audit |
| AC-07 | KES10k, 129.89 USD/KES, 20+1 pips, min 0.01 lot | Skip due broker min |
| AC-08 | Same inputs with 0.001 increment/min | 0.001 lot (unless other checks fail) |
| AC-09 | Trade reaches TP but broke risk rule | P/L win, rule breach retained |
| AC-10 | Valid skip due no setup | No-trade decision + process credit; zero P/L |
| AC-11 | Change active strategy rule | Historical evaluations unchanged/versioned |
| AC-12 | Close a SELL trade | Correct net P/L sign and R |
| AC-13 | Missing exit price | Trade open; excluded from realized stats |
| AC-14 | No realised losses in sample | Profit factor 'N/A', not infinity |
| AC-15 | Offline new draft and reconnect | Shows pending then synced; no duplicate |
| AC-16 | Backtest 100 trades + zero demo trades | Demo readiness NOT passed |
| AC-17 | 50 demo trades but unknown equity history | Max drawdown marked unavailable; funding gate not passed |
| AC-18 | Two different prop-firm loss reset timezones | Correct programme-specific day boundaries |
| AC-19 | Export and then delete account | Download works; deletion includes storage and user-owned records |
| AC-20 | PWA install on Android Chrome | Icon installed, standalone opening, offline fallback |

## 14. Definition of Done and launch review
- All P0 screens function with realistic data; no demo data masquerades as user's history.
- Owner-only RLS and server validation for *every* data mutation, with test coverage.
- Rule-engine unit tests including buy/sell, zero-range candles, out-of-range prices, stale zones, stale news acknowledgement, rounding, no-lookahead bias.
- Analytics cross-checked against manually computed sample journal.
- PWA manifest, icons, HTTPS, responsive 360px and desktop, offline fallbacks, CSV export and privacy controls.
- No live deposits/orders, recommendations to purchase challenges, or promises of returns.
- Clear disclaimer: education and journaling only, market decisions and losses remain user's responsibility.

## 15. Initial implementation prompt (for a coding agent)
"Implement TradePath v1 as an installable, secure, mobile-first Next.js/TypeScript PWA with Supabase. Use this PRD as the source of truth. Build auth/onboarding, Today, curriculum, deterministic H4/H1 risk gate, position sizer, trade/no-trade journal, weekly review, insights, CSV export and PWA installation. Seed the curriculum for Africa/Nairobi starting 2026-10-26. No live market feed, no trade execution, no brokerage credentials. Implement owner-only RLS, append-only gate/audit service, server-side validation, demo-only defaults, explicit no-trade credit, immutable historic strategy versions, and tests AC-01–AC-20. Do not claim deployment until verified with working URL and tests." 

## 16. Official reference docs
- Next.js App Router: https://nextjs.org/docs/app
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- PWA install requirements: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- MT5 history API (future integration only): https://www.mql5.com/en/docs/python_metatrader5/mt5historydealsget_py

**End of specification.**
