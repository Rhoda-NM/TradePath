# TradePath

Process before profit. Mobile-first trading discipline workspace in oxblood, pearl white and black.

## Run locally

Node.js 22+, then `npm ci` and `npm run dev`. Open http://localhost:3000.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## What works now

Email magic-link sign-in, cookie refresh and protected account routes, onboarding and editable preferences, idempotent six-phase plan initialization, account-backed tasks, check-ins and no-trade decisions. Server actions validate inputs and verify identity; database functions derive ownership from `auth.uid()` with direct table mutations revoked. Task revisions surface conflicts; no-trade operation UUIDs prevent duplicate retries. Account writes require a connection and server confirmation.

Visit `/welcome` to sign in after completing [Supabase setup](docs/supabase-setup.md). Without configuration, private routes redirect to the setup-aware welcome screen. Original device-only practice remains available at `/preview/today` and exportable at `/preview/settings`; it is not uploaded automatically. Supabase is configured locally; no deployment has been verified.

Phase 2 adds 24 weekly curriculum lessons, append-only evidence, foundation milestones, justified task skips, weekly review drafts/submissions and saved-account JSON exports. Existing projects need only the fourth migration; see [Phase 2 activation and verification](docs/phase-2-verification.md). Later trade/evaluation gates remain closed until their journal sources are implemented.

Daily journal remarks are available below Today’s mission and as dated entries in Journal. They are included in account exports. After migrations 1–4, apply only `202610270005_daily_journal_remarks.sql` to enable account saves.

`npm run test:database` verifies migrations, grants, isolation and idempotency in disposable local PostgreSQL. PostgreSQL 16 and psql are required; this suite never uses a hosted database.

## Remaining MVP work

Phase 3 setup evaluation, trade journaling, private screenshots and the live test flow are user-confirmed. Phase 4 adds account-specific analytics, equity snapshots and audited corrections, drawdown, informational readiness and journal-backed weekly reviews. Migration 009 and the Phase 4 live test flow are user-confirmed passed; see the [Phase 4 verification guide](docs/phase-4-verification.md). Phase 5 adds PWA installation, a public read-only offline fallback and resumable account deletion. See [Phase 5 setup and launch checks](docs/phase-5-verification.md) for migration 010, server-only credentials and remaining hosted checks. External evaluation verification and automatic later curriculum graduation remain later work.

## References

- [Implementation phases](docs/implementation-phases.md)
- [Supabase setup and verification](docs/supabase-setup.md)
- [Verification results](docs/verification.md)
- [Supplied product requirements](docs/product-requirements.md)

No service-role secret belongs in browser configuration. The Supabase public URL and publishable/anon key support ordinary account practice. Account deletion additionally requires a server-only secret/admin key and a protected retry worker.

Deployment scope: prepared for deployment only. No deployment or credential transfer is authorized under the current instruction. Choose the intended hosting account/project when deployment is requested.

## In-app walkthrough

Open `/guide` for the public, step-by-step app guide. It is linked from sign-in, the workspace header/sidebar, and Settings. It covers daily practice, curriculum evidence, setup evaluation, executions, screenshots, historical testing, weekly reviews, Insights, equity, readiness, exports, installation and account deletion.
