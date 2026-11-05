import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export default async function AdminPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!admin?.isAdmin) redirect("/dashboard");
  const [users, invitations, bookings, payments] = await Promise.all([
    prisma.user.count(), prisma.invitation.count(), prisma.booking.count(),
    prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amountKobo: true } }),
  ]);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header"><a className="wordmark" href="/"><span className="wordmark-icon">♡</span> DATE WITH ME</a><a href="/dashboard" className="dashboard-back">Creator dashboard <span>↗</span></a></header>
      <section className="dashboard-content">
        <p className="modal-kicker">PRIVATE ADMINISTRATION</p>
        <h1 className="dashboard-title">A little <em>overview.</em></h1>
        <div className="admin-metrics">
          <div><small>CREATORS</small><strong>{users}</strong></div>
          <div><small>INVITATIONS</small><strong>{invitations}</strong></div>
          <div><small>BOOKINGS</small><strong>{bookings}</strong></div>
          <div><small>PAID RESERVATIONS</small><strong>₦{((payments._sum.amountKobo ?? 0) / 100).toLocaleString()}</strong></div>
        </div>
        <p className="admin-footnote">Payment totals include only transactions verified by Paystack.</p>
      </section>
    </main>
  );
}