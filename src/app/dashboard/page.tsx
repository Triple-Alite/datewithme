import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const [user, invitations] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.invitation.findMany({
      where: { inviterId: userId },
      include: { booking: { include: { payment: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header"><a className="wordmark" href="/"><span className="wordmark-icon">♡</span> DATE WITH ME</a><a href="/" className="dashboard-back">Back to the invitation <span>↗</span></a></header>
      <section className="dashboard-content">
        <p className="modal-kicker">YOUR LITTLE LOVE NOTES</p>
        <h1 className="dashboard-title">Hello, <em>{user?.name ?? "there"}.</em></h1>
        <p className="dashboard-subtitle">{user?.email}</p>
        <div className="dashboard-toolbar"><h2>Your invitations <span>{invitations.length}</span></h2><a className="dashboard-create" href="/">+ New invitation</a></div>
        {invitations.length ? <div className="invitation-table">
          <div className="table-head"><span>INVITATION</span><span>RESPONSE</span><span>CREATED</span><span>DATE STATUS</span><span>LINK</span></div>
          {invitations.map((invitation) => <div className="table-row" key={invitation.id}>
            <div className="table-person"><strong>{invitation.recipientName}</strong><small>{invitation.feeEnabled ? `Fee · ₦${(invitation.feeAmountKobo / 100).toLocaleString()}` : "No reservation fee"}</small></div>
            <span className={`response-pill response-${invitation.response.toLowerCase()}`}>{invitation.response === "ACCEPTED" ? "Said yes" : invitation.response === "DECLINED" ? "Said no" : "Awaiting reply"}</span>
            <span className="table-date">{invitation.createdAt.toLocaleDateString()}</span>
            <span className={`status-pill ${invitation.booking?.status === "CONFIRMED" ? "confirmed" : "waiting"}`}>{invitation.booking?.status === "CONFIRMED" ? "Confirmed" : invitation.booking ? "Awaiting payment" : "Awaiting reply"}</span>
            <a className="table-link" href={`/invite/${invitation.slug}`} target="_blank" rel="noreferrer">Open <span>↗</span></a>
            {invitation.booking && <p className="booking-detail">{invitation.booking.dateTime.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {invitation.booking.meal}</p>}
          </div>)}
        </div> : <div className="empty-dashboard"><span>♡</span><p>Your first invitation is waiting to be written.</p><a href="/">Make an invitation <span>→</span></a></div>}
        <a className="admin-entry" href="/admin">Administration</a>
      </section>
    </main>
  );
}