// Restricted release: no prompts, filesystem/wiki access, hooks or mutations.
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
        AND r.kind='hermes.version' AND r."sideEffecting"=false
      ORDER BY r."createdAt" FOR UPDATE OF r SKIP LOCKED LIMIT 1
    ) UPDATE "AgentRequest" r SET status='running', "startedAt"=now(), "updatedAt"=now()
      FROM candidate WHERE r.id=candidate.id RETURNING r.*`, [this.bootId]);
    return rows[0] ?? null;
  }
  async execute(request) {
    if (request.kind !== 'hermes.version' || request.sideEffecting !== false) throw new Error('Operation blocked; execution and mutations require approval and are unsupported');
    return this.invoke();
  }
  async tick() {
    const request = await this.claim();
    if (!request) return;
    try {
      const result = await this.execute(request);
      await this.db.query(`UPDATE "AgentRequest" SET status='done', result=$2, "finishedAt"=now(), "updatedAt"=now() WHERE id=$1 AND status='running'`, [request.id, result.slice(0, 8000)]);
    } catch {
      await this.db.query(`UPDATE "AgentRequest" SET status='failed', error='Read-only version check failed', "finishedAt"=now(), "updatedAt"=now() WHERE id=$1 AND status='running'`, [request.id]);
    }
  }
}
