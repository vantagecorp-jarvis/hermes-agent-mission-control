// Operator-controlled registration. IDs are the API, never accept caller paths.
export const registeredProfiles = Object.freeze([
  { id: 'default', name: 'MIA', home: '/opt/data' },
  ...['yana', 'jenny', 'michael', 'michelle'].map(id => ({ id, name: id.toUpperCase(), home: `/opt/data/profiles/${id}` })),
].map(profile => Object.freeze(profile)));
export function profileFor(id) {
  const profile = registeredProfiles.find(p => p.id === id);
  if (!profile) throw new Error('Unknown registered agent');
  return profile;
}
export function validateAgentInput(body) {
  profileFor(body.agentId);
  if (typeof body.sessionKey !== 'string' || !/^[a-z0-9][a-z0-9-]{7,63}$/.test(body.sessionKey) || ['latest','default'].includes(body.sessionKey)) throw new Error('Invalid Mission Control thread');
  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 24000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body.message)) throw new Error('Message must be 1–24000 characters, without control bytes');
  if (body.authorize !== true) throw new Error('Explicit owner execution authorization required');
  if (body.history !== undefined || body.home !== undefined || body.args !== undefined || body.env !== undefined) throw new Error('History, home, argv and environment are server controlled');
  if (!['chat','task'].includes(body.mode)) throw new Error('Mode must be chat or task');
  if (body.inputMode !== undefined && !['text','voice'].includes(body.inputMode)) throw new Error('Invalid input modality');
  if (body.transcript != null && (typeof body.transcript !== 'string' || body.transcript.length > 24000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body.transcript))) throw new Error('Invalid voice transcript');
  return { agentId: body.agentId, sessionKey: body.sessionKey, message: body.message, mode: body.mode, authorize: true, inputMode: body.inputMode || 'text', transcript: body.transcript || null };
}
export function agentInvocation(input) {
  const body = validateAgentInput(input);
  const profile = profileFor(body.agentId);
  return {
    args: ['chat', '--query-file', '-', '--oneshot', '-Q', '--continue', `mc-${profile.id}-${body.sessionKey}`, '--create-if-missing', '--source', 'mission-control', '--no-restore-cwd', '--in', profile.home, '--max-turns', '40', '--run-budget', '240'],
    env: { PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin', HOME: '/opt/data', HERMES_HOME: profile.home, HERMES_PROFILE: profile.id, LANG: 'C.UTF-8', TERM: 'dumb' },
    cwd: profile.home,
    stdin: '[Mission Control: authenticated owner explicitly authorized this request. This is a real tool-enabled task, not a read-only persona chat. Preserve all existing profile SOUL, memory, skills and standing policies. Direct owner access does not change the normal reporting chain through MIA. No autonomous trades, email sending/publication, or authoritative wiki writes contrary to standing rules. Request approval rather than bypassing a blocked action. Never enable YOLO or weaken approvals.]\n\n' + body.message,
  };
}
