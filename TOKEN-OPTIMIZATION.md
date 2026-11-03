# Token Optimization — operator handoff

## Shipped surface

- Owner-only `/token-optimization` and `GET /api/token-optimization`, linked from the messenger left menu. The existing JWT middleware and owner session checks apply; no machine/public API exception was added.
- White responsive page with daily / Monday-start weekly / calendar-monthly controls, all-five-agent filtering, inclusive session-start date filtering, uncached input / output / cache read / cache write / reasoning / total counters, recorded actual and estimated USD, source coverage and freshness.
- Deterministic local collector reads the five registered Hermes SQLite stores and replaces **one existing PostgreSQL DataStore key**, `mc-token-usage-v1`. No Prisma migration, new service, bot, paid provider change or inference call.
- No deployment, push, gateway restart, profile/config/memory/brain edit or automatic schedule is part of this change. The only production-side write performed during local verification was this sanitized DataStore snapshot, through the existing private bridge connection.

## Run locally (on the Hermes host, not inside the web container)

From this repository's source checkout with its existing dependencies installed:

```sh
cd /opt/data/work/repos/hermes-agent-mission-control
npm test
npm run build

# Read-only collection; stdout is aggregate coverage/totals, never source messages.
/usr/local/bin/node --import tsx scripts/collect-token-usage.ts

# Optional sanitized snapshot outside the repository, mode 0600.
/usr/local/bin/node --import tsx scripts/collect-token-usage.ts \
  --output /tmp/mc-token-usage-local.json

# Import using the existing operator-owned private tunnel/runtime JSON.
# The file contents/credentials must never be printed, committed or sourced as shell.
/usr/local/bin/node --import tsx scripts/collect-token-usage.ts \
  --upload \
  --bridge-env /opt/data/home/mission-hq-deploy/bridge-runtime.json
```

`--bridge-env` reads only the connection/transport fields needed by the existing bridge database validator. Without this option, an explicit process `DATABASE_URL` and `BRIDGE_DB_TRANSPORT` may be provided by the operator. Private transport is restricted to existing loopback/private database host names; other hosts require certificate-verified TLS. No tunnel or public port is created by this script. The script does not start the bridge, claim requests, enable execution or spawn Hermes.

Dry run is the default. `--upload` is explicit. Exit 0 = completed; exit 2 = snapshot completed with at least one unavailable SQLite source; exit 1 = bad arguments, output failure or failed database import/readback. Source/schema errors are generic, without paths or exception details. Each upload performs exact JSON readback comparison before reporting `uploaded-and-verified`. A failed PostgreSQL readback does not undo an already successful upsert; rerunning is safe.

The upsert replaces a full snapshot; it never appends/doubles cumulative counters. Source failures replace that source's current rows with an explicit unavailable status, rather than silently serving its previous totals as fresh. Keep the previous DataStore value externally if historical import audit/last-good retention is required.

## Scheduling (parent/operator decision; not installed)

Use an ordinary deterministic local scheduler, not an agent prompt. Example command for a 15-minute schedule, executed from this checkout:

```sh
cd /opt/data/work/repos/hermes-agent-mission-control && \
/usr/bin/flock -n /opt/data/work/token-usage-collector.lock \
/usr/local/bin/node --import tsx scripts/collect-token-usage.ts \
  --upload --bridge-env /opt/data/home/mission-hq-deploy/bridge-runtime.json
```

Provision a private writable lock/log location, restrict runtime JSON permissions, retain the existing tunnel, monitor nonzero exits, and ensure the scheduler uses the Hermes host's dependency-installed checkout. Freshness is based on `collectedAt`: stale after 30 minutes, or if the collector clock is more than one minute ahead. The browser refreshes the read-only API every minute; refreshing the page does not collect or generate anything.

## Metric contract and evidence

### Consumption / dates

Actual schema inspection found `sessions` cumulative counters and `session_model_usage` cumulative per-session/model/provider/task buckets. Neither table is a per-call usage ledger. `messages.timestamp` dates messages, **not token/cost deltas**; it is not used to fabricate a daily series. All usage is attributed to the **session's Warsaw start date**. Multi-day sessions and later updates change earlier buckets; daily/weekly/monthly views are session-start views, not exact call-day billing. Undated sessions are counted separately and excluded from date buckets. No absent date is filled with a synthetic zero.

The installed Hermes canonical accounting (`agent/usage_pricing.py`, `agent/turn_usage.py`, `hermes_state_usage.py`) defines:

```text
total = uncached input + cache read + cache write + output
reasoning is an output subset, not an additional total bucket
```

The collector uses the session summary once for main-loop totals, **not** the duplicated main-loop (`task = ''`) rows in `session_model_usage`. It adds only nonempty-task auxiliary rows, which the installed writer records without touching session summaries (approval, compression, review, title generation, etc.). Background review forks use this auxiliary path; normal stored child sessions remain separately included. Hidden, archived and child sessions are not silently dropped. This is stored counter coverage, not a guarantee of complete provider invoices or retroactive repair of older accounting versions.

`first_seen` / `last_seen` in the model-usage table bound accumulated route buckets; they are not sufficient to split them into call-day deltas. Current model/provider labels are deliberately not used to retroactively attribute session tokens after model switches. The current registered profile IDs/homes remain the source of agent identity.

### Costs

