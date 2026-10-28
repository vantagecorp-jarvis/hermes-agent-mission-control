import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CACHE_KEYS = ['notion_clients_monthly', 'mcf_monthly', 'ltv_monthly'];

export async function POST() {

  const results = await Promise.all(
    CACHE_KEYS.map(key => prisma.dataStore.delete({ where: { key } }).then(() => ({ key, cleared: true })).catch(() => ({ key, cleared: false })))
  );
  return NextResponse.json({ results });
}
