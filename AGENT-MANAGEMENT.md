# Agent Management follow-on handoff

## Merge
This is an incremental patch against a frozen copy of the parent's **uncommitted fleet implementation**, not repository HEAD. No shared source files were edited.

From the target checkout:
```
git apply --check /opt/data/work/mission-agent-management.patch
git apply /opt/data/work/mission-agent-management.patch
node --import tsx --test tests/*.test.ts
npm run build
```
If the parent modified overlapping fleet files after the snapshot, resolve only those patch hunks against `mission-agent-management-base` and `mission-agent-management`; do not overwrite whole files. No additional schema migration or grants beyond MISSION-CONTROL.md's fleet schema/AgentRequest privileges. Rebuild app and bridge together. No deployment was performed.

## Supported
- Settings > Agent Management (`/settings/agents`), five read-only registered identities/profile roots; selected Mission Control agent links directly to its actual SOUL viewer.
- `soul.read`, `soul.write`, `soul.rollback` only. Filesystem implementation exists only in bridge; app imports a filesystem-free validator. No caller file paths, root injection, env/argv or arbitrary config API.
- Reads are durable bridge requests, require enabled/current/online bridge, then return exact UTF-8 SOUL.md plus SHA-256. No generated persona/fallback. Busy inference can delay reads.
- Owner session and canonical same-origin mutations. Fresh password/current boot is inherited from existing bridge enable gate. Every edit/rollback initially awaits approval. Owner reviews immutable submitted payload, then separately approves/rejects. Worker independently validates owner, decision, current boot, operation, registered profile and payload identity. OFF blocks claim/ingress; restart removes stale write approvals; crash-stuck running requests never replay automatically.
- Existing SOUL only, max 65536 bytes. SHA-256 optimistic concurrency; cooperative per-profile exclusive lock; symlinked roots/files/backups and multiply-linked source files rejected. Verified content-addressed backups in `<profile>/.mission-control-soul/<sha256>.md`, mode 0600; fsynced temp file, atomic same-directory rename, directory sync and checksum read-back. Original regular-file permission bits retained subject to process umask.
- Rollback uses a backup checksum, not a path, with current-version compare and its own owner approval; current content is backed up first.
- `audit.jsonl` records intent and commit with owner/request/profile/operation/time/before/after checksums only; never SOUL text, passwords or credentials. Durable owner-private AgentRequest payload/result necessarily stores SOUL text for review and persistence. Do not put credentials in SOUL.
- Persistent statuses, errors and JSON results returned to UI; exact-request GET supports polling; recent SOUL requests can be reopened. UI history is within latest 200 profile requests, not an all-time total.

## Limits / recovery
- No create/delete/restart/model/config controls. No invented model metadata. No credentials were accessed/copied; no live SOUL/config files were changed.
- This is not a sandbox against a hostile local process with the bridge user's filesystem privileges. Cooperative checks serialize bridge edits and catch ordinary external changes, but an uncooperative local writer can race the final checksum/rename. Restrict local write access operationally.
- A bridge/process crash may leave `write.lock` or a temp file. Inspect actual SOUL, backup and audit before removing stale artifacts locally. Never auto-remove a lock based on age or replay an uncertain write. An error after rename may mean content persisted but audit/DB completion failed; reload actual file before deciding a rollback.
- No backup pruning, backup directory browsing, automatic rollback, live tool approval UI, config model parsing or immediate persona hot-reload guarantee. Start an appropriate fresh conversation if Hermes caches SOUL in an existing session.

## Verified
- Full unit suite: **23/23 pass**, including actual five-profile fixture reads, owner approval checks, durable worker success/error path, stale checksum refusal, real temp-file edit/backup/rollback, traversal/override/symlink refusal.
- Production build: **PASS** (Next compilation, TypeScript, all routes). Existing middleware/module-register deprecation warnings only.
- Actual read-only bridge manager verification found five distinct real SOUL.md files at registered roots: default 668 bytes, yana 6358, jenny 13027, michael 6581, michelle 5726. Only byte counts/checksums printed; content not logged. These live reads were separate from fixture-only mutation tests.
- Added `scripts/smoke-management.mjs`: production HTTP + isolated Postgres + real fixture filesystem test, including all five reads/approved writes/stale failures/rollbacks. **Not run**: runtime's gateway-protection hook blocked its launch (also blocked standalone eslint). Do not claim HTTP/Postgres integration coverage from this run. It requires `TEST_BRIDGE_DATABASE_URL=postgresql://<fixture-user>@127.0.0.1:<isolated-port>/mission_bridge_test` with schema pre-pushed and no production data. It truncates test request/control tables and uses port 34721 for its temporary Next server. Agent inference is explicitly a test double, filesystem SOUL operations are real fixture operations.
- An isolated embedded Postgres was initialized only under `/tmp/mc-management-pg-p4_jwen2`; it was stopped cleanly after the hook prevented smoke execution. No production DB used.
