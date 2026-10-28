import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const action = (b.action || "").toString(); // approve | reject | edit
  const existing = await prisma.agentRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!["awaiting_approval", "queued"].includes(existing.status))
    return NextResponse.json({ error: `cannot decide a ${existing.status} request` }, { status: 409 });

  if (action !== "reject") return NextResponse.json({ error: "Approvals and edits are blocked in the read-only bridge release" }, { status: 403 });
  const data = { decidedAt: new Date(), status: "rejected" };
  const updated = await prisma.agentRequest.updateMany({ where: { id, status: { in: ["awaiting_approval", "queued"] } }, data });
  if (!updated.count) return NextResponse.json({ error: "Request already claimed or decided" }, { status: 409 });
  const row = await prisma.agentRequest.findUnique({ where: { id } });
  return NextResponse.json({ request: row });
}
