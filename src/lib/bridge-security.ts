import { verifyPassword } from './password';

// Scale-one process limiter; edge rate limiting remains mandatory.
export function freshPasswordGate(clock = Date.now) {
  let start = 0, attempts = 0, busy = false;
  return async (password: unknown, hash: string | undefined) => {
    const now = clock();
    if (now - start >= 60_000) { start = now; attempts = 0; }
    if (busy || ++attempts > 10) return false;
    busy = true;
    try { return await verifyPassword(password, hash); }
    finally { busy = false; }
  };
}

export function operationPolicy(kind: unknown) {
  const supported = kind === 'hermes.version';
  return { supported, approvalRequired: !supported };
}

export function controlOriginAllowed(headers: Headers, canonical: string | undefined) {
  if (!canonical || headers.get('sec-fetch-site') === 'cross-site') return false;
  try { return headers.get('origin') === new URL(canonical).origin; }
  catch { return false; }
}
