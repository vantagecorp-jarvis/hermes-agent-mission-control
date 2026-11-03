export type SnapshotIntent='tasks'|'agents'|'both';
// Whole-string allowlist grammar, never substring matching or instruction removal.
export function snapshotIntent(message:string):SnapshotIntent|null{
 const text=message.trim().toLowerCase().replace(/\s+/g,' ').replace(/[?.!]$/,'');
 const match=/^(?:(?:give me|show|list) (?:the )?)?(current tasks and agents? details|current tasks|agents? details|how many agents)$/.exec(text);
 if(!match)return null;
 return match[1]==='current tasks'?'tasks':match[1].startsWith('current tasks and ')?'both':'agents';
}
