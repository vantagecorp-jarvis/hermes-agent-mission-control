"use client";
import { useCallback, useEffect, useState } from 'react';
type State = { online: boolean; enabled: boolean; bootId: string | null };
export function BridgeControl() {
  const [state, setState] = useState<State | null>(null);
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try { const r = await fetch('/api/hermes/bridge', { cache: 'no-store' }); if (!r.ok) throw Error(); setState(await r.json()); }
    catch { setState(null); }
  }, []);
  useEffect(() => { const initial = setTimeout(refresh, 0); const timer = setInterval(refresh, 3000); return () => { clearTimeout(initial); clearInterval(timer); }; }, [refresh]);
  async function toggle(enabled: boolean) {
    setBusy(true); setNote('');
    try {
      const r = await fetch('/api/hermes/bridge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, bootId: state?.bootId, password: enabled ? password : undefined }) });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || 'Control failed');
      setState(result);
      setNote(enabled ? 'Read-only bridge enabled.' : 'OFF: no new work will start. Already claimed work may finish.');
    } catch (e) { setNote(e instanceof Error ? e.message : 'Control failed'); await refresh(); }
    finally { setPassword(''); setBusy(false); }
  }
  async function checkVersion() {
    const r = await fetch('/api/hermes/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'hermes.version' }) });
    setNote(r.ok ? 'Version check queued; see dispatch results below.' : (await r.json()).error);
  }
  return <section className="mb-8 p-5 border rounded-xl border-[var(--line)]" aria-label="Bridge control">
    <h2 className="font-semibold">Bridge {state?.online ? state.enabled ? 'ON — read-only' : 'OFF' : 'OFFLINE / UNKNOWN — unavailable'}</h2>
    <p className="text-sm my-2">Only Hermes version checks are supported. Prompts, send/email/trade, cron/kanban mutations, briefings and wiki access are blocked. Every restart is OFF. OFF stops new claims, not a task already claimed.</p>
    {!state?.enabled && <input aria-label="Fresh owner password" type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} className="border rounded p-2 bg-transparent mr-3" placeholder="Owner password" />}
    <button disabled={busy || !state?.online || (!state.enabled && !password)} onClick={() => toggle(!state?.enabled)} className="btn-ghost px-3 py-2">{state?.enabled ? 'Disable bridge' : 'Enable read-only bridge'}</button>
    <button disabled={!state?.online || !state.enabled || busy} onClick={checkVersion} className="btn-ghost px-3 py-2">Check Hermes version</button>
    <p role="status" className="text-sm mt-2">{note}</p>
  </section>;
}
