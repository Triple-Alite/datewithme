import { randomBytes } from "node:crypto";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { escapeHtml, sendEmail } from "@/lib/email";

const schema = z.object({
  inviterName: z.string().trim().min(1).max(80),
  recipientName: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(500),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  feeEnabled: z.boolean(),
  feeAmountNaira: z.number().int().min(100).max(100000).optional(),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to create an invitation." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the invitation details and try again." }, { status: 400 });

  const { feeAmountNaira = 0, ...data } = parsed.data;
  const invitation = await prisma.invitation.create({
    data: {
      ...data,
      email: data.email || null,
      feeAmountKobo: data.feeEnabled ? feeAmountNaira * 100 : 0,
      inviterId: userId,
      slug: randomBytes(9).toString("base64url"),
    },
    select: { slug: true, recipientName: true },
  });

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/invite/${invitation.slug}`;
  if (data.email) {
    await sendEmail({
      to: data.email,
      subject: `${data.inviterName} has a little question for you`,
      html: `<p>Hi ${escapeHtml(invitation.recipientName)},</p><p>${escapeHtml(data.inviterName)} has sent you a date invitation.</p><p><a href="${escapeHtml(url)}">Open your invitation</a></p>`,
    }).catch(() => undefined);
  }

  return NextResponse.json({ slug: invitation.slug, url }, { status: 201 });
}