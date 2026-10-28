// Web Crypto keeps this helper compatible with JWT middleware runtimes.
export async function credentialVersion(): Promise<string | null> {
  const hash = process.env.OWNER_PASSWORD_HASH;
  if (!hash || !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash)) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hash));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
