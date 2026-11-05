import nodemailer from "nodemailer";

type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

let transporter: nodemailer.Transporter | undefined;

function getTransporter() {
  const { SMTP_USER, SMTP_APP_PASSWORD } = process.env;
  if (!SMTP_USER || !SMTP_APP_PASSWORD) return null;

  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user: SMTP_USER, pass: SMTP_APP_PASSWORD },
  });
  return transporter;
}

export async function sendEmail(message: EmailMessage) {
  const mailer = getTransporter();
  if (!mailer) return false;

  await mailer.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    ...message,
  });
  return true;
}

export async function sendBookingConfirmation(input: {
  inviterName: string;
  recipientName: string;
  inviterEmail?: string | null;
  recipientEmail?: string | null;
  dateTime: Date;
  meal: string;
}) {
  const date = input.dateTime.toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Lagos" });
  const recipients = [
    input.recipientEmail && { to: input.recipientEmail, name: input.recipientName, other: input.inviterName },
    input.inviterEmail && { to: input.inviterEmail, name: input.inviterName, other: input.recipientName },
  ].filter((recipient): recipient is { to: string; name: string; other: string } => Boolean(recipient));

  await Promise.all(recipients.map(({ to, name, other }) => sendEmail({
    to,
    subject: "It's a date! Your plans are confirmed",
    html: `<p>Hi ${escapeHtml(name)},</p><p>Your date with ${escapeHtml(other)} is confirmed for <strong>${escapeHtml(date)}</strong>.</p><p>Meal mood: ${escapeHtml(input.meal)}.</p><p>With love,<br>DATE WITH ME</p>`,
  })));
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}