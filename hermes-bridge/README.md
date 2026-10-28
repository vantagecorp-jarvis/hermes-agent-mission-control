# Restricted password-gated Hermes bridge

**Initial release supports only `hermes.version` (`hermes --version`).** This is not a general agent runner. No model prompts, outbound email/send/trade, cron/kanban mutations, briefing generation, wiki reads/writes or git operations are available, even for approved database rows. Existing mirrored dashboards may remain stale. The old launchd/wiki-skill templates are historical and must not be installed.

## Control and execution semantics

- Every bridge boot creates a new random boot ID and commits **OFF** before checking the CLI contract. Persisted ON never survives restart.
- `/hermes` displays OFF / ON-read-only / OFFLINE-UNKNOWN; enable requires the current owner password again, not just a session cookie. Disable needs the authenticated owner session but no password.
- `GET/POST /api/hermes/bridge` requires owner auth; POST additionally requires an explicit canonical `Origin`, the current boot ID and a fresh heartbeat. Missing/cross-site origins and stale boots fail closed.
- Password checks reuse the owner's fixed-cost scrypt verifier: globally 10 attempts/minute, one verification in flight, process-local. Enable edge rate limiting; run one app replica. Never put a plaintext password in argv, env, logs or database.
- OFF rejects new dispatches and blocks new queue claims. It does **not** cancel work already atomically claimed; that work may finish after OFF. Previously queued version checks remain queued and can run on a later enable.
- Claims use one PostgreSQL statement with a locked control row and `FOR UPDATE SKIP LOCKED`, then `UPDATE ... RETURNING`. A dedicated session advisory lock excludes a second bridge. Crash-stuck running rows are not retried automatically; operator must inspect/reconcile them. Exactly-once external side effects are NOT claimed or supported.
- The server ignores caller `sideEffecting`/prompt/title for supported reads. All execution/mutations require approval by policy, and are deliberately unsupported rather than queued. Legacy approved/queued prompts cannot be claimed. Approval/edit API actions are blocked; pending requests may be rejected.
- There is no filesystem/wiki path handler: traversal, absolute paths and symlink targets cannot reach a write. No Hermes profile files are changed. Child environment is rebuilt, fixes `HERMES_PROFILE=default` and requires `BRIDGE_HERMES_HOME=/opt/data` (the approved default/MIA owner home). Other profiles are unsupported.

## Integration prerequisites (operator; not performed by this change)

1. Back up DB; review the additive `BridgeControl` Prisma model. Apply reviewed schema change (`db push --skip-generate` is only the existing initial-schema workflow). Rebuild/recreate app. Do not seed or reset production data.
2. Run bridge from this repository with its root installed dependencies (`npm ci`; `pg` already exists). Supply only a restricted runtime DB credential, `HERMES_BIN=/absolute/operator-verified/hermes`, `BRIDGE_HERMES_HOME=/opt/data`, and `BRIDGE_DB_TRANSPORT`.
3. **Never publish PostgreSQL ports.** Preferred transport: `BRIDGE_DB_TRANSPORT=private` with `DATABASE_URL=postgresql://...@db:5432/...` on the existing isolated Compose network, or loopback through an operator-verified SSH tunnel to the private DB. Only `db`, `localhost`, `127.0.0.1`, `[::1]` are accepted without TLS. `BRIDGE_DB_TRANSPORT=tls` requires certificate verification (`rejectUnauthorized:true`; no URL query/TLS overrides); deployer must independently verify private routing, CA trust and hostname. Do not use TLS mode to make a public DB listener. Fail closed on untrusted certificate. No public-DB service is added to Compose.
4. Restrict DB role: SELECT/INSERT/UPDATE on `BridgeControl`, SELECT/UPDATE on `AgentRequest`; no schema/file/superuser privileges. App role must retain required application permissions. Bridge and app DB credentials need not be equal.
5. The bridge host must have an actual working Hermes installation at the verified absolute path and approved owner home. **Do not mount other profiles or secrets unnecessarily.** `node hermes-bridge/bridge.mjs` starts OFF. Open `/hermes`, enter owner password and select Enable read-only bridge. Check Hermes version. Disable and restart to verify OFF again. This does not enable general task execution.
6. Configure HTTPS canonical `NEXTAUTH_URL`, single app replica, no auth caching and edge limits for both login and bridge-control POST. An authenticated session plus a fresh password is mandatory; do not add a bypass token or default-ON variable.

## Validation

Installed `/usr/local/bin/hermes --help` explicitly documents that `-z` auto-bypasses approvals, so it is never used. Installed version was exercised with a rebuilt environment: Hermes Agent v0.21.1 (2026.9.7), upstream fef0e16f. The only runtime argv is `['--version']`; output must match the version contract. CLI upgrade requires revalidation. Help checks also inspected status, kanban, cron and insights, but those operations are **not enabled**.

Run `npm test`, `npm run build`, `node scripts/smoke-auth.mjs`. For integration, provision an **empty disposable local PostgreSQL** database named `mission_bridge_test`, apply schema, then run:

```sh
TEST_BRIDGE_DATABASE_URL=postgresql://TEST_USER@127.0.0.1:TEST_PORT/mission_bridge_test node scripts/smoke-bridge.mjs
```

The script refuses other hostname/database names, truncates only this disposable test DB, uses generated ephemeral auth credentials, starts real production HTTP + bridge processes, exercises the installed CLI, and checks password/origin/restart/OFF/claim behavior. It never contacts the deployed HQ.
