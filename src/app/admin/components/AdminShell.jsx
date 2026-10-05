"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, CircleHelp, Command, LayoutDashboard, LogOut, Menu, PackagePlus, ShieldCheck, Users, X } from "lucide-react";
import styles from "./AdminShell.module.css";
import { adminRequest } from "../admin-api.js";

const navigation = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "QR production", href: "/admin/labels", icon: PackagePlus },
  { label: "Scan reports", href: "/admin/reports", icon: Activity },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Support desk", href: "/admin/support", icon: CircleHelp },
  { label: "Audit log", href: "/admin/audit", icon: ShieldCheck },
];

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [operator, setOperator] = useState(null);
  const [authState, setAuthState] = useState("checking");
  const [signingOut, setSigningOut] = useState(false);
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const drawerCloseRef = useRef(null);
  const active = navigation.find((item) => item.href === pathname) || navigation.find((item) => item.href !== "/admin" && pathname.startsWith(item.href)) || navigation[0];

  useEffect(() => {
    let alive = true;
    adminRequest("/api/admin/session")
      .then((result) => { if (alive) { setOperator(result.admin || result.user || result.operator || result); setAuthState("ready"); } })
      .catch((error) => { if (alive) setAuthState(error?.status === 403 ? "customer" : "denied"); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerCloseRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll('a[href], button:not([disabled])') || [];
      const items = Array.from(focusable).filter((item) => item.getClientRects().length > 0);
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawerRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !drawerRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener("keydown", onKeyDown);
      menuButtonRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" }); }
    catch { /* Return to sign-in even when the network is unavailable. */ }
    finally { router.replace("/login"); router.refresh(); }
  }

  if (authState !== "ready") return <div className={`${styles.shell} admin-shell`}>
    <main className={styles.authGate}>
      {authState === "checking" ? <><span className={styles.authSpinner} /><h1>Opening operations</h1><p>Checking administrator access…</p></> : authState === "customer" ? <><span className={styles.gateIcon}><ShieldCheck size={21} /></span><h1>Admin access required</h1><p>Your customer account can manage boxes from your dashboard.</p><Link href="/dashboard" className={styles.gateButton}>Go to my boxes</Link></> : <><span className={styles.gateIcon}><ShieldCheck size={21} /></span><h1>Administrator access required</h1><p>This workspace is restricted to approved super administrators.</p><Link href="/login" className={styles.gateButton}>Sign in to continue</Link></>}
    </main>
  </div>;

  return <div className={`${styles.shell} admin-shell`}>
    <aside ref={drawerRef} id="admin-navigation" className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`} aria-label="Administration navigation" role={open ? "dialog" : undefined} aria-modal={open || undefined}>
      <div className={styles.brandRow}>
        <Link href="/admin" className={styles.brand} onClick={() => setOpen(false)}>
          <span className={styles.brandLogoCrop}><Image src="/assets/Logo.png" width={2481} height={3508} alt="Save On Boxes" className={styles.brandLogoCanvas} priority /></span>
        </Link>
        <button ref={drawerCloseRef} type="button" className={styles.drawerClose} onClick={() => setOpen(false)} aria-label="Close navigation"><X size={19} /></button>
      </div>
      <div className={styles.drawerIdentity}>
        <span className={styles.drawerAvatar}><Command size={15} /></span>
        <span className={styles.drawerIdentityText}><strong>{operator?.email || "Administrator"}</strong><small>Super admin</small></span>
      </div>
      <div className={styles.navLabel}>Workspace</div>
      <nav className={styles.nav}>
        {navigation.map(({ label, href, icon: Icon }) => {
          const selected = active.href === href;
          return <Link key={href} href={href} onClick={() => setOpen(false)} className={`${styles.navItem} ${selected ? styles.navActive : ""}`} aria-current={selected ? "page" : undefined}>
            <Icon size={17} strokeWidth={1.9} /><span>{label}</span>
          </Link>;
        })}
      </nav>
      <div className={styles.sidebarFill} />
    </aside>

    {open && <button className={styles.scrim} aria-label="Close navigation" onClick={() => setOpen(false)} />}

    <div className={styles.mainColumn}>
      <header className={styles.topbar}>
        <button ref={menuButtonRef} className={styles.mobileMenu} aria-label="Open navigation" aria-expanded={open} aria-controls="admin-navigation" onClick={() => setOpen((value) => !value)}>
          {open ? <X size={19} /> : <Menu size={19} />}
        </button>
        <div className={styles.crumb}><span>Operations</span><span className={styles.crumbSlash}>/</span><strong>{active.label}</strong></div>
        <div className={styles.topActions}>
          <span className={styles.securePill}><ShieldCheck size={14} /> Super admin</span>
          <div className={styles.operator} title={operator?.email || "Super administrator"}><span className={styles.avatar}><Command size={15} /></span><span className={styles.operatorEmail}>{operator?.email || "Administrator"}</span></div>
          <button className={styles.signOut} disabled={signingOut} onClick={signOut} title="Sign out"><LogOut size={14} /><span>{signingOut ? "Signing out" : "Sign out"}</span></button>
        </div>
      </header>
      <main className={`${styles.content} admin-content`}>{children}</main>
    </div>
  </div>;
}
