# Supabase account setup

The account integration is implemented. On 27 October 2026, the configured project responded successfully and reported email authentication enabled. The user subsequently applied all three migrations successfully. Anonymous profile and practice-function probes now return permission denied as expected. No emails were sent during these checks. Sign-in now uses default magic-link emails; SMTP setup is deferred. The steps below are retained for fresh installations.

## Configure the project

1. For a fresh project, apply all five files in `supabase/migrations/` in filename order in the Supabase SQL editor, or your established migration workflow. The third migration exposes only validated, owner-derived practice functions. Direct browser table mutations remain revoked. Test on a development database before production.
2. Enable email authentication and keep Supabase's default **Confirm Signup** and **Magic link or OTP** email templates. No custom template or numeric code is needed. If you enabled custom SMTP while exploring the dashboard, turn it off to use the default sender.
3. In **Authentication → URL Configuration**, set **Site URL** to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to **Redirect URLs**. The app passes this callback in `emailRedirectTo`. If you use another port, set `APP_URL` to that origin and use the matching dashboard URLs. For deployment, set an HTTPS `APP_URL`, Site URL and callback allowlist. Do not add broad production wildcards. Supabase's default sender restricts recipients; use an address authorized for the project's default sender. Custom SMTP can wait until broader delivery is needed.
4. Copy `.env.example` to `.env.local`. Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the project's API settings. A legacy anon key is accepted as fallback. Never use a service-role key. These are the only credentials this implementation needs.
5. Run `npm run dev` and visit `/welcome`. Restart after changing environment variables. Rebuild deployed bundles after updating public environment variables.

## Verify with two accounts

Use separate browser profiles or a normal and private window.

1. Request a sign-in link for user A. Open the email link in the same browser/device used to request it, finish onboarding, and complete a daily task. PKCE uses a browser cookie, so opening the link in another browser will not complete sign-in.
2. Save a no-trade decision, reload, sign out, sign in again, and confirm the records persist.
3. Sign in as user B. Confirm A's tasks, decisions, preferences and audit records are absent. Create B's own decision and repeat as A.
4. With a signed-out browser, request `/journal`, `/settings`, and `/onboarding`; expect a redirect to `/welcome` with no account records.
5. Disconnect the network while editing a decision. The form stays open; it must not display a confirmed save. Reconnect and retry. Task edits use revisions, and no-trade retries use an operation UUID. A changed local date requires reload.
6. Export practice JSON in Settings. This export covers daily practice records, not future trade/screenshot data. Original device records remain separately exportable at `/preview/settings`; they are never automatically uploaded or deleted on sign-out.

Expired, used or unverifiable links return to `/welcome` with a retry message. The callback accepts only fixed app destinations and never reflects provider tokens or errors. A supplied PKCE `sb_flow_id` is passed to the SDK for the matching verifier.

Account data is held in component memory and server responses, not localStorage. Signing out clears the in-memory draft by leaving the workspace. The device preview continues to use its original browser key. Every private server read/action independently verifies the user via `getUser()`. The Next.js proxy refreshes cookies; it does not replace authorization. Account responses are marked private/no-store. Cookies are HttpOnly and SameSite=Lax; production cookies use Secure and require HTTPS for real sign-in testing.

## Local database tests

`npm run test:database` starts a disposable PostgreSQL cluster under `/tmp`, applies all migrations, tests two user identities plus anonymous access, then removes the cluster. Requires PostgreSQL 16 server tools and psql. Set `TRADEPATH_PG_BIN` if the binaries live elsewhere. It does not read or mutate a remote database. The test fixture emulates Supabase's `auth.users` and `auth.uid()`; it verifies PostgreSQL grants/functions/RLS, not hosted Auth or email delivery.

## Official references

- [Supabase SSR and cookie clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&package-manager=npm)
- [Email OTP configuration](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Database function privileges](https://supabase.com/docs/guides/database/functions)

## Existing project: Phase 2 upgrade

If the first three migrations already ran, apply only `202610270004_curriculum_reviews.sql`. See [Phase 2 activation and verification](phase-2-verification.md). Do not repeat earlier migrations.

## Daily remarks upgrade

After migrations 1–4 are applied, run only `202610270005_daily_journal_remarks.sql`. Reload Today, write remarks below the mission checklist, save, reload, then check Journal. Confirm they remain after signing out and back in. A second browser tab with stale remarks must report a conflict rather than overwrite the first tab’s save.
