import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json() as {
    telegramChatId?: string;
    title?: string;
    linkedClientId?: string;
    internalUserIds?: string[];
    status?: string;
  };
  if (!body.telegramChatId) return NextResponse.json({ error: "telegramChatId is required" }, { status: 400 });
  const chat = await prisma.clientPulseChat.upsert({
    where: { telegramChatId: body.telegramChatId },
    update: {
      title: body.title,
      linkedClientId: body.linkedClientId,
      internalUserIds: body.internalUserIds || [],
      status: body.status,
    },
    create: {
      telegramChatId: body.telegramChatId,
      title: body.title || body.telegramChatId,
      linkedClientId: body.linkedClientId,
      internalUserIds: body.internalUserIds || [],
      status: body.status || "active",
    },
  });
  return NextResponse.json({ ok: true, chat });
}
