"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, safeNextPath } from "./api";
import { CustomerIcon, CustomerLogo } from "./CustomerFrame";
import { Button } from "../../../components/ui/button.jsx";
import { Input } from "../../../components/ui/input.jsx";

export default function PasswordRecovery({ mode }) {
  const router = useRouter();
  const requesting = mode === "request";
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [continuation, setContinuation] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!requesting) setToken(params.get("token") || "");
    const requestedNext = params.get("next");
    const safeNext = requestedNext ? safeNextPath(requestedNext) : "";
    setContinuation(safeNext && safeNext !== "/dashboard" ? safeNext : "");
  }, [requesting]);

  const loginHref = continuation ? `/login?next=${encodeURIComponent(continuation)}` : "/login";

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (requesting) {
        const requestedNext = new URLSearchParams(window.location.search).get("next");
        await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email, ...(requestedNext ? { next: safeNextPath(requestedNext) } : {}) }) });
        setSent(true);
      } else {
        if (!token) throw new Error("This reset link is missing. Request a new one to continue.");
        await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
        router.replace(`/login?reset=1${continuation ? `&next=${encodeURIComponent(continuation)}` : ""}`);
      }
    } catch (e) { setError(e.message || "We could not complete that request."); }
    finally { setBusy(false); }
  }

  return <main className="auth-page recovery-page">
    <section className="auth-panel recovery-panel">
      <Link href="/" className="customer-mark auth-mark" aria-label="Save On Boxes home"><CustomerLogo /></Link>
      <div className="auth-content">
        <Link className="recovery-back" href={loginHref}>Back to log in</Link>
        <h1>{requesting ? "Forgot your password?" : "Choose a new password."}</h1>
        <p className="auth-lede">{requesting ? "Enter your email and we’ll send a secure link to reset it." : "Choose a password with at least 12 characters."}</p>
        {sent ? <div className="recovery-sent" role="status"><span className="added-check"><CustomerIcon name="check" size={15} /></span><div><strong>Check your email.</strong><p>If an account exists for that address, a reset link is on its way. It expires in one hour.</p></div></div> : <form className="auth-form" onSubmit={submit}>
          {requesting ? <label>Email address<Input className="auth-input" autoComplete="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label> : <label>New password<Input className="auth-input" autoComplete="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 12 characters" minLength={12} required /></label>}
          {error && <p className="customer-alert" role="alert">{error}</p>}
          <Button className="customer-button customer-button-primary auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : requesting ? "Send reset link" : "Save new password"}</Button>
        </form>}
        {sent && <Link className="customer-button customer-button-primary recovery-login" href={loginHref}>Back to log in</Link>}
      </div>
    </section>
  </main>;
}
