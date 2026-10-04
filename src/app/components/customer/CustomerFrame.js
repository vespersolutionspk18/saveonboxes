import Link from "next/link";

function Mark() {
  return <Link href="/dashboard" className="customer-mark" aria-label="Save On Boxes home">
    <span className="customer-mark-symbol" aria-hidden="true">S</span>
    <span>save<span>on</span>boxes</span>
  </Link>;
}

export function CustomerFrame({ children, active = "boxes", compact = false }) {
  return <div className={`customer-frame${compact ? " customer-frame-compact" : ""}`}>
    <header className="customer-topbar">
      <Mark />
      {!compact && <nav className="customer-nav" aria-label="Your moving workspace">
        <Link href="/dashboard" aria-current={active === "boxes" ? "page" : undefined}>My boxes</Link>
        <Link href="/dashboard/print" aria-current={active === "print" ? "page" : undefined}>Master list</Link>
      </nav>}
      {!compact && <a className="customer-store-link" href="/">Shop supplies <span aria-hidden="true">↗</span></a>}
    </header>
    {children}
    {!compact && <footer className="customer-footnote"><span>Save On Boxes</span><span>Your move, all in one place.</span></footer>}
  </div>;
}

export function CustomerIcon({ name, size = 18 }) {
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="6.4" /><path d="m16 16 4.6 4.6" /></>,
    box: <><path d="m3 7 9-4 9 4v10l-9 4-9-4z" /><path d="m3 7 9 4 9-4M12 11v10" /></>,
    print: <><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /><path d="M17 11h.01" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    back: <><path d="M19 12H5M11 18l-6-6 6-6" /></>,
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    room: <><path d="M3 21V5l9-3 9 3v16M3 12h18M9 21v-5h6v5" /></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    edit: <><path d="m4 16.5-.8 4.3 4.3-.8L20 7.5 16.5 4z" /><path d="m14.8 5.7 3.5 3.5" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.box}</svg>;
}

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="customer-heading">
    <div><div className="customer-eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action && <div className="customer-heading-action">{action}</div>}
  </div>;
}

export function LoadingState({ label = "Loading your boxes…" }) {
  return <div className="customer-loading" role="status"><span className="customer-spinner" />{label}</div>;
}

export function EmptyState({ title, description, action }) {
  return <div className="customer-empty"><span className="customer-empty-icon"><CustomerIcon name="box" size={25} /></span><h2>{title}</h2><p>{description}</p>{action}</div>;
}
