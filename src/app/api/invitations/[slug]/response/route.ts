import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const schema = z.object({ response: z.enum(["ACCEPTED", "DECLINED"]) });

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose yes or no to respond." }, { status: 400 });

  const invitation = await prisma.invitation.findUnique({
    where: { slug, active: true },
    include: { booking: { select: { id: true } } },
  });
  if (!invitation) return NextResponse.json({ error: "This invitation is no longer available." }, { status: 404 });
  if (invitation.booking && parsed.data.response === "DECLINED") {
    return NextResponse.json({ error: "A booking has already been made for this invitation." }, { status: 409 });
  }

  const updated = await prisma.invitation.update({
    where: { id: invitation.id },
    data: { response: parsed.data.response },
    select: { response: true },
  });
  return NextResponse.json(updated);
}