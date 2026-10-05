"use client";

import { useEffect, useRef, useState } from "react";
import { CustomerIcon } from "./CustomerFrame";

function tokenFromValue(value) {
  try {
    const url = new URL(value, window.location.origin);
    const host = url.hostname.toLowerCase();
    const approvedHost = host === window.location.hostname.toLowerCase() || host === "saveonboxes.com" || host.endsWith(".saveonboxes.com") || host === "saveonboxes.vercel.app";
    if (!approvedHost || !/^\/q\/[A-Za-z0-9_-]{24,64}\/?$/.test(url.pathname)) return null;
    return url.pathname.split("/")[2];
  } catch { return null; }
}

export default function LabelScanner({ onClose, onToken }) {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const foundRef = useRef(false);
  const closeRef = useRef(onClose);
  const [status, setStatus] = useState("ready");
  const [error, setError] = useState("");

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  async function startCamera() {
    if (!videoRef.current || status === "starting" || status === "scanning") return;
    setStatus("starting"); setError("");
    try {
      const module = await import("qr-scanner");
      const QrScanner = module.default;
      const scanner = new QrScanner(videoRef.current, (result) => {
        const value = typeof result === "string" ? result : result?.data;
        const token = tokenFromValue(value || "");
        if (token && !foundRef.current) { foundRef.current = true; scanner.stop(); onToken(token); }
      }, { preferredCamera: "environment", highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true });
      scannerRef.current = scanner;
      await scanner.start();
      setStatus("scanning");
    } catch (e) {
      scannerRef.current?.destroy?.(); scannerRef.current = null;
      setStatus("error");
      setError(e?.name === "NotAllowedError" ? "Camera permission is off. You can scan with your phone’s Camera app instead." : e?.name === "NotFoundError" ? "We couldn’t find a camera on this device. Use your phone’s Camera app to scan the label." : "The camera couldn’t start here. Use your phone’s Camera app to scan the label.");
    }
  }

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => document.querySelector(".scanner-dialog button")?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === "Escape") { closeRef.current(); return; }
      if (event.key === "Tab") {
        const dialog = document.querySelector(".scanner-dialog");
        const focusable = dialog ? [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), video[tabindex="0"]')].filter((node) => node.getClientRects().length) : [];
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer); document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown); scannerRef.current?.stop?.(); scannerRef.current?.destroy?.(); scannerRef.current = null;
      previousFocus?.focus?.();
    };
  }, []);

  return <div className="customer-modal-backdrop" onClick={onClose}>
    <section className="customer-scan-help scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="scanner-title" onClick={(e) => e.stopPropagation()}>
      <button className="customer-modal-close" aria-label="Close scanner" onClick={onClose}><CustomerIcon name="close" /></button>
      <span className="scan-help-icon"><CustomerIcon name="scan" size={24} /></span>
      <h2 id="scanner-title">Scan a box label</h2>
      <p>Scratch the label first. Hold the QR code steady inside the camera view.</p>
      <div className={`scanner-camera scanner-camera-${status}`}>
        <video ref={videoRef} muted playsInline aria-label="Camera view for scanning a box label" />
        {status !== "scanning" && <div className="scanner-camera-placeholder"><CustomerIcon name="scan" size={28} /><span>{status === "starting" ? "Starting camera…" : "Camera preview"}</span></div>}
      </div>
      {error && <p className="scanner-error" role="status">{error}</p>}
      {status === "scanning" ? <p className="scanner-status" role="status">Looking for a QR code…</p> : <button className="customer-button customer-button-primary scanner-start" onClick={startCamera} disabled={status === "starting"}>{status === "starting" ? "Starting…" : error ? "Try camera again" : "Start camera"}</button>}
      <p className="scanner-fallback">Camera not working? Open your phone’s Camera app, scan the label and tap the Save On Boxes link. Keep this account signed in.</p>
    </section>
  </div>;
}
