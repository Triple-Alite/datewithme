import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const invitation = await prisma.invitation.findUnique({
    where: { slug, active: true },
    select: { slug: true, inviterName: true, recipientName: true, message: true, feeEnabled: true, feeAmountKobo: true, response: true, booking: { select: { id: true, status: true, dateTime: true, meal: true } } },
  });
  if (!invitation) return NextResponse.json({ error: "This invitation could not be found." }, { status: 404 });
  return NextResponse.json(invitation);
}