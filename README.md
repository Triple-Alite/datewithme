# DATE WITH ME

A romantic invitation and date-booking app built with Next.js, TypeScript, Tailwind CSS, Prisma, and PostgreSQL.

## Local setup

1. Install Node.js 20.9 or newer and PostgreSQL.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL` and a long random `AUTH_SECRET`.
4. Run `npx prisma migrate dev --name initial` and `npx prisma generate`.
5. Run `npm run dev` and open `http://localhost:3000`.

The home page is a working sample invitation. Creating a personalized link requires an account and a configured database. The creator dashboard is at `/dashboard`; `/admin` is restricted to users whose `isAdmin` field is set to `true` in the database.

## Integrations

- Paystack: configure `PAYSTACK_SECRET_KEY`, then register `/api/payments/webhook` in the Paystack dashboard. Use test keys before enabling live charges. The amount is stored and checked in kobo on both verification paths.
- Gmail SMTP: enable 2-Step Verification on the sending Google account, create an App Password, then set `SMTP_USER`, `SMTP_APP_PASSWORD`, and `EMAIL_FROM` in `.env`. Keep the SMTP credentials server-side and never use the normal Google account password. The default settings use `smtp.gmail.com` on port `465` with TLS. Email delivery is best-effort and does not undo a saved booking.
- Deployment: deploy the Next.js app to Vercel, use a managed PostgreSQL URL (Neon or Supabase), and set every variable from `.env.example` in the deployment environment. The production build runs `prisma migrate deploy` before building Next.js. Never expose the Paystack secret or `AUTH_SECRET` to the browser.

Personal Gmail is suitable for low-volume testing and personal use, but Google applies sending limits that can vary by account and may restrict automated sending. It is not a bulk or guaranteed transactional email service; use a dedicated mail provider when delivery volume or reliability becomes important.

## Security notes

Creator sessions are signed, seven-day, HTTP-only, same-site cookies; passwords are hashed with bcrypt. Admin access is checked on the server. API inputs are validated with Zod, invitation slugs are random, and payment success is accepted only after Paystack verification or a valid HMAC-SHA512 webhook. Set a strong `AUTH_SECRET`, use HTTPS in production, and configure infrastructure-level rate limiting for account and payment endpoints before a public launch.
