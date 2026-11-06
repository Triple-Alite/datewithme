"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Copy, Heart, LockKeyhole, Mail, Sparkles, Utensils, X } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";

type InvitationData = {
  inviterName: string;
  recipientName: string;
  message: string;
  feeEnabled: boolean;
  feeAmountKobo: number;
  response: "PENDING" | "ACCEPTED" | "DECLINED";
  booking?: { id: string; status: string; dateTime: string; meal: string } | null;
};

type Props = { invitationSlug?: string };

const demoInvitation: InvitationData = {
  inviterName: "Alex",
  recipientName: "you",
  message: "I've been meaning to ask you something...",
  feeEnabled: false,
  feeAmountKobo: 0,
  response: "PENDING",
};

const meals = [
  { name: "Italian", detail: "Pasta, candlelight, the works", icon: "🍝" },
  { name: "Sushi", detail: "A little something adventurous", icon: "🍣" },
  { name: "Something cozy", detail: "Comfort food, please", icon: "🍲" },
  { name: "Surprise me", detail: "I trust your taste", icon: "✨" },
];

const timeSlots = ["12:00 pm", "2:30 pm", "5:00 pm", "7:30 pm"];
const accountSchema = z.object({ email: z.string().email().max(254), password: z.string().min(12).max(128) });
type AccountFields = z.infer<typeof accountSchema>;

export default function DateInvitation({ invitationSlug }: Props) {
  const [invitation, setInvitation] = useState(demoInvitation);
  const router = useRouter();
  const [step, setStep] = useState<"invite" | "yes" | "schedule" | "meal" | "payment" | "complete" | "declined" | "declined-final">("invite");
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [invitationLoading, setInvitationLoading] = useState(Boolean(invitationSlug));
  const [invitationError, setInvitationError] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [meal, setMeal] = useState("");
  const [email, setEmail] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [noCount, setNoCount] = useState(0);

  useEffect(() => {
    if (!invitationSlug) return;
    fetch(`/api/invitations/${encodeURIComponent(invitationSlug)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "This invitation is not available.");
        setInvitation(data);
        if (data.booking) {
          const bookedDate = new Date(data.booking.dateTime);
          setDate(bookedDate.toISOString().slice(0, 10));
          setTime(bookedDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase());
          setMeal(data.booking.meal);
          setBookingId(data.booking.id);
          setStep(data.booking.status === "CONFIRMED" ? "complete" : "payment");
        } else if (data.response === "ACCEPTED") {
          setStep("yes");
        }
        const query = new URLSearchParams(window.location.search);
        if (query.get("booking") === "confirmed" && data.booking?.status === "CONFIRMED") {
          setStep("complete");
        }
        if (query.get("payment") === "failed") {
          setError("That payment did not go through. Your date is saved while you try again.");
          if (data.booking) {
            setBookingId(data.booking.id);
            setStep("payment");
          }
        }
        setInvitationLoading(false);
      })
      .catch((cause: Error) => { setInvitationError(cause.message); setInvitationLoading(false); });
  }, [invitationSlug]);

  const minDate = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }, []);

  async function respond(response: "ACCEPTED" | "DECLINED", nextStep: "yes" | "declined") {
    setError("");
    if (invitationSlug) {
      setBusy(true);
      try {
        const result = await fetch(`/api/invitations/${encodeURIComponent(invitationSlug)}/response`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response }),
        });
        const data = await result.json();
        if (!result.ok) throw new Error(data.error ?? "Your response could not be saved.");
        setInvitation((current) => ({ ...current, response: data.response }));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Your response could not be saved.");
        return;
      } finally {
        setBusy(false);
      }
    }
    if (response === "DECLINED") setNoCount((value) => value + 1);
    setStep(nextStep);
  }

  async function saveBooking() {
    if (!invitationSlug) {
      setStep(invitation.feeEnabled ? "payment" : "complete");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: invitationSlug, dateTime: new Date(`${date}T${convertTime(time)}`).toISOString(), meal }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Your booking could not be saved.");
      setBookingId(data.bookingId);
      setStep(data.requiresPayment ? "payment" : "complete");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function startPayment() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "We couldn't start the payment.");
      window.location.assign(data.authorizationUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  const stepIndex = ["invite", "yes", "schedule", "meal", "payment", "complete"].indexOf(step);

  if (invitationSlug && invitationLoading) return <main className="site-shell loading-screen"><span className="tiny-heart"><Heart size={17} fill="currentColor" /></span><p>A little moment is on its way...</p></main>;
  if (invitationSlug && invitationError) return <main className="site-shell loading-screen"><span className="tiny-heart tiny-heart-soft"><Heart size={17} /></span><h1>This invitation<br /><em>isn't available.</em></h1><p>{invitationError}</p><a className="text-action" href="/">Go home <ArrowRight size={15} /></a></main>;

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Date With Me home"><span className="wordmark-icon"><Heart size={15} fill="currentColor" /></span> DATE WITH ME</a>
        <button className="create-link" onClick={() => { setCreatorOpen(true); setError(""); }}><span>Create your invite</span><ArrowRight size={15} /></button>
      </header>

      <div className="ambient ambient-one" aria-hidden="true">✳</div>
      <div className="ambient ambient-two" aria-hidden="true">♡</div>
      <div className="ambient ambient-three" aria-hidden="true">✿</div>

      <section className="experience" aria-live="polite">
        <div className="experience-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> A LITTLE NOTE FOR {invitation.recipientName.toUpperCase()} <span className="eyebrow-line" /></div>

          {step !== "invite" && step !== "declined" && step !== "declined-final" && <div className="progress-track" aria-label={`Step ${Math.max(stepIndex, 0) + 1} of 5`}><span style={{ width: `${Math.min(100, Math.max(12, (stepIndex / 5) * 100))}%` }} /></div>}

          <AnimatePresence mode="wait">
            <motion.div key={step} className="step-content" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
              {step === "invite" && <>
                <span className="tiny-heart"><Heart size={17} fill="currentColor" /></span>
                <h1>Will you go<br />on a date <em>with me?</em></h1>
                <p className="note-intro">{invitation.message}</p>
                <p className="from-line">with love, <span>{invitation.inviterName}</span></p>
                <div className="choice-row">
                  <button className="button button-primary" disabled={busy} onClick={() => respond("ACCEPTED", "yes")}>Yes, absolutely <Heart size={16} fill="currentColor" /></button>
                  <button className="button button-quiet" disabled={busy} onClick={() => respond("DECLINED", "declined")}>No, thank you</button>
                </div>
              </>}

              {step === "declined" && <>
                <span className="tiny-heart tiny-heart-soft"><Heart size={17} /></span>
                <p className="overline">A PLOT TWIST</p>
                <h1>Oof, my rom-com<br /><em>just became a solo.</em></h1>
                <p className="note-intro">{noCount > 1 ? "Still a no? Got it. No pressure, ever." : "Your answer is totally okay. My imaginary tuxedo is going back on its hanger."}</p>
                <div className="choice-row">
                  <button className="button button-primary" disabled={busy} onClick={() => respond("ACCEPTED", "yes")}>Actually, yes! <Heart size={16} fill="currentColor" /></button>
                  <button className="button button-quiet" onClick={() => setStep("declined-final")}>Still no, thanks</button>
                </div>
              </>}

              {step === "declined-final" && <>
                <span className="tiny-heart tiny-heart-soft"><Heart size={17} /></span>
                <p className="overline">NO PRESSURE, EVER</p>
                <h1>Thanks for<br /><em>being honest.</em></h1>
                <p className="note-intro">No date planning, no guilt, just good vibes. Take care, {invitation.recipientName}.</p>
              </>}

              {step === "yes" && <>
                <span className="tiny-heart"><Sparkles size={18} /></span>
                <p className="overline">THE BEST ANSWER</p>
                <h1>Oh, <em>happy day!</em></h1>
                <p className="note-intro">{invitation.inviterName} is going to be smiling about this all day.</p>
                <button className="button button-primary" onClick={() => setStep("schedule")}>Let&apos;s plan it <ArrowRight size={16} /></button>
              </>}

              {step === "schedule" && <>
                <button className="back-button" onClick={() => setStep("yes")} aria-label="Go back"><ArrowLeft size={17} /></button>
                <p className="overline">FIRST THINGS FIRST</p>
                <h2>When are you <em>free?</em></h2>
                <label className="field-label" htmlFor="date-choice">Pick a date</label>
                <input className="date-input" id="date-choice" type="date" min={minDate} value={date} onChange={(event) => setDate(event.target.value)} />
                <span className="field-label time-label">And a time</span>
                <div className="time-grid">{timeSlots.map((slot) => <button key={slot} className={`time-option ${time === slot ? "selected" : ""}`} onClick={() => setTime(slot)}>{slot}</button>)}</div>
                <button className="button button-primary full-button" disabled={!date || !time} onClick={() => setStep("meal")}>Next <ArrowRight size={16} /></button>
              </>}

              {step === "meal" && <>
                <button className="back-button" onClick={() => setStep("schedule")} aria-label="Go back"><ArrowLeft size={17} /></button>
                <p className="overline">THE IMPORTANT QUESTION</p>
                <h2>What sounds <em>good?</em></h2>
                <p className="meal-prompt">Your date wants to get this just right.</p>
                <div className="meal-list">{meals.map((option) => <button key={option.name} className={`meal-option ${meal === option.name ? "selected" : ""}`} onClick={() => setMeal(option.name)}><span className="meal-emoji">{option.icon}</span><span className="meal-text"><strong>{option.name}</strong><small>{option.detail}</small></span><span className="radio-mark">{meal === option.name && <span />}</span></button>)}</div>
                <button className="button button-primary full-button" disabled={!meal || busy} onClick={saveBooking}>{busy ? "Saving your date..." : "Make it a date"} <ArrowRight size={16} /></button>
              </>}

              {step === "payment" && <>
                <span className="tiny-heart"><LockKeyhole size={17} /></span>
                <p className="overline">ONE LAST THING</p>
                <h2>Your reservation,<br /><em>all set.</em></h2>
                <p className="note-intro">A reservation fee of <strong>₦{(invitation.feeAmountKobo / 100).toLocaleString()}</strong> was included by {invitation.inviterName}.</p>
                <label className="field-label" htmlFor="payment-email">Email for your payment receipt</label>
                <div className="email-field"><Mail size={16} /><input id="payment-email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
                <button className="button button-primary full-button" disabled={!email || busy} onClick={startPayment}>{busy ? "Opening secure checkout..." : `Pay ₦${(invitation.feeAmountKobo / 100).toLocaleString()} securely`} <LockKeyhole size={15} /></button>
                <p className="secure-note">Secure checkout powered by Paystack</p>
              </>}

              {step === "complete" && <>
                <span className="completion-icon"><Check size={24} /></span>
                <p className="overline">IT&apos;S A DATE</p>
                <h1>See you <em>soon!</em></h1>
                <p className="note-intro">{invitation.inviterName} can&apos;t wait. {meal && `${meal} it is.`}</p>
                <div className="booking-summary"><span>{date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Your date"}</span><b>{time}</b><span><Utensils size={14} /> {meal || "Surprise me"}</span></div>
                <p className="small-note">A little something lovely is on its way.</p>
                <button className="text-action" onClick={() => { setStep("invite"); setDate(""); setTime(""); setMeal(""); }}>Back to the beginning <ArrowRight size={15} /></button>
              </>}
            </motion.div>
          </AnimatePresence>

          {error && !creatorOpen && <p className="error-message" role="alert">{error}</p>}
          <div className="step-dots" aria-hidden="true">{[0, 1, 2, 3].map((dot) => <span key={dot} className={dot === Math.min(stepIndex, 3) ? "active" : ""} />)}</div>
          <div className="footer-note"><Heart size={12} fill="currentColor" /> MADE WITH A LITTLE BIT OF COURAGE</div>
        </div>

        <div className="experience-image" role="img" aria-label="Soft pink flowers in the afternoon light">
          <div className="image-caption"><span>an invitation</span><span>to something lovely <Heart size={13} fill="currentColor" /></span></div>
          <div className="image-stamp"><span>say</span><strong>yes</strong><Heart size={17} fill="currentColor" /></div>
        </div>
      </section>

      <AnimatePresence>
        {creatorOpen && <CreatorModal onClose={() => setCreatorOpen(false)} />}
      </AnimatePresence>
    </main>
  );
}

function convertTime(value: string) {
  const [time, meridiem] = value.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (meridiem === "pm" && hours !== 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}

function CreatorModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [form, setForm] = useState({ name: "", recipientName: "", recipientEmail: "", message: "I've been meaning to ask you something...", feeEnabled: false, feeAmountNaira: 2500 });
  const [createdUrl, setCreatedUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const accountForm = useForm<AccountFields>({ resolver: zodResolver(accountSchema) });

  function update(key: keyof typeof form, value: string | number | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(credentials: AccountFields) {
    setBusy(true);
    setError("");
    try {
      if (!sessionReady) {
        const authResponse = await fetch(`/api/auth/${mode === "register" ? "register" : "login"}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: mode === "register" ? form.name : undefined, email: credentials.email, password: credentials.password }),
        });
        const authData = await authResponse.json();
        if (!authResponse.ok) throw new Error(authData.error ?? "We couldn't sign you in.");
        setSessionReady(true);
      }
      if (mode === "login") {
        onClose();
        router.push("/dashboard");
        return;
      }
      const response = await fetch("/api/invitations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviterName: form.name || credentials.email.split("@")[0], recipientName: form.recipientName, message: form.message, email: form.recipientEmail, feeEnabled: form.feeEnabled, feeAmountNaira: form.feeAmountNaira }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "We couldn't create your invitation.");
      setCreatedUrl(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(createdUrl);
    setCopied(true);
  }

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section className="creator-modal" role="dialog" aria-modal="true" aria-labelledby="creator-heading" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        {!createdUrl ? <>
          <span className="modal-kicker">A NOTE, JUST FOR THEM</span>
          <h2 id="creator-heading">{mode === "login" ? <>Welcome <em>back.</em></> : <>Make it <em>personal.</em></>}</h2>
          <div className="auth-switch"><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button></div>
          <form onSubmit={accountForm.handleSubmit(submit)} className="creator-form">
            {mode === "register" && <label>Your name<input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="The brave one" maxLength={80} /></label>}
            <label>Email address<input required type="email" {...accountForm.register("email")} placeholder="you@example.com" maxLength={254} /></label>
            {accountForm.formState.errors.email && <p className="error-message">Enter a valid email address.</p>}
            <label>Password<input required type="password" {...accountForm.register("password")} placeholder="At least 12 characters" minLength={12} maxLength={128} /></label>
            {accountForm.formState.errors.password && <p className="error-message">Use at least 12 characters.</p>}
            {mode === "register" && <>
              <div className="form-divider"><span>YOUR INVITATION</span></div>
              <label>Their name<input required value={form.recipientName} onChange={(event) => update("recipientName", event.target.value)} placeholder="Who is the lucky one?" maxLength={80} /></label>
              <label>Their email <span className="optional-label">optional</span><input type="email" value={form.recipientEmail} onChange={(event) => update("recipientEmail", event.target.value)} placeholder="For a little surprise in their inbox" maxLength={254} /></label>
              <label>Your note<textarea required value={form.message} onChange={(event) => update("message", event.target.value)} rows={2} maxLength={500} /></label>
              <label className="fee-toggle"><span><strong>Add a reservation fee</strong><small>Optional and clearly shown to your guest</small></span><input type="checkbox" checked={form.feeEnabled} onChange={(event) => update("feeEnabled", event.target.checked)} /></label>
              {form.feeEnabled && <label>Reservation fee in naira<input type="number" min={100} max={100000} step={100} value={form.feeAmountNaira} onChange={(event) => update("feeAmountNaira", Number(event.target.value))} /></label>}
            </>}
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="button button-primary full-button" disabled={busy}>{busy ? (mode === "login" ? "Signing in..." : "Making your invitation...") : (mode === "login" ? "Sign in" : "Create account & invitation")} <ArrowRight size={16} /></button>
          </form>
        </> : <div className="link-created">
          <span className="completion-icon"><Check size={24} /></span>
          <p className="overline">READY WHEN YOU ARE</p>
          <h2 id="creator-heading">Your little <em>moment.</em></h2>
          <p className="note-intro">Your invite is ready to send. Their answer is entirely theirs.</p>
          <div className="share-url">{createdUrl}</div>
          <button className="button button-primary full-button" onClick={copyLink}>{copied ? "Link copied" : "Copy invitation link"} {copied ? <Check size={16} /> : <Copy size={16} />}</button>
          <a className="text-action" href={createdUrl}>Preview your invitation <ArrowRight size={15} /></a>
          <a className="text-action" href="/dashboard">Open creator dashboard <ArrowRight size={15} /></a>
        </div>}
      </motion.section>
    </motion.div>
  );
}