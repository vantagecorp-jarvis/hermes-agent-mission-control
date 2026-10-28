# Private deployment runbook

## Scope / prerequisites

This fork uses **one owner password, not Google**. No real secrets are included. Docker Engine and **Compose >= 2.30** are required (`env_file.format: raw` preserves `$` in scrypt hashes). The template is `compose.yaml` in this repository. Build from this local checkout, not an upstream Git URL. Runtime listens on container port 3000; host publication is **127.0.0.1:3000** only. A host reverse proxy must terminate HTTPS and preserve the canonical Host/proto. For a container proxy, attach app to the proxy's verified network and route to app:3000; do not expose Postgres.

## Configure locally (never paste secrets into git/chat)

Copy `.env.production.example` to `.env.production` and `.env.db.example` to `.env.db`; restrict both to mode 600. Raw env files use **unquoted** values; no shell variable expansion. Replace all placeholders:

- `NEXTAUTH_URL`: canonical external HTTPS URL (exact origin used for CSRF checks).
- `NEXTAUTH_SECRET`: independently generated random secret, at least 32 bytes (`openssl rand -hex 32`).
- `OWNER_PASSWORD_HASH`: `scrypt$<32 lowercase hex salt characters>$<128 lowercase hex derived-key characters>`; salt is a hex **string**, key length 64 bytes, N=32768, r=8, p=1, maxmem=64 MiB. Never set a plaintext `ADMIN_PASSWORD`.
- `DATABASE_URL` and `POSTGRES_URL`: same direct `postgresql://mission_control:<URL-encoded-password>@db:5432/mission_control`. DB password must match the raw decoded `POSTGRES_PASSWORD` in `.env.db`.
- Optional API keys may be added to `.env.production` only if those features are needed. No Google login credentials, `INTERNAL_API_SECRET`, cron secret, or bridge credentials are needed.

Generate the owner hash without password argv/history exposure (Python 3 for hidden terminal prompt, Node for scrypt):

```sh
python3 -c 'import getpass; print(getpass.getpass("Owner password (16+ bytes): "), end="")' | npm run --silent auth:hash
```

Store only the resulting hash as `OWNER_PASSWORD_HASH`; use a unique strong password. The script preserves input bytes exactly, including whitespace. Do not use `echo password` (history/newline exposure). Hashes are secrets too: do not commit them. `NEXT_PUBLIC_*` variables are public/build-time; the app requires none for authentication. UI branding overrides need build-time provisioning if desired.

## Operator commands (not executed by preparation task)

```sh
docker compose config --quiet
docker compose build app schema
docker compose up -d db
docker compose run --rm schema db push --skip-generate
docker compose up -d app
```

`db push` is an explicit **initial schema creation** step because upstream ships no migration history. It does not seed fake/personal data. For upgrades, back up first, review the schema diff, and create proper reviewed migrations; never add `--accept-data-loss` or auto-run schema changes on app startup.

## Verify before declaring testable

- `docker compose ps`: database and app healthy; `/login` health check only verifies web availability, not DB correctness.
- Anonymous `GET /login` = 200; `/` = redirect to `/login`; **every** non-auth `/api/*` = 401, including `/api/garden`, `/api/home`, `/api/hermes/dispatch`.
- Sending `x-internal-secret`, the old `hermyhq_auth` cookie or a fake JWT must still return 401.
- Browser login: wrong password shows generic failure; correct password reaches dashboard. Verify Secure, HttpOnly, SameSite=Lax NextAuth cookie over HTTPS; signout removes access. NextAuth supplies CSRF for login/signout. Cross-origin application mutations return 403.
- Logged-in `/api/hermes/requests` should return JSON successfully against initialized Postgres; create/read a harmless task, recreate app and DB containers **without removing volumes**, and verify it remains. This DB/persistence acceptance test is the deployer's responsibility.
- Proxy must not publicly cache authenticated pages/APIs. Set request/body limits and rate-limit `/api/auth/callback/credentials` at the edge. Local limiter permits 10 attempts/minute globally and one scrypt at a time; it resets on restart, is not distributed, and can temporarily lock out the owner under attack. Scale-one only until a shared limiter is designed.
- PostgreSQL has **no published host ports**. Verify with `docker compose ps`. Never add a public 5432 mapping for a bridge.

## Rotation / backups / rollback

Change the hash and recreate app to revoke old protected-resource JWT access; rotating `NEXTAUTH_SECRET` also invalidates all sessions. No password-change HTTP endpoint exists. Existing Google sessions are rejected. Remove old `hermyhq_auth` cookies from browsers if present (they are ignored).

Back up `.env.production`, `.env.db`, and all three volumes securely. Example DB backup (output is sensitive): `docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql`. Test restore in isolation. Never use `docker compose down -v` on production. Roll back app image/git revision only after checking schema compatibility; restore a backup if a schema change cannot be reversed safely.

## Restricted bridge — password gated, read-only only

The reviewed bridge now supports **only `hermes.version`**, never agent prompts, cron/kanban mutations, wiki access, daily briefing or `-z`. Every restart starts OFF; enabling requires the owner password again through the authenticated same-origin `/api/hermes/bridge` endpoint and `/hermes` control panel. OFF stops new admissions/claims, not a task already claimed. There is no automatic enable/deployment in this change.

See [hermes-bridge/README.md](hermes-bridge/README.md) for full integration requirements, DB privileges, CLI contract and test commands. Apply the additive `BridgeControl` model before deploying this app/bridge version. Compose still intentionally includes no bridge service, host profile mounts, secrets or public Postgres ports. Parent/operator must provision an isolated runtime on the private DB network (or verified private tunnel/TLS), an installed Hermes CLI, the exact approved default/MIA home `/opt/data`, HTTPS/edge limits and runtime credentials. No other Hermes profile may be mounted or altered. Old running rows require explicit reconciliation; never bulk replay legacy requests. Do not enable arbitrary prompts as a shortcut.

## Known limitations / validation boundary

Preparation verified `npm ci`, auth tests and production build locally, not a deployed database/container stack. Docker daemon and Compose plugin are unavailable in the preparation environment. The operator must build the image, initialize schema, exercise DB persistence and test proxy/cookies. Three high audit findings remain in the Prisma CLI/deepmerge-ts chain (fix requires a reviewed Prisma major upgrade); no zero-vulnerability claim is made. Optional content routes retain upstream assumptions (local scripts/files, third-party APIs, placeholder self-fetch URL in trend sniping); these are not validated core deployment functionality. This is not a complete application penetration test.