- Actual and estimated values remain separate recorded subtotals, with availability counts. They may overlap: **do not sum the actual and estimated columns**.
- Missing session amounts stay `null`. `included` / `subscription_included` costs stay unavailable even if a legacy estimate is stored. No subscription cost is inferred from token pricing or model names.
- Auxiliary cost columns have `NOT NULL DEFAULT 0`. A positive stored amount proves an amount was recorded even when the writer omitted `cost_status`; an explicit `actual` / `estimated` status permits a real recorded zero. An otherwise ambiguous default zero becomes `null`, not a free-call claim.
- Cost coverage counts refer to session-summary plus auxiliary **records**, not per-call invoices. A partial subtotal is not a full fleet bill. With no records in a selection, consumption and cost cards show unavailable rather than invented zeros.

### Observed retrieval activity, not answer grounding

The parser reads only assistant `tool_calls`, never user prompts, message bodies, reasoning or tool response text. It recognizes structured `read_file` / `search_files` calls whose normalized path is in the canonical `/opt/data/brain/1-wiki` or `/opt/data/brain/0-raw` roots, and explicit `web_search` / `web_extract` calls. Relative paths resolve against the stored session working directory. Supported parallel-call envelopes are unwrapped; path traversal outside canonical roots does not count.

- KB only: explicit KB calls, no observed explicit external call, no bounded/invalid evidence gap.
- External only: explicit external calls, no observed KB call, no bounded/invalid gap.
- Mixed: positive evidence of both, even if other evidence is incomplete.
- Unknown: no recognized evidence, or incomplete evidence without positive evidence of both.

This is **attempted observed retrieval activity**. Calls need not have succeeded, supplied an answer, or reduced tokens. Prompts mentioning a wiki, writes, generic browser activity, shell/code wrappers, delegated summaries and unrecognized tools are deliberately not treated as proof. Historical activity through those paths can remain unknown. The classifier is conservative and not exhaustive.

The displayed KB-only percentage denominator is KB-only + external-only + mixed sessions; unknowns remain visible separately. Call counts and incomplete-session counts are also shown. There is no answer-grounded percentage, causal attribution of session tokens to retrieval, or guessed exact tokens/cost saved. Manual owner wiki ingestion remains unchanged.

Parser bounds: at most 65,536 characters per call envelope, 4,000,000 per session, 20,000 visited tool calls / assistant records, 100 items per envelope and bounded parallel depth. Oversize/invalid evidence is flagged; SQLite rows stream rather than materializing an unbounded transcript. None of the arguments, source session IDs, paths, model strings, prompts or tool results is exported.

## Web deployment steps (parent only)

1. Review this diff and preserve existing authentication, environment files, database volumes, private tunnel and bridge state. Copy only reviewed source to `/docker/mission-hq`; do **not** copy local JSON/screenshot/runtime files, `.env*`, SQLite databases, `node_modules`, `.next` or protected brain/profile contents.
2. Build/recreate only the web app using the existing deployment's Compose configuration. From `/docker/mission-hq` (verify its service name is `app`):

   ```sh
   docker compose config --quiet
   docker compose build app
   docker compose up -d --no-deps app
   docker compose ps app
   ```

   **No `db push`, migration, seed, DB restart, bridge restart or bridge enable is required.** This feature only uses the existing DataStore table. If the live deployment uses override files, retain its existing approved Compose arguments.
3. Run the local upload command above with the existing tunnel available. A verified import has already been made during local implementation; rerunning refreshes it safely.
4. Verify anonymously: `/api/token-optimization` returns 401 and `/token-optimization` redirects to login. Then sign in as owner and open the messenger menu → Token Optimization. Verify all five source statuses, collection timestamp, session-start caveat, actual/estimated availability, daily/weekly/monthly and agent/date filters. Confirm no public/cache bypass.
5. Parent decides whether to install the deterministic local schedule. Without it the imported data remains usable but becomes explicitly stale.
6. Rollback: restore the prior app image/source. The unused DataStore key can remain; deleting only `mc-token-usage-v1` is optional and must not touch other keys or profile stores.

## Verification boundary

Strict RED → GREEN vertical slices covered canonical cache semantics, null/subscription costs, Warsaw DST boundaries, Monday/year and month boundaries, retrieval unknown/mixed/privacy/bounds, read-only collection, auxiliary default-zero semantics, deterministic snapshot equality, idempotent upsert/readback, freshness/disconnection, rendering and auth/navigation. `npm test` and `npm run build` pass. Existing auth, bridge, SOUL and messenger tests remain passing. Build emits the repository's existing Next middleware and Node module-register deprecation warnings.

A real sanitized snapshot was collected from all five local stores and uploaded/read back through the existing private bridge connection. Reimporting the exact same snapshot twice left one key and did not change the bridge enable/boot gate. Runtime snapshot details stay outside this repository, not as embedded dashboard fixtures.

A production-build preview used an isolated loopback PostgreSQL DataStore populated with that **actual sanitized snapshot**, ephemeral owner credentials and the actual login flow. Verified anonymous API 401 / page redirect, authenticated API 200 with exact snapshot equality and no-store, period/agent/date interactions, no document overflow at 390/768/1440 pixels, and no browser page errors. It did not dispatch a request or perform inference. Preview processes and temporary database were stopped/removed. External source stores were never mounted into the preview app.

Deployment/proxy behavior, ongoing scheduler availability, full provider billing reconciliation, future per-call instrumentation and live owner visual acceptance remain parent/operator responsibilities. No claim of deployed UI is made.
