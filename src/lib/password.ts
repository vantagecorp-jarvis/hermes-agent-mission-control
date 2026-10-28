import { scrypt, timingSafeEqual } from 'node:crypto';

// Fixed work factor: untrusted/misconfigured hashes cannot request excessive work.
export async function verifyPassword(password: unknown, encoded: string | undefined): Promise<boolean> {
  if (typeof password !== 'string' || !password || Buffer.byteLength(password) > 1024) return false;
  const match = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded ?? '');
  if (!match) return false;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, match[1], 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => {
      if (err) reject(err); else resolve(key);
    });
  });
  return timingSafeEqual(derived, Buffer.from(match[2], 'hex'));
}
