# Response UX handoff

## Scope and safety

Local app-only changes based on `b4584e1`. No deployment, push, bridge restart, profile filesystem access, protected DB/config/memory changes or inference performed by this implementation task. Parent owns review and live deployment/testing. The parent's separate `/opt/data/work/mission-enter-release` directory was not touched.

- Enter sends the authorized nonblank current draft; Shift+Enter inserts a newline. IME composition, legacy keyCode 229 and key-repeat never submit. A synchronous submission guard blocks same-tick/in-flight duplicate HTTP writes.
- Exact whole-question read-only chat intents use deterministic PostgreSQL output: optional `give me` / `show` / `list`, optional `the`, then `current tasks`, `agent details`, `current tasks and agent details`, or `how many agents`; case/whitespace and one final question/full-stop/exclamation mark normalize. Extra instructions never get discarded to force a match.
- Only chat mode can use the shortcut. Explicit authorization and `ownerRequest(req)` (owner session + canonical same-origin) still precede admission. Task mode, unrecognized prompts, boot/bridge/approval checks and approval PATCH routes remain unchanged. DB reads can work while bridge is OFF; arbitrary tool work cannot.
- Snapshots use a repeatable-read transaction: group all existing AgentRequest rows by kind/status; select latest 10 bridge.agent requests; read DataStore `mc-profiles`; then insert completed `dashboard.snapshot`. This prevents self-count/self-summary. No request is executed or arbitrarily marked done; only the new snapshot is completed.
- Result identifies dashboard-only scope, all-row counts versus latest-10 sample, bridge.agent chat/task ambiguity (original mode is not separately persisted), and SOUL/diagnostic/test/other operational kinds. It does not claim a whole-fleet activity tracker. Registration comes from the existing five `registeredProfiles`; recorded metadata comes from `mc-profiles`, not invented runtime health.
- DB read or persistence failure returns 503 with no generated/fallback answer and no Hermes execution.

## Timing and provenance

Inspected baseline `prisma/schema.prisma`: AgentRequest already has nullable `startedAt` and `finishedAt`. Existing `hermes-bridge/core.mjs` records start on claim and finish on completion/failure. No schema change/migration is included.

- New snapshots persist actual recipient/thread, exact prompt, modality/transcript, owner authorization/decision identity/times, created/start/finish times. The recorded processing duration covers DB retrieval/formatting; it is not the complete browser round trip or transaction commit time.
- Same-area reply details show `DB snapshot (no LLM)` only for `dashboard.snapshot`; `bridge.agent` is `Hermes agent (LLM/tools)` with exact provider/model and individual answer sources explicitly not recorded. Legacy unknown kinds stay unknown; database storage alone never changes provenance. No unproven mixed/ChatGPT label.
- A one-second browser clock updates elapsed since request received. Queue wait and execution durations use only actual start/finish fields. Missing/invalid/out-of-order times stay “not recorded”; `updatedAt` is never an inferred execution start.
- No response ETA or countdown is invented. No exact per-request worker hard limit is recorded, so even with a start timestamp the UI says “No reliable ETA.”
- HTTP-in-flight snapshot reads show “Reading database snapshot (no LLM)” immediately. Returned records render directly instead of requiring the next 2.5-second poll. Existing polling remains.
- General Hermes latency remains: full tool-enabled CLI invocation, sequential worker queue, final output after child completion. This patch does not parallelize workers or stream inference.

## Maximize / restore and existing UX

Top-right conversation control has visible maximize/restore icons, labels/titles, `aria-expanded` and `aria-controls`. Expanded mode hides chrome/composer with CSS (does not unmount voice, draft or consent), keeping a visible toolbar/restore button and vertically scrollable viewport. Escape restores unless an open dialog must handle Escape first. Normal-layout reading scroll position is saved/restored even if the expanded viewport clamps its scroll; active thread/history/draft stay mounted. Latest-reply and remembered authorization remain.

Recipient dropdown now uses `appearance:auto` and no fake companion ChevronDown; all real agent options/profile routing are unchanged, matching the parent's deployed hotfix. Key-repeat suppression is also retained.

**Owner reversal honored:** quick tasks are unchanged from deployed `b4584e1`: templates bind agentId, selecting one switches recipient and prefills prompt/mode without executing; editor retains agent selection and displayed agent suffix. Temporary template-only edits/tests were removed. Exact comparison of applyShortcut, default shortcuts and the full editor block against `b4584e1` passed; messenger-state.ts has no diff.

## Files to deploy together

Production changes:
- `src/components/mission-control.tsx`
- `src/app/messenger.css`
- `src/app/api/hermes/dispatch/route.ts`
- `src/lib/answer-view.ts`
- `src/lib/response-ux.ts`
- `src/lib/snapshot-intent.ts`
- `src/lib/dashboard-snapshot.ts`

Tests: `tests/answer-view.test.ts`, `tests/recipient-select.test.ts`, `tests/dashboard-snapshot.test.ts`, `tests/response-ui.test.ts`, `tests/response-ux.test.ts`, `tests/snapshot-intent.test.ts`, `tests/snapshot-route.test.ts`; updated sticky-authorization test checks the centralized conservative gate.

## Verification and deployment (parent only)

RED→GREEN cycles were run for intent matching, DB snapshot service/admission, keyboard/gates/duplicates, provenance/timing, UI wiring, scroll-pending behavior, maximize/restore, native select, and key repeat. Last full suite: `npm test` — **63 passed, 0 failed**. `npm run build` passed (Prisma generation, Next compile, TypeScript, 48 pages). Focused ESLint for new production helpers/route passed. `git diff --check` passed after trimming a CSS trailing blank line. Existing middleware/proxy and Node module.register deprecation warnings remain.

These are service tests with injected DB fixtures, source wiring tests and existing owner/middleware/worker tests, not a new live PostgreSQL/browser integration run. No LLM is required to validate the shortcut. Parent should independently review and execute acceptance checks below.

For this repository's existing Compose setup, from the deployment checkout containing the reviewed changes:

```sh
docker compose config --quiet
docker compose build app
docker compose up -d --no-deps app
docker compose ps app
```

**Do not run db push/migrate/schema tools for this change; do not restart the bridge or change bridge ON/OFF state merely to deploy.** Baseline DB must already have existing startedAt/finishedAt columns. If the live schema differs, stop and reconcile with the parent rather than assuming migration is safe. Existing DB/proxy/env/secrets stay untouched. Rollback is the prior app image only; new dashboard.snapshot rows are unsupported by the worker and cannot become executable tasks.

Parent acceptance:
1. Anonymous dispatch rejected; authenticated cross-origin rejected; authorize=false rejected even for recognized snapshots.
2. With bridge OFF, authorized exact chat `give me the current tasks and agent details` returns HTTP 200 completed dashboard.snapshot; read the exact row back and check recipient/thread, prompt, decisions/times and no worker execution. Compare counts against pre-insert state. Refresh to verify durability.
3. With bridge OFF, appended instructions and task mode do not become snapshots. With bridge ON, task mode remains awaiting_approval until the unchanged approval workflow decides it. Do not run inference just to test input admission.
4. Injected DB failure returns 503/no fake success. Missing mc-profiles metadata must say not recorded/unknown.
5. Verify Enter (one dispatch), Shift+Enter (newline), IME/229 (none), held/repeated Enter (none), authorization/blank/busy guards; intercept dispatch before networking where appropriate.
6. Click the actual native recipient arrow and verify all five agents and YANA selection. Quick tasks must retain their original bound-agent behavior.
7. On desktop and mobile, long answer scrolling, maximize, visible restore, Escape, latest-reply, saved normal scroll, draft/voice/checkbox preservation, no horizontal overflow; test while polling and while HTTP response is pending.
8. Existing bridge.agent answers must say Hermes, not DB-only; old missing times show unknown, running elapsed ticks every second, no guessed ETA.

## Separate urgent Enter-only artifact

`/opt/data/work/mission-enter-only.patch` is a minimal alternative against `b4584e1` (component + composer-keyboard helper + 2 tests), applied and tested in isolated `/tmp/mc-enter-only`. Standalone `/opt/data/work/mission-enter-only.test.ts` also passed there. Parent has since deployed its own isolated Enter/native-select hotfix; use the broader reviewed production files above for the next release, not an accidental merge/reapply of the older emergency patch. The broader implementation includes repeat suppression and the native-select fix.
