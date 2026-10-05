"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { CustomerIcon, CustomerLogo } from "./CustomerFrame";

function newEventId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export default function ScanClaim({ token }) {
  const router = useRouter();
  const [state, setState] = useState({ kind: "working", message: "Checking this label…" });

  useEffect(() => {
    let active = true;
    const source = new URLSearchParams(window.location.search).get("source") === "camera" ? "camera" : "url";
    const pendingPath = `/q/${encodeURIComponent(token)}${source === "camera" ? "?source=camera" : ""}`;
    const eventKey = `sob-scan-event:${token}`;
    let eventId;
    try {
      eventId = sessionStorage.getItem(eventKey);
      if (!eventId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
        eventId = newEventId();
        sessionStorage.setItem(eventKey, eventId);
      }
      sessionStorage.setItem("sob-pending-scan", pendingPath);
    } catch { eventId = newEventId(); }

    async function finishScan() {
      try {
        const scanEvent = await api("/api/scan-events", { method: "POST", body: JSON.stringify({ token, eventId, source }) }).catch(() => null);
        if (active && scanEvent?.outcome === "invalid") {
          setState({ kind: "error", message: "We couldn’t recognize this QR code. Check the label and try again." });
          return;
        }
        if (active && scanEvent?.outcome === "disabled") {
          setState({ kind: "error", message: "This label is unavailable. Please contact us and share the small serial printed on it." });
          return;
        }
        const session = await api("/api/auth/session", { cache: "no-store" });
        if (!session?.user) {
          router.replace(`/login?next=${encodeURIComponent(pendingPath)}`);
          return;
        }
        const result = await api(`/api/labels/${encodeURIComponent(token)}/claim`, { method: "POST", body: JSON.stringify({ eventId, source }) });
        if (!active) return;
        const box = result.box;
        if (!box?.id) throw new Error("This label was scanned, but its box could not be opened. Please try again.");
        try { sessionStorage.removeItem("sob-pending-scan"); sessionStorage.removeItem(eventKey); } catch {}
        router.replace(`/dashboard/boxes/${encodeURIComponent(box.id)}${result.created ? "?added=1" : ""}`);
      } catch (error) {
        if (!active) return;
        if (error.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pendingPath)}`);
          return;
        }
        const conflict = error.status === 409 || /already|another account|claimed/i.test(error.message || "");
        setState({ kind: conflict ? "claimed" : "error", message: conflict ? "This label is already connected to an account." : (error.message || "We could not open this label. Please try again.") });
      }
    }
    finishScan();
    return () => { active = false; };
  }, [router, token]);

  async function switchAccount() {
    try { await api("/api/auth/logout", { method: "POST", body: "{}" }); } catch {}
    const source = new URLSearchParams(window.location.search).get("source") === "camera" ? "?source=camera" : "";
    router.replace(`/login?next=${encodeURIComponent(`/q/${encodeURIComponent(token)}${source}`)}`);
  }

  return <main className="scan-page">
    <div className="scan-brand"><CustomerLogo /></div>
    <div className={`scan-state scan-state-${state.kind}`}>
      {state.kind === "working" ? <span className="customer-spinner" /> : <span className="scan-state-icon"><CustomerIcon name={state.kind === "claimed" ? "box" : "scan"} size={25} /></span>}
      <h1>{state.kind === "working" ? "Opening your box" : state.kind === "claimed" ? "This label has been used" : "We hit a small snag"}</h1>
      <p>{state.kind === "working" ? state.message : state.kind === "claimed" ? `${state.message} Sign in with the account that first scanned it, or contact us if you need help.` : state.message}</p>
      {state.kind === "claimed" && <button className="customer-button customer-button-primary" onClick={switchAccount}>Try another account</button>}
      {state.kind === "error" && <button className="customer-button customer-button-primary" onClick={() => window.location.reload()}>Try again</button>}
      {(state.kind === "claimed" || state.kind === "error") && <Link className="customer-text-link" href="/contact">Get help with this label</Link>}
    </div>
  </main>;
}
