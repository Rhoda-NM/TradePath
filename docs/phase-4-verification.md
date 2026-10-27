# Phase 4: Insights and reflection

Phase 3 migrations and its live test flow were user-confirmed working. Phase 4 adds account-specific analytics, equity snapshots with audited corrections, a cash-flow-adjusted curve, evidence readiness indicators, and journal-backed weekly review facts. The oxblood, pearl white and black palette is retained.

## Activate

Run **only** `supabase/migrations/202610270009_insights_equity.sql` in your existing Supabase SQL editor. Do not rerun previous migrations. Restart an older application build. No new environment variables or services are required.

## Live walkthrough

1. Open **Insights**. Select a mode and account, then a date range. For backtests, compare development and held-out separately. Check that an existing loss appears in net P/L and all-outcome R. Selecting another mode or account must not retain that loss.
2. Inspect denominators under Discipline. Empty history must display insufficient data, not 100%. Risk assessments missing conclusive evidence remain excluded and explicitly counted. No-trade decisions appear under daily process and do not become wins.
3. Record a starting equity snapshot before the first execution, with zero deposits and withdrawals. Use USD values and explicit UTC observation timestamps. Account labels must match the journal. Record balance and equity separately; equity includes floating P/L.
4. Add another snapshot after a loss. Verify the curve and drawdown. A 1,000 → 1,200 → 900 series has 25% peak-to-trough drawdown. A 1,000 → 1,500 series with a 500 deposit has zero adjusted return, not a 50% gain.
5. Cash flows describe the interval since the preceding snapshot. For exact treatment, record snapshots immediately before/after a transfer (treat it at interval end). Confirm all flows only after checking the account statement. Leaving confirmation unchecked makes the curve/drawdown unavailable. Missing dates or initial coverage keep the readiness drawdown criterion insufficient.
6. Expand an equity record and correct it. Confirm the revision increments, then export Settings JSON to inspect the previous values in audit history. Account label and timestamp are fixed for a correction; duplicate timestamps are rejected. A stale edit must show a conflict rather than overwrite a newer correction.
7. Open Weekly review. Compare its account-specific facts with Journal for the same Monday–Sunday period. Submit the review, change a trade closing result, and reload: current facts update while facts captured at submission remain fixed until you explicitly update the review.
8. Open `/funding` or the readiness panel in Insights. Backtest-only history must not satisfy the 50-demo criterion. Fifty trades without adequate equity history must not satisfy drawdown. Free evaluations and eligibility remain unverified.
9. Export Settings JSON and verify `equitySnapshots` and their audit history are included. Test with a second account and while signed out: another user's snapshots must be inaccessible and mutations denied.
10. Check the filter/form layout on a phone and the accessible curve table. Keyboard users must be able to operate every field and expandable record.

## Metric definitions

- Results use **close dates**; entries, timeliness and mistake counts use **open dates**. Date filters use Africa/Nairobi. Open counts are currently open entries in the selected date range, not historical open-position reconstruction.
- Mode and account are selected explicitly. Historical datasets can be separated. Backtest and forward results are never silently combined.
- Net P/L, win rate and profit factor include every closed result in the selection. Breakeven trades remain in the win-rate denominator. Profit factor is unavailable without losses and zero for an all-loss sample.
- Primary average R uses eligible setup-linked closed trades with known initial risk. All-outcome average R and excluded/missing-risk counts appear alongside it. Existing server-calculated net P/L and frozen R are not recalculated in the browser.
- Eligible executed adherence = compliant / assessed eligible closed executions. All closed breaches and unassessed counts remain visible. Risk compliance conservatively assesses fully compliant executions as passes and explicit H4H1-v1 risk/day-limit breaches as failures; other entries remain unknown.
- Journal completeness requires a closed trade, initial stop, target, known initial risk, adherence assessment and nonempty notes. Entry timeliness means recorded within 24 hours after opening (an application policy), and is shown separately from the score. Historical backtest entry timing is not scored.
- Weighted score = 40% eligible adherence + 30% risk/day compliance + 15% journal completeness + 15% scheduled reviews. All four denominators must exist. Unknown records remain explicitly excluded; a measurable score is not a claim about those records.
- Reviews are workspace-wide and due after Sunday ends, from curriculum start. Daily process shows recorded days, fully completed task sets (done or justified skipped), scheduled weekdays and no-trade decisions separately.
- Equity index begins at 100 and chains `(ending equity − deposits + withdrawals) / preceding equity`. Drawdown is the largest peak-to-subsequent-trough decline in the selected recorded index. It is observed equity drawdown, not an intraday bound, and depends on accurate cash-flow timing. Balance and raw equity remain available in the accessible table/export.
- Readiness uses all-time evidence for one demo account, unaffected by display date filters. Conservative application minimums are 50 eligible known-R results, 50 assessed eligible executions for adherence, and 30 daily equity dates without gaps, covering the execution period with confirmed flows and no open trades. These are documented evidence policies, not proof of profitability.

## Remaining boundaries

Readiness is informational; it does not change curriculum completion states or authorize orders. External free-evaluation verification, current provider terms, affordability, simulator rules and account purge remain later work. Existing curriculum gates remain conservative rather than treating an informational indicator as authorization to advance.

Automated tests cover hand-calculated results, cash transfers, chronology, missing evidence, mode/account separation, empty denominators, ownership, idempotency, audited corrections, stale revisions and weekly review facts. The user confirmed that migration 009 and the Phase 4 live test flow passed. This is user-reported verification, not an independently observed agent browser test. Specific cross-account and device checks have not been individually recorded as completed.
