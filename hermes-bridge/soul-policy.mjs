import {registeredProfiles} from './profiles.mjs';
export const soulOps = ['soul.read','soul.write','soul.rollback'];
export function validateSoulInput(b) {
 if(!b || !soulOps.includes(b.op) || !registeredProfiles.some(p=>p.id===b.agentId)) throw Error('Unknown SOUL operation or registered agent');
 const keys=['op','agentId',...(b.op==='soul.write'?['content','expectedVersion']:b.op==='soul.rollback'?['backupVersion','expectedVersion']:[])];
 if(Object.keys(b).some(k=>!keys.includes(k))) throw Error('Only explicit SOUL fields accepted; no paths or overrides');
 if(b.op!=='soul.read' && !/^[a-f0-9]{64}$/.test(b.expectedVersion)) throw Error('Current SHA-256 version required');
 if(b.op==='soul.write' && (typeof b.content!=='string' || Buffer.byteLength(b.content)>65536 || !b.content.trim() || b.content.includes('\0'))) throw Error('SOUL must be nonempty UTF-8 text, max 65536 bytes without NUL');
 if(b.op==='soul.rollback' && !/^[a-f0-9]{64}$/.test(b.backupVersion)) throw Error('Backup SHA-256 required');
 return b;
}
