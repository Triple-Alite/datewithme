import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation } from "@/lib/email";

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = request.headers.get("x-paystack-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawBody = await request.text();
  const expected = createHmac("sha512", secret).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string; amount?: number; currency?: string; id?: number | string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (event.event === "charge.success" && typeof event.data?.reference === "string" && (typeof event.data.id === "number" || typeof event.data.id === "string")) {
    const payment = await prisma.payment.findUnique({
      where: { reference: event.data.reference },
      include: {
        booking: {
          include: {
            invitation: {
              include: {
                inviter: { select: { email: true } },
              },
            },
          },
        },
      },
    });
    if (payment && event.data.amount === payment.amountKobo && event.data.currency === "NGN") {
      const claimed = await prisma.$transaction(async (transaction) => {
        const result = await transaction.payment.updateMany({
          where: { id: payment.id, status: "PENDING" },
          data: { status: "SUCCESS", paystackTransactionId: String(event.data!.id) },
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
    }
  }

  return NextResponse.json({ received: true });
}