import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation } from "@/lib/email";

const schema = z.object({
  slug: z.string().min(8).max(80),
  dateTime: z.string().datetime(),
  meal: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || new Date(parsed.data.dateTime) <= new Date()) {
    return NextResponse.json({ error: "Choose a valid date in the future and a meal." }, { status: 400 });
  }

  const invitation = await prisma.invitation.findUnique({ where: { slug: parsed.data.slug, active: true } });
  if (!invitation) return NextResponse.json({ error: "This invitation is no longer available." }, { status: 404 });
  const existingBooking = await prisma.booking.findUnique({ where: { invitationId: invitation.id } });
  if (existingBooking) return NextResponse.json({ error: "A booking has already been made for this invitation." }, { status: 409 });

  const booking = await prisma.booking.create({
    data: {
      invitationId: invitation.id,
      dateTime: new Date(parsed.data.dateTime),
      meal: parsed.data.meal,
      note: parsed.data.note,
      status: invitation.feeEnabled ? "PENDING" : "CONFIRMED",
    },
    select: { id: true, status: true },
  });
  if (!invitation.feeEnabled) {
    const inviter = invitation.inviterId ? await prisma.user.findUnique({ where: { id: invitation.inviterId }, select: { email: true } }) : null;
    await sendBookingConfirmation({
      inviterName: invitation.inviterName,
      recipientName: invitation.recipientName,
      inviterEmail: inviter?.email,
      recipientEmail: invitation.email,
      dateTime: new Date(parsed.data.dateTime),
      meal: parsed.data.meal,
    }).catch(() => undefined);
  }
  return NextResponse.json({ bookingId: booking.id, status: booking.status, requiresPayment: invitation.feeEnabled }, { status: 201 });
}