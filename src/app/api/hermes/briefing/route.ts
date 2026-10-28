import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const row = await prisma.dataStore.findUnique({ where: { key: "hermes-briefing" } });
  return NextResponse.json(row?.data ?? { generatedAt: null, summary: null, sections: [] });
}

// POST → ask the bridge to (re)generate the chief-of-staff brief now.
export async function POST() {
  return NextResponse.json({ error: 'Blocked in read-only bridge release; execution and mutations require approval', approvalRequired: true }, { status: 403 });
}
