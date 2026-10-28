import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('legacy API secret gates and GET cache mutation are removed', () => {
  for (const route of ['cache/clear', 'trends/update', 'watchlist-radar/update', 'youtube/ideas', 'client-pulse/map-chat', 'cron/x-stats']) {
    const source = readFileSync(`src/app/api/${route}/route.ts`, 'utf8');
    assert.doesNotMatch(source, /x-internal-secret|CRON_SECRET|INTERNAL_SECRET|INTERNAL_API_SECRET|CLIENT_PULSE_ADMIN_SECRET/, route);
  }
  assert.doesNotMatch(readFileSync('src/app/api/cache/clear/route.ts', 'utf8'), /export async function GET/);
});
