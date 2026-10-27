# Phase 5: PWA and launch verification

Phase 4 migration and live test flow are user-confirmed passed. Phase 5 adds an installable manifest, 192/512 PNG and maskable icons, a public read-only offline fallback, online/offline status, privacy controls, and a resumable account-deletion workflow.

## Activate

1. Run **only** `supabase/migrations/202610270010_account_deletion.sql` in the existing Supabase SQL editor.
2. For account deletion, set server-only `SUPABASE_SECRET_KEY` (recommended `sb_secret_…`) or legacy `SUPABASE_SERVICE_ROLE_KEY`. Obtain it in Supabase Settings → API Keys → Publishable and secret API keys. Never prefix it with `NEXT_PUBLIC_` or place it in browser code.
3. Configure a random server-only `CRON_SECRET` for the retry worker. `vercel.json` schedules `/api/account/purge` daily at 06:00 Africa/Nairobi (03:00 UTC). The initial confirmed request attempts deletion immediately; interrupted or large jobs remain queued for retries. Inspect queued jobs if daily retries do not complete.
4. When you choose to deploy, select your intended Vercel account/team and project. Set production `APP_URL` to that project’s actual HTTPS origin (for example, `https://your-app.vercel.app`), along with the Supabase URL, publishable key and server-only variables above. Do not copy `.env.local` into deployment source files. Preview deployments need separately scoped environment and callback configuration before account testing.
5. In Supabase Authentication → URL Configuration, add `https://your-app.vercel.app/auth/callback` (substituting your actual deployment hostname) to allowed redirects. Use the production origin as Site URL when switching production authentication there; keep localhost callbacks while developing. Confirm a live magic-link sign-in after deployment.

## Deployment handoff

- Framework: Next.js. Build command: `npm run build`; package installation: `npm ci`. Use Node.js 24, matching the prepared Vercel runtime.
- Required account variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anon key), and `APP_URL` set to the final HTTPS origin.
- Deletion variables: server-only `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) and `CRON_SECRET`. Without an admin key, ordinary practice works and deletion stays disabled.
- Apply migration 010 before enabling deletion. Earlier migrations are already user-confirmed; do not rerun them.
- `.vercelignore` excludes local environment files, build output, dependencies and browser reports. `vercel.json` contains only the deletion retry schedule, with no team or project binding.
- Local verification commands: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:database`. For browser checks, run the production server on port 3337 and then `npm run test:e2e` (install Playwright Chromium first).
- After a future deployment, complete the outstanding HTTPS, sign-in, disposable-account deletion and Android-install checks below before declaring launch verified.

## Offline and installation scope

The service worker caches exactly the public offline HTML and three public icon files. It never caches account navigation responses, React Server Component payloads, APIs, exports, screenshots or mutations. Account writes are online-only; no background draft queue or last-synced account cache is claimed. Existing open forms retain their in-memory text until navigation/reload; the offline banner warns that unsaved edits may be lost on closing.

On Android Chrome over HTTPS, use Install app / Add to Home screen. Open the installed app in standalone mode, disable connectivity, navigate, confirm the public offline guidance, then reconnect and retry. On iOS use Share → Add to Home Screen. Browser emulation validates manifest/fallback behavior but does not establish a real Android installation.

## Deletion flow and retention

Settings → Delete account → export first → type `DELETE MY ACCOUNT`. A magic-link session created within the past 15 minutes is required; another device's fresh login does not refresh an old session. Cross-origin requests and client-supplied owner IDs are rejected.

The authenticated server queues only the verified user. The queue locks new database writes and screenshot uploads. The server removes files through the Storage API in bounded batches, deletes the Auth user, lets foreign keys remove owned rows (including immutable history), then removes the queue entry. A failed operation never reports completed deletion. The pending account screen supports retries and fresh sign-in. The protected worker retries queued jobs; it never accepts a user ID from the caller.

App records and active stored files are removed. Provider backups may persist until their configured retention expires; no backup-erasure duration is asserted. Existing downloaded exports and preview data on other devices remain independent. Deletion clears browser site data where supported. No real user account was deleted during development testing.

Only TradePath's private bucket is purged. If the same Auth user owns files in other buckets/apps on a shared Supabase project, Auth deletion may refuse to finish; an administrator must resolve those external dependencies without treating the job as successful. Deletion remains disabled if no server admin key is configured.

## Checks and remaining launch gates

- 107 unit/integration tests pass, including service-worker cache isolation, deletion confirmation/authentication, storage-before-Auth sequencing, interruption/retry and foreign-path rejection.
- Disposable PostgreSQL applies all ten migrations and verifies recent-session ownership, pending-write locks, immutable-history cascade deletion, queue completion and preservation of another user.
- Production build, TypeScript and ESLint pass.
- Four Chromium tests at 360×800 pass: welcome accessibility (WCAG 2 A/AA and 2.1 AA axe checks), layout overflow, signed-out routes/APIs, manifest and service-worker headers, public-only offline cache/fallback and reconnect, and preview installation guidance.
- Hosted migration 010, actual hosted Storage/Auth deletion with a disposable account, full signed-in mobile workflow, real Android standalone installation and final HTTPS magic-link checks remain pending.
- Current user instruction: prepare for deployment only. Do not deploy to the Kinari team or transfer credentials. No deployment or environment transfer was completed; an empty remote project was created before this instruction and has not been modified further.

## Acceptance mapping

AC-01–14 and AC-16–17 have existing unit/database coverage, with prior phase live workflows user-confirmed. AC-15 uses the PRD's allowed read-only-offline first release: queued writes are deferred and never shown as synced. AC-18 (provider-specific simulator resets) remains Release 3. AC-19 has local API/database coverage; hosted deletion still requires the disposable-account walkthrough. AC-20 has manifest/offline browser coverage; real Android install remains manual.

References: [Supabase account deletion](https://supabase.com/docs/guides/auth/managing-user-data), [Storage API deletion](https://supabase.com/docs/guides/storage/management/delete-objects), [secret API keys](https://supabase.com/docs/guides/getting-started/api-keys).
