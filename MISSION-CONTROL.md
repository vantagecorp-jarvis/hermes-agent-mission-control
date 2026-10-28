# Multi-profile Mission Control — deployment handoff

## Supported owner flow
1. Sign in using the existing owner password. Open `/agents` (also `/hermes` or `/tasks`).
2. Bridge starts **OFF on every boot**. Enter the owner password again and Enable owner bridge. Status is based on current heartbeat, never a demo online flag.
3. Select MIA (`default`), YANA, JENNY, MICHAEL or MICHELLE. Each profile has its own remembered Mission Control conversation; New conversation creates a new named Hermes thread. Earlier threads in the latest 200 profile requests are selectable.
4. Type a message, task/workflow or report request. Optional browser microphone dictation fills an **editable preview**; review before submitting. Check explicit authorization. Never paste secrets.
5. Message mode records the owner's execution decision and dispatches immediately. Task mode records the request but waits in the approval inbox. Approve/reject requires authenticated same-origin owner access and the current enabled boot. No unsupported edit button.
6. The durable request shows profile/thread, input modality, owner prompt, authorization/decision dates, lifecycle, actual Hermes stdout result or execution error. UI polls every 2.5 seconds. Profile-native full tool/session transcript stays in that profile's Hermes store.
7. OFF blocks ingress/claims but does not cancel accepted running work. Restart resets OFF and pending approved work to awaiting approval. Running crash-stuck requests are **not replayed**; inspect their profile session before resubmitting.

## Execution contract and policy limits
Uses the installed, help-verified command:
`hermes chat --query-file - --oneshot -Q --continue mc-<profile>-<thread> --create-if-missing --source mission-control --no-restore-cwd --in <registered-home> --max-turns 40 --run-budget 240`

Prompt goes to stdin through `spawn` without a shell. HOME remains `/opt/data`; HERMES_HOME and HERMES_PROFILE are selected exclusively from operator-controlled `hermes-bridge/profiles.mjs`. No model/persona replacements, `-z`, `--yolo`, safe-mode or ignore-config/rules flags. Profile credentials are loaded by Hermes itself, not copied into app configuration. Environment is rebuilt and inherited approval-bypass/profile/session variables are not forwarded. Bridge hard timeout is 300 seconds; output cap 200000 characters.

A tool-enabled owner message is potentially side-effecting, not a claimed read-only operation. The wrapper reiterates standing policies (normal chain through MIA, no autonomous trades/email publication/authoritative wiki writes contrary to existing rules). This is not a new OS sandbox or a deterministic semantic classifier. Existing Hermes/profile tool policies remain authoritative. CLI single-query dangerous-command decisions are handled by installed Hermes/profile approvals; Mission Control does **not** forward nested live tool-approval cards. If Hermes denies an action, revise/inspect through the normal approved route; task-level approval does not override it. No per-request provider/tool/model overrides or arbitrary filesystem profile paths.

The supported local authenticated gateway API would require a separate authenticated routing integration; this release deliberately uses the installed supported CLI named-thread interface rather than inventing gateway endpoints or credentials.

## Database/schema and grants
Apply `prisma/mission-control-upgrade.sql` using the schema-owner role, or use reviewed `prisma db push` after backup. New nullable AgentRequest fields: agentId, sessionKey, authorizedBy, authorizedAt, decidedBy, bootId, transcript; inputMode is non-null text default `text`. Composite agent/thread/time index included. Existing tables/columns preserved. Run `prisma generate` / rebuild app.

Restricted bridge role requires:
- SELECT, UPDATE on `AgentRequest` (already held)
- SELECT, INSERT, UPDATE on `BridgeControl` (already held)
- **NEW** SELECT, INSERT, UPDATE on `DataStore` for the `mc-profiles` snapshot. PostgreSQL table grants do not restrict individual keys; use a dedicated role/RLS if key-level access is required.
No schema ownership, DELETE, public DB listener or profile credential grant needed. App role continues its existing Prisma CRUD privileges.

## Environment / operator prerequisites
App: existing DATABASE_URL, NEXTAUTH_URL canonical HTTPS origin, NEXTAUTH_SECRET, OWNER_PASSWORD_HASH. Bridge: DATABASE_URL, BRIDGE_DB_TRANSPORT=`private` (db/loopback only) or verified `tls`, BRIDGE_HERMES_HOME=`/opt/data`, HERMES_BIN=`/usr/local/bin/hermes`, PATH. Keep production credentials in the existing protected launcher configuration; no new provider key in the web app. Bridge process must run as the existing Hermes user and have normal access to the five registered profile homes and their own provider authentication. Do not alter any profile SOUL/config. Existing tunnel/private PostgreSQL transport stays unchanged.

## Reporting / limits
Bridge snapshots only existence of each state.db and explicitly selected cron registry metadata every 30 seconds. It never mirrors cron prompt/script/config/auth/.env. Missing/unreadable local cron sources are labelled unavailable. Bridge heartbeat is **not gateway liveness**. Completed counts are actual Mission Control request counts, not all historical fleet tasks. No fabricated cost/token/uptime statistics. External kanban mutation, dedicated cron control UI, attachments, live tool-output streaming and nested tool-approval cards are not implemented.

Voice uses browser SpeechRecognition/webkitSpeechRecognition when available over HTTPS (or localhost). Browser/vendor support varies; Chromium is the intended path, unsupported browsers show text fallback. Browser speech service may transmit audio to its vendor. Mission Control stores no raw audio; it stores initial recognized transcript, submitted editable text, and inputMode. Replies are text. Real microphone/browser-vendor recognition must be verified manually on the owner's device; no server STT or synthetic agent voice is claimed.

## Verification
Run `npm test`, `npm run build`, and isolated PostgreSQL/HTTP smoke tests before deploy. Live provider generation/session continuity must be verified after deployment with an owner-authorized harmless prompt and follow-up on each profile; provider failures must be reported, not replaced with fake responses.
