import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation } from "@/lib/email";

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("reference");
  if (!reference || !process.env.PAYSTACK_SECRET_KEY) return NextResponse.json({ error: "Payment reference is missing." }, { status: 400 });

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok || !payload.status || payload.data?.status !== "success") {
    await prisma.payment.updateMany({ where: { reference }, data: { status: "FAILED" } });
    const failedPayment = await prisma.payment.findUnique({ where: { reference }, include: { booking: { include: { invitation: true } } } });
    return NextResponse.redirect(new URL(failedPayment ? `/invite/${failedPayment.booking.invitation.slug}?payment=failed` : "/?payment=failed", request.url));
  }

  const payment = await prisma.payment.findUnique({ where: { reference }, include: { booking: { include: { invitation: { include: { inviter: { select: { email: true } } } } } } } });
  if (!payment || payload.data.amount !== payment.amountKobo || payload.data.currency !== "NGN") {
    return NextResponse.json({ error: "Payment details could not be verified." }, { status: 400 });
  }
  const claimed = await prisma.$transaction(async (transaction) => {
    const result = await transaction.payment.updateMany({
      where: { reference, status: "PENDING" },
      data: { status: "SUCCESS", paystackTransactionId: String(payload.data.id) },
    });
    await transaction.booking.update({ where: { id: payment.bookingId }, data: { status: "CONFIRMED" } });
    return result.count === 1;
  });
  if (claimed) {
    await sendBookingConfirmation({
      inviterName: payment.booking.invitation.inviterName,
      recipientName: payment.booking.invitation.recipientName,
      inviterEmail: payment.booking.invitation.inviter?.email,
      recipientEmail: payment.booking.invitation.email,
      dateTime: payment.booking.dateTime,
      meal: payment.booking.meal,
    }).catch(() => undefined);
  }
  return NextResponse.redirect(new URL(`/invite/${payment.booking.invitation.slug}?booking=confirmed`, request.url));
}