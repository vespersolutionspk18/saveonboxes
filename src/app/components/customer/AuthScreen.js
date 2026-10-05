"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, signInDestination } from "./api";
import { CustomerIcon, CustomerLogo } from "./CustomerFrame";
import { Button } from "../../../components/ui/button.jsx";
import { Input } from "../../../components/ui/input.jsx";

export default function AuthScreen({ mode }) {
  const router = useRouter();
  const registering = mode === "register";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState({ email: "", password: "", phone: "" });
  const [linkQuery, setLinkQuery] = useState("");
  const [resetNotice, setResetNotice] = useState(false);
  useEffect(() => {
    setLinkQuery(window.location.search);
    setResetNotice(new URLSearchParams(window.location.search).get("reset") === "1");
  }, []);

  async function submit(event) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = await api(registering ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify(registering ? values : { email: values.email, password: values.password }),
      });
      let requestedNext = new URLSearchParams(window.location.search).get("next");
      try { sessionStorage.removeItem("sob-auth-next"); } catch {}
      router.replace(signInDestination(result.user, requestedNext));
      router.refresh();
    } catch (e) { setError(e.message || "We could not sign you in. Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="auth-page">
    <div className="auth-art" aria-hidden="true"><div className="auth-art-circle" /><div className="auth-art-copy"><strong>Move in<br />with a plan.</strong><p>Your boxes know where they belong.</p><div className="auth-art-boxes"><i /><i /><i /></div></div></div>
    <section className="auth-panel">
      <Link href="/" className="customer-mark auth-mark" aria-label="Save On Boxes home"><CustomerLogo /></Link>
      <div className="auth-content">
        <h1>{registering ? "Make room for a smoother move." : "Welcome back."}</h1>
        <p className="auth-lede">{registering ? "One simple account for every box, room and little thing inside." : "Your boxes and their contents are right where you left them."}</p>
        {!registering && resetNotice && <div className="recovery-sent login-reset-notice" role="status"><span className="added-check"><CustomerIcon name="check" size={15} /></span><div><strong>Password updated.</strong><p>Log in with your new password.</p></div></div>}
        <form className="auth-form" onSubmit={submit}>
          <label>Email address<Input className="auth-input" autoComplete="email" type="email" inputMode="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} placeholder="you@example.com" required /></label>
          {registering && <label>Phone number<Input className="auth-input" autoComplete="tel" type="tel" inputMode="tel" value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} placeholder="Your phone number" required /></label>}
          <label>Password<Input className="auth-input" autoComplete={registering ? "new-password" : "current-password"} type="password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} placeholder={registering ? "At least 12 characters" : "Your password"} minLength={registering ? 12 : undefined} required /></label>
          {!registering && <Link className="forgot-password-link" href={`/forgot-password${linkQuery}`}>Forgot password?</Link>}
          {error && <p className="customer-alert" role="alert">{error}</p>}
          <Button className="customer-button customer-button-primary auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : registering ? "Create my account" : "Log in"}</Button>
        </form>
        <p className="auth-switch">{registering ? "Already have an account?" : "New to Save On Boxes?"} <Link href={`${registering ? "/login" : "/register"}${linkQuery}`}>{registering ? "Log in" : "Create an account"}</Link></p>
      </div>
    </section>
  </main>;
}
