import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const schema = z.object({ bookingId: z.string().min(1), email: z.string().email().max(254) });

export async function POST(request: Request) {
  if (!process.env.PAYSTACK_SECRET_KEY) return NextResponse.json({ error: "Payments are not configured yet." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid email is required for payment." }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    include: { invitation: true, payment: true },
  });
  if (!booking || !booking.invitation.feeEnabled || booking.invitation.feeAmountKobo < 100) {
    return NextResponse.json({ error: "This booking does not have a payable reservation fee." }, { status: 404 });
  }
  if (booking.status === "CONFIRMED") return NextResponse.json({ error: "This booking is already confirmed." }, { status: 409 });

  const reference = randomUUID();
  if (booking.payment?.status === "SUCCESS") {
    return NextResponse.json({ error: "This reservation fee has already been paid." }, { status: 409 });
  }

  if (booking.payment) {
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
    const claimed = await prisma.payment.updateMany({
      where: {
        id: booking.payment.id,
        status: booking.payment.status,
        ...(booking.payment.status === "PENDING" ? { updatedAt: { lt: staleBefore } } : {}),
      },
      data: { reference, amountKobo: booking.invitation.feeAmountKobo, status: "PENDING" },
    });
    if (claimed.count !== 1) return NextResponse.json({ error: "A payment is already being processed. Try again in a few minutes." }, { status: 409 });
  } else {
    try {
      await prisma.payment.create({ data: { bookingId: booking.id, reference, amountKobo: booking.invitation.feeAmountKobo } });
    } catch (cause) {
      if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") {
        return NextResponse.json({ error: "A payment is already being processed. Try again shortly." }, { status: 409 });
      }
      throw cause;
    }
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: parsed.data.email,
        amount: booking.invitation.feeAmountKobo,
        currency: "NGN",
        reference,
        callback_url: `${origin}/api/payments/verify`,
        metadata: { bookingId: booking.id },
      }),
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok || !payload.status || !payload.data?.authorization_url) throw new Error("Paystack initialization failed.");
    return NextResponse.json({ authorizationUrl: payload.data.authorization_url });
  } catch {
    await prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED" } });
    return NextResponse.json({ error: "Paystack could not start this payment. Try again shortly." }, { status: 502 });
  }
}