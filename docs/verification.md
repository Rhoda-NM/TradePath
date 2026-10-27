# Account foundation verification — updated 27 October 2026

Story: email magic link → verified account → onboarding → Today task/check-in/no-trade action → authenticated database function → refreshed account snapshot. Original device practice remains separate under `/preview`.

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript | Passed | `npm run typecheck`, no diagnostics |
| ESLint | Passed | `npm run lint`, no diagnostics |
| Application tests | Passed | `npm test`, 74 tests across 13 files |
| Production compilation | Passed | `npm run build`, compilation and build-time typechecking completed |
| PostgreSQL migrations | Passed locally | All five migrations applied to disposable PostgreSQL 16 |
| Two-user isolation | Passed locally | A cannot read B's profile; B cannot read A's sessions, tasks, decisions or audit; account IDs derived from identity |
| Anonymous and direct mutations | Passed locally | Anonymous reads/RPCs denied; direct profile/audit writes and private helper access denied |
| Idempotency / conflicts | Passed locally | One session per date, six phases once, one no-trade record/audit on retry, payload mismatch rejected; task retries preserve revision, stale edits rejected |
| Validation | Passed | Unknown task/timezone, changed initial start date, stale local date, invalid payload and missing identity rejected |
| Account history pagination | Passed | Records beyond the default API row limit are retained; partial fetch failures never become successful exports |
| Server identity checks | Passed with mocks | Verified `getUser()` required; stale client session never used to authorize |
| Hosted connection | Passed | Local project URL/public key present; Auth settings endpoint returned 200; email authentication enabled |
| Hosted schema / anonymous access | Passed limited probes | After migrations, profile lookup and daily-practice RPC return HTTP 401 / PostgreSQL 42501 (permission denied), replacing missing-schema errors. Full hosted two-user isolation remains pending |
| Hosted magic-link delivery and sign-in | Passed — user confirmed | On 27 October 2026, the user confirmed live email delivery and successful sign-in. Not independently observed in an agent browser |
| Hosted onboarding and record persistence | Passed — user confirmed | User completed onboarding and confirmed records persist after logout and repeat login on 27 October 2026 |
| Browser reload-only and offline walkthrough | Pending | Not independently observed; agent browser inventory contains no enabled apps or browsers |
| Mobile layout and accessibility walkthrough | Pending | Requires 360px and desktop browser verification |
| Hosted RLS / auth cookie refresh | Pending | Local PostgreSQL fixture emulates `auth.users` and `auth.uid()`; it does not test Supabase Auth infrastructure |
| HTTPS deployment / Android install | Pending | No deployment or PWA supplied in this increment |

## HTTP verification

The production server was checked on local port 3327 without Supabase configuration. Welcome displays a setup disclosure and link to the retained device workspace. Private `/today`, `/journal`, `/settings`, and `/onboarding` redirect to `/welcome`; responses must use private/no-store caching. Preview routes remain public and contain no account data. These checks do not establish real signed-in browser behavior.

## Implementation limits

Account writes are online-only. Forms remain open on unconfirmed saves; successful account data is not cached in localStorage. Task operations carry a revision and UUID. No-trade decisions retain the same UUID across retries, and the database checks replayed payloads. Previous device records are not silently imported or deleted on sign-out. JSON export currently covers practice records only.

The managed runner cannot parse TypeScript CLI configuration capture. Next.js uses the compiler API (`experimental.useTypeScriptCli: false`), preserving build-time checks. Standalone typechecking also passes.

The project is configured locally and reachable, and the user confirmed all three migrations ran successfully. Anonymous profile/RPC probes now return permission denied as expected. Follow [Supabase setup](supabase-setup.md) for the live two-account walkthrough. Core account flow is user-verified: delivery, sign-in, onboarding and record persistence across logout/repeat login. Remaining hosted checks include automatic token refresh, two-user isolation, reload-only and offline behavior. Full trade journaling, screenshots, full rule evidence, complete insights, account purge and PWA are still later work; the MVP acceptance matrix is not complete.

## Magic-link change — 27 October 2026

Sign-in uses the provider’s default confirmation link template. Requests pass a callback under the trusted `APP_URL`; the callback exchanges the PKCE code, supports the SDK flow identifier, sets no-store/no-referrer headers and uses fixed success/failure destinations. Expired links show retry guidance. Numeric OTP entry was removed. Unit tests cover trusted callback URLs, client redirect rejection, flow identifiers, provider failures and invalid origin configuration. SMTP setup is deferred; configure the Site URL and allowed callback in Supabase before requesting a link. No hosted sign-in email was sent during implementation.

## User-confirmed live authentication — 27 October 2026

The user reports that live email delivery works and sign-in succeeds. Next verify onboarding, completion of one daily task and a no-trade record, reload persistence, and persistence after signing out and back in. Hosted two-user isolation and token refresh remain unverified.

## User-confirmed onboarding and persistence — 27 October 2026

The user confirmed onboarding completed and records persist after logout and repeat login. This is user-reported live verification, not an independently observed agent browser test. Hosted two-user isolation, automatic token refresh and offline behavior remain pending.

## Phase 2 implementation — 27 October 2026

Curriculum lessons, learning evidence, derived foundation progress, skipped/missed task outcomes, weekly reviews and saved-account exports are implemented. All four migrations and both isolation suites pass locally. Hosted activation requires only the new migration `202610270004_curriculum_reviews.sql`. No agent browser or hosted Phase 2 walkthrough was available. See [Phase 2 verification](phase-2-verification.md) for exact scope, limits and checks.

## Daily journal remarks

Today now includes an optional 6000-character daily remarks field below the mission checklist. It reuses `daily_sessions.reflection`, saves through an owner-derived RPC, checks the expected previous text to detect conflicting edits, and keeps revisions in audit events. Dated remarks appear in Journal and saved-account exports. They do not create trades or automatically complete tasks. Account activation requires only `202610270005_daily_journal_remarks.sql`; local preview remarks remain device-only. Local database tests cover retries, conflicts, length/date validation, user isolation and audit preservation. Hosted/browser verification remains pending.


## Phase 4 implementation verification

User reports confirm daily remarks and Phase 3 migrations/test flow work. Phase 4 adds mode/account/date-filtered analytics, explicit discipline denominators, equity records with optimistic revisions and audit history, cash-flow-adjusted observed drawdown, informational readiness, and account-specific facts in weekly review snapshots. Full JSON exports include equity records.

94 unit/integration tests pass, alongside lint, TypeScript checks, production build, and disposable PostgreSQL suites applying all nine migrations. New database checks verify equity ownership, anonymous denial, operation retries, stale correction conflicts, numeric/timestamp validation, prior-value audit preservation and weekly account loss totals. Calculation fixtures cover losses, deposits/withdrawals, 25% peak-to-trough drawdown, unknown records, 30-date coverage, account/dataset separation, and zero expectancy after decimal cancellation.

The user confirmed migration 009 and the Phase 4 live test flow passed. This is user-reported verification; specific cross-account and device checks remain individually unconfirmed. See [Phase 4 verification](phase-4-verification.md). The readiness display does not advance curriculum or verify external evaluations.
