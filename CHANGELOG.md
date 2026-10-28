# Changelog

## Unreleased — restricted bridge safety release

- Replace unrestricted prompt/cron/wiki runner with one allowlisted `hermes.version` read operation; remove all automatic briefing, `-z`, filesystem writes and git staging.
- Add persistent boot-scoped control, OFF on every restart, fresh owner scrypt verification to enable, process-global password throttling, authenticated explicit same-origin control and visible ON/OFF/offline UI.
- Serialize admissions/claims with OFF; atomic PostgreSQL claims and singleton advisory lock prevent duplicate processing. OFF never silently cancels claimed work. Crash-stuck requests require manual reconciliation, not automatic replay.
- Server-owned operation policy blocks all execution/mutations and legacy approvals; caller `sideEffecting:false` cannot bypass safety. Pin approved default/MIA child environment; reject other profile homes. Remove unverified remote DB TLS.
- Add unit tests, real production HTTP/installed-CLI/PostgreSQL integration smoke and deployment prerequisites. No deployment or enablement performed.

## Unreleased — private single-owner self-hosting

- Replace Google OAuth login with NextAuth Credentials and a fixed-cost scrypt hash in `OWNER_PASSWORD_HASH`; timing-safe key comparison, bounded input/concurrency and process-local login throttling.
- Retain encrypted JWT cookies; eight-hour sessions; revoke protected-resource access when the password hash changes. Existing Google/legacy sessions must sign in again.
- Remove development and garden API exemptions, global internal-secret bypass, plaintext-password cookies, hardcoded update secrets and secret query-string cache invalidation. APIs require owner JWTs. Cache invalidation and X stats refresh are POST-only; external cron/secret callers intentionally stop working.
- Reject cross-origin application mutations; preserve NextAuth CSRF flow.
- Add standalone non-root Docker runtime, persistent private Postgres Compose template, explicit schema-init tool and deploy runbook. Bridge remains excluded.
- Upgrade Next.js to 16.4.3 and NextAuth within v4, remove unused Prisma auth adapter and apply compatible dependency security fixes. Three high audit findings remain in the Prisma CLI/deepmerge-ts chain; no forced Prisma major migration.
- Limit Tailwind scanning to `src` to prevent build-worker OOM after dependency updates.
