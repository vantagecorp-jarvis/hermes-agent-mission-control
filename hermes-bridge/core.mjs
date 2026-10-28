import { registeredProfiles, profileFor, validateAgentInput } from './profiles.mjs';
export function databaseOptions(connectionString, mode) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.search) throw new Error('Direct Postgres URL without query overrides required');
  if (mode === 'private' && ['db', 'localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    return { connectionString, ssl: false, max: 4 };
  }
  if (mode === 'tls') return { connectionString, ssl: { rejectUnauthorized: true }, max: 4 };
  throw new Error('Use private db/loopback transport or certificate-verified TLS');
}

export function hermesInvocation(home) {
  // Fixed owner default/MIA home, never infer a profile from inherited env.
  if (home !== '/opt/data') throw new Error('Only the explicit default/MIA home /opt/data is permitted');
  return { args: ['--version'], env: { PATH: process.env.PATH, HOME: home, HERMES_HOME: home, HERMES_PROFILE: 'default', LANG: 'C.UTF-8' }, cwd: '/tmp' };
}

export class BridgeWorker {
  constructor(db, invoke) { this.db = db; this.invoke = invoke; }
  async start(bootId) {
    this.bootId = bootId;
    await this.db.query(`INSERT INTO "BridgeControl" (id, "bootId", enabled, "heartbeatAt") VALUES ('owner',$1,false,now())
      ON CONFLICT (id) DO UPDATE SET "bootId"=$1, enabled=false, "heartbeatAt"=now()`, [bootId]);
    // OFF is established before changing queued approvals; no stale-boot ingress window.
    await this.db.query(`UPDATE "AgentRequest" SET status='awaiting_approval', "decidedBy"=NULL, "decidedAt"=NULL, "updatedAt"=now() WHERE kind='bridge.agent' AND status='approved'`);
  }
  async heartbeat() {
    const result = await this.db.query(`UPDATE "BridgeControl" SET "heartbeatAt"=now() WHERE id='owner' AND "bootId"=$1 RETURNING id`, [this.bootId]);
    if (!result.rows.length) throw new Error('Bridge ownership lost');
  }
  async claim() {
    // Control row lock serializes OFF against claims; row locks prevent duplicate execution.
    const { rows } = await this.db.query(`WITH gate AS MATERIALIZED (
      SELECT id FROM "BridgeControl" WHERE id='owner' AND "bootId"=$1 AND enabled=true
        AND "heartbeatAt">now()-interval '15 seconds' FOR UPDATE
    ), candidate AS (
      SELECT r.id FROM "AgentRequest" r, gate WHERE r.status IN ('queued','approved')
        AND r.kind='bridge.agent' AND r.status='approved' AND r."sideEffecting"=true
        AND r."authorizedBy"='owner' AND r."authorizedAt" IS NOT NULL AND r."decidedBy"='owner' AND r."decidedAt" IS NOT NULL
        AND r."bootId"=$1 AND r."agentId"=ANY($2::text[])
        AND r."sessionKey" IS NOT NULL
      ORDER BY r."createdAt" FOR UPDATE OF r SKIP LOCKED LIMIT 1
    ) UPDATE "AgentRequest" r SET status='running', "startedAt"=now(), "updatedAt"=now()
      FROM candidate WHERE r.id=candidate.id RETURNING r.*`, [this.bootId, registeredProfiles.map(p=>p.id)]);
    return rows[0] ?? null;
  }
  async execute(request) {
    // Version diagnostic remains non-agent; legacy arbitrary kinds never run.
    if (request.kind === 'hermes.version' && request.sideEffecting === false) return this.invoke();
    if (request.kind !== 'bridge.agent' || request.sideEffecting !== true || request.authorizedBy !== 'owner' || !request.authorizedAt || request.decidedBy !== 'owner' || !request.decidedAt || request.bootId !== this.bootId) throw new Error('Missing current-boot owner authorization/approval');
    profileFor(request.agentId);
    validateAgentInput({agentId:request.agentId,sessionKey:request.sessionKey,message:request.prompt,mode:'chat',authorize:true});
    return this.invoke(request);
  }
  async tick() {
    const request = await this.claim();
    if (!request) return;
    try {
      const result = await this.execute(request);
      await this.db.query(`UPDATE "AgentRequest" SET status='done', result=$2, "finishedAt"=now(), "updatedAt"=now() WHERE id=$1 AND status='running'`, [request.id, result.slice(0, 200000)]);
    } catch (error) {
      await this.db.query(`UPDATE "AgentRequest" SET status='failed', error=$2, "finishedAt"=now(), "updatedAt"=now() WHERE id=$1 AND status='running'`, [request.id, String(error?.message || 'Agent execution failed').slice(0,4000)]);
    }
  }
}
