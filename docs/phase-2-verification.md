# Phase 2 — curriculum, evidence and weekly review

Implementation date: 27 October 2026. Palette remains oxblood, pearl white and black.

## Activate on the existing project

Run **only** `supabase/migrations/202610270004_curriculum_reviews.sql` in the Supabase SQL editor. It is a single transaction. Do not rerun the first three migrations; they are already applied. Then restart the development server and reload the app.

The user confirmed migration 4 runs successfully. No hosted migration was applied by the agent: the configured publishable key cannot administer the schema. Until migration 4 is applied, existing daily practice still works and learning panels display a workspace-update message. No account records are replaced by preview data.

## Delivered

- `/plan` and `/plan/1` through `/plan/6`: 24 lessons organized as four learning weeks per phase, with instructions and per-lesson evidence counts.
- Individual chart annotations, hypothetical risk calculations, written plans and reflections. Observation dates are bounded by the curriculum start and current user-local day. Backdated observations are visibly labelled.
- Append-only evidence and audit metadata, owner-only reads, validated RPC writes, operation IDs for retries, and duplicate detection. Rewording the same chart or risk calculation does not create another counted example.
- Risk exercise results recomputed in PostgreSQL. Client-supplied outputs are ignored; currency, costs, stops, risk budget and broker minimum/step are checked.
- Foundation progress derives from 20 chart annotations, 10 distinct risk exercises and a written plan. Passing a nominal date cannot pass the phase. An overdue current phase shows **Needs more practice**.
- Later-phase reflections can be recorded, but cannot pass the extra historical, forward-demo, equity or evaluation gates. Those gates stay closed until their validated journal/evaluation sources are implemented. No real-money feature is unlocked.
- Today shows the current evidence-gated phase and next unfinished learning lesson; historical-testing and weekend task guidance differ. Task outcomes support done, justified skip, missed and pending, with revision checks. Valid skips count separately toward the daily process display; tasks never create trades.
- `/review` and `/review/YYYY-MM-DD`: Monday–Sunday Africa/Nairobi facts, reflection, commitment, draft saving, submission and revision conflict detection. Facts are computed server-side; submitted snapshots remain unchanged unless explicitly updated. Closed demo R excludes backtests and open trades. No trades means insufficient data, rather than a fabricated return. Mistake categories remain unavailable until journal tags exist.
- Saved-account JSON export includes practice, task outcomes, profile, phases, lesson catalogue, evidence and weekly reviews. Failed reads produce an error, not a partial-history download. Device-only export remains separate.

## Automated verification

| Check | Result |
| --- | --- |
| Application tests | 70 passing across 12 files |
| TypeScript | Passing |
| ESLint | Passing |
| Production build | Passing |
| All four migrations on disposable PostgreSQL 16 | Passing |
| Existing account/isolation regression suite | Passing |
| Production HTTP signed-out checks | Plan/deep links/review redirect to welcome; export returns 401; preview stays accessible |
| Curriculum evidence counts, duplicates, backdates and risk results | Passing |
| Foundation completion, overdue state, later-phase gate preservation | Passing |
| Weekly draft/submission retries, revisions, frozen facts and mode separation | Passing |
| Two-user and anonymous evidence/progress/review isolation | Passing |

The local database fixture emulates Supabase identity roles; it does not establish live hosted behavior. No enabled browser surface was available for visual or click-through verification. Hosted activation and the following checks remain pending.

## Live walkthrough after applying migration 4

1. Open Today and Plan. Confirm the existing daily records remain, lesson dates match onboarding, and each phase has four weekly lessons.
2. Open Foundations and save a written plan with at least 80 characters. Reload and sign out/in; the evidence and count must remain.
3. Save a backdated chart annotation with timeframe and ISO timestamp including timezone. Confirm its label. Repeat the same chart with different notes; it should be rejected as a duplicate.
4. Save a risk exercise with KES 10,000, rate 129.89, BUY entry 1.08, stop 1.078, risk 0.5%, 1 pip allowance, minimum/step 0.01. Confirm skip and zero rounded lots. Try a different exercise for the next record.
5. Skip a Today task with a reason of at least 10 characters. Reload; the reason and separate skipped status remain. Mark a different task missed and confirm it is not treated as a losing trade.
6. Open Weekly review, save a short draft, reload, then submit a reflection of at least 80 characters and commitment of at least 10 characters. Inspect the facts captured at submission. Weeks always use Nairobi boundaries, independent of the preferred display timezone.
7. In two tabs, edit the same review. Save in one, then submit the stale other tab: it must show a conflict. Do the same for task outcomes.
8. Repeat in a second authenticated account. It must not inherit the first account's evidence, phase progress or reviews. Do not grant organization administration merely to obtain another test inbox; Supabase default-sender restrictions still apply.
9. Disconnect while a form is open. A failed save must keep the form and never claim account confirmation. Reconnect and retry the same operation. Use the JSON export and verify evidence/reviews are included.
10. Inspect at 360px and desktop, including keyboard navigation, evidence-form focus, native task-outcome disclosure and weekly navigation.

## Evidence form improvement

Add evidence now opens a native modal dialog rather than appending a form below all lessons. It keeps keyboard focus inside the popup, restores focus to the triggering button when closed, locks background scrolling, and supports Close, Cancel and Escape. Closing is disabled during saves, and failed saves keep the form open. On small screens the popup uses nearly the full viewport with one-column inputs and independent scrolling. Browser visual verification remains pending because no enabled browser surface is available.
