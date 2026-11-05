import { hash } from "bcryptjs";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  if (!process.env.AUTH_SECRET || !process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Account services are not configured." }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and a password of at least 12 characters." }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });

  const user = await prisma.user.create({
    data: { name: parsed.data.name, email, passwordHash: await hash(parsed.data.password, 12) },
    select: { id: true },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true }, { status: 201 });
}