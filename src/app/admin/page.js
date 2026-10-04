"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Box, Boxes, CircleAlert, CircleCheck, Clock3, Download, PackageCheck, PackagePlus, QrCode, ScanLine, ShieldCheck, Users } from "lucide-react";
import { Badge } from "../../components/ui/badge.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Skeleton } from "../../components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table.jsx";
import { adminRequest, batchStatus, fmtDate, fmtDateTime, fmtNumber } from "./admin-api.js";
import styles from "./admin.module.css";

const stats = [
  { key: "labelsTotal", title: "Labels issued", icon: QrCode, color: "green", foot: "Lifetime production" },
  { key: "labelsAvailable", title: "Ready to claim", icon: PackageCheck, color: "blue", foot: "Unclaimed labels" },
  { key: "labelsClaimed", title: "Claimed", icon: Boxes, color: "violet", foot: "In customer accounts" },
  { key: "scanEventsTotal", title: "QR scans", icon: ScanLine, color: "orange", foot: "Recorded activity" },
  { key: "accountsTotal", title: "Customers", icon: Users, color: "slate", foot: "Registered accounts" },
  { key: "boxesTotal", title: "Customer boxes", icon: Box, color: "amber", foot: "Active and archived" },
  { key: "scansToday", title: "Scans today", icon: Activity, color: "cyan", foot: "Since midnight" },
  { key: "claimsToday", title: "Claims today", icon: CircleCheck, color: "pink", foot: "New box activations" },
];

const eventText = (event) => event.description || event.summary || ({
  claim_created: "QR scan claimed a label",
  existing_box: "Owner reopened a box",
  owner_conflict: "Scan matched a label owned by another account",
  label_unavailable: "Disabled label opened",
  url_open: "QR link opened",
  camera_scan: "In-app camera scan",
}[event.outcome] || { url_open: "QR link opened", camera_scan: "In-app camera scan" }[event.eventKind] || "Activity recorded");
const isHealthy = (health) => Boolean(health && [health.database, health.issuance, health.qrExport, health.passwordRecovery].every((value) => value === true || value === "ready" || value === "ok") && [true, "ready", "ok", "configured"].includes(health.qrSecret) && [true, "ready", "ok", "configured"].includes(health.appOrigin));
const readyState = (value, configured = false) => value === true || value === "ready" || value === "ok" || (configured && value === "configured");
const healthState = (value) => value === true || value === "ready" || value === "ok" ? "Ready" : value === "unavailable" || value === "missing" ? "Unavailable" : value === "configured" ? "Configured" : "Unknown";
const healthSummary = (health, loading, error) => {
  if (loading) return "Checking live services";
  if (!health) return error ? "Health status unavailable" : "No health data returned";
  const checks = [["DB", health.database], ["QR export", health.qrExport], ["QR key", health.qrSecret], ["QR domain", health.appOrigin], ["Issue", health.issuance], ["Email", health.passwordRecovery]];
  const failed = checks.filter(([name, value]) => !(value === true || value === "ready" || value === "ok" || (["QR key", "QR domain"].includes(name) && value === "configured"))).map(([name]) => name);
  return failed.length ? `${failed.join(", ")} needs attention${health.lastError ? ` · ${health.lastError}` : ""}` : `Database, label issue, QR exports, key, domain and email ready · checked ${fmtDateTime(health.checkedAt)}`;
};

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([adminRequest("/api/admin/reports/overview"), adminRequest("/api/admin/batches?page=1&pageSize=5")])
      .then(([summary, production]) => { if (alive) { setOverview(summary); setBatches(production.batches || []); } })
      .catch((reason) => { if (alive) setError(reason.message); })
      .finally(() => { if (alive) setLoading(false); });
    adminRequest("/api/admin/health").then((result) => { if (alive) setHealth(result.health || null); }).catch(() => { if (alive) setHealth(null); });
    return () => { alive = false; };
  }, []);

  const metrics = overview?.metrics || {};
  const alertCount = Number(metrics.labelsDisabled || 0);

  return <div className={styles.page}>
    <div className={styles.pageHeading}>
      <div><div className={styles.kicker}><span className={styles.liveDot} /> SYSTEM OVERVIEW</div><h1>Operations overview</h1><p>Production, people and label activity at a glance.</p></div>
      <div className={styles.headingActions}><span className={styles.updated}><Clock3 size={13} /> Live data</span><Button asChild><Link href="/admin/labels"><PackagePlus size={15} /> Generate labels</Link></Button></div>
    </div>

    {error && <div className={styles.errorBanner} role="alert"><CircleAlert size={16} /><span>{error}</span>{(error.toLowerCase().includes("access") || error.toLowerCase().includes("sign in")) && <Link href="/login">Sign in</Link>}</div>}

    <div className={styles.metricGrid}>
      {stats.map(({ key, title, icon: Icon, color, foot }) => <Card key={key} className={`${styles.metricCard} ${styles[`metric-${color}`]}`}>
        <CardContent className={styles.metricContent}>
          <div className={styles.metricTop}><span>{title}</span><span className={styles.metricIcon}><Icon size={16} /></span></div>
          <div className={styles.metricValue}>{loading ? <Skeleton className="h-8 w-20" /> : fmtNumber(metrics[key])}</div>
          <div className={styles.metricFoot}>{foot}</div>
        </CardContent>
      </Card>)}
    </div>

    <div className={styles.midGrid}>
      <Card className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>Recent production</h2><p>Latest issued QR batches</p></div><Link className={styles.viewAll} href="/admin/labels">View all <ArrowRight size={14} /></Link></div>
        <div className={styles.tableWrap}>
          <Table className={styles.table}>
            <TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Created</TableHead><TableHead className={styles.alignRight}>Labels</TableHead><TableHead className={styles.alignRight}>Claimed</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{loading ? [0, 1, 2].map((n) => <TableRow key={n}><TableCell><Skeleton className="h-4 w-28" /></TableCell><TableCell><Skeleton className="h-4 w-16" /></TableCell><TableCell><Skeleton className="ml-auto h-4 w-8" /></TableCell><TableCell><Skeleton className="ml-auto h-4 w-8" /></TableCell><TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell></TableRow>) : batches.slice(0, 5).map((batch) => <TableRow key={batch.id}>
              <TableCell><Link className={styles.batchLink} href={`/admin/labels?batch=${encodeURIComponent(batch.id)}`}>{batch.name || `Batch ${String(batch.id).slice(0, 8)}`}</Link></TableCell><TableCell>{fmtDate(batch.createdAt)}</TableCell><TableCell className={styles.alignRight}>{fmtNumber(batch.quantity)}</TableCell><TableCell className={styles.alignRight}>{fmtNumber(batch.claimedCount)}</TableCell><TableCell><Badge variant={["Active", "Generated", "Ready"].includes(batchStatus(batch)) ? "success" : "warning"}>{batchStatus(batch)}</Badge></TableCell>
            </TableRow>)}</TableBody>
          </Table>
          {!loading && batches.length === 0 && <div className={styles.emptyInline}><QrCode size={19} /><span>No QR batches yet</span><Link href="/admin/labels">Create the first batch</Link></div>}
        </div>
      </Card>

      <Card className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>Activity stream</h2><p>Latest system events</p></div><Link className={styles.iconAction} href="/admin/audit" aria-label="Open audit log"><ArrowRight size={16} /></Link></div>
        <div className={styles.activityList}>
          {loading ? [0, 1, 2, 3].map((n) => <div className={styles.activityItem} key={n}><Skeleton className="size-8 rounded-full" /><div><Skeleton className="mb-2 h-3 w-36" /><Skeleton className="h-3 w-20" /></div></div>) : (overview?.recentActivity || []).slice(0, 5).map((event, index) => <div className={styles.activityItem} key={event.id || `${event.type}-${index}`}>
            <span className={`${styles.activityIcon} ${event.outcome === "owner_conflict" ? styles.activityWarning : ""}`}>{event.outcome === "owner_conflict" ? <ShieldCheck size={15} /> : event.outcome === "claim_created" ? <PackageCheck size={15} /> : <ScanLine size={15} />}</span>
            <div className={styles.activityBody}><strong>{eventText(event)}</strong><small>{event.email || event.labelSerial || event.serial || event.boxNumber || "System"}</small></div><time>{fmtDateTime(event.createdAt || event.at)}</time>
          </div>)}
          {!loading && !overview?.recentActivity?.length && <div className={styles.emptyActivity}><Activity size={20} /><span>Nothing to report yet</span></div>}
        </div>
      </Card>
    </div>

    <div className={styles.bottomGrid}>
      <Card className={styles.healthCard}><span className={styles.healthMark}><ShieldCheck size={17} /></span><div><strong>Production readiness</strong><small>{healthSummary(health, loading, error)}</small></div><Badge variant={isHealthy(health) ? "success" : "warning"}>{loading ? "Checking" : isHealthy(health) ? "Ready" : health ? "Needs attention" : "Unknown"}</Badge></Card>
      <Card className={`${styles.healthCard} ${alertCount ? styles.healthWarning : ""}`}><span className={styles.healthMark}>{alertCount ? <CircleAlert size={17} /> : <CircleCheck size={17} />}</span><div><strong>Label integrity</strong><small>{loading ? "Checking records" : error ? "Report unavailable" : alertCount ? `${fmtNumber(alertCount)} disabled labels` : "No disabled labels"}</small></div><Link href="/admin/reports" className={styles.healthLink}>{alertCount ? "Review" : "View report"}<ArrowUpRight size={13} /></Link></Card>
      <Card className={styles.healthDetail}><div className={styles.healthDetailTop}><div><strong>Live service checks</strong><small>Latest status from the admin health endpoint</small></div><span>{health?.checkedAt ? `Checked ${fmtDateTime(health.checkedAt)}` : "Awaiting check"}</span></div><div className={styles.checkGrid}>{[["Database", health?.database], ["Label issuance", health?.issuance], ["QR export", health?.qrExport], ["QR signing key", health?.qrSecret], ["Public QR domain", health?.appOrigin], ["Password recovery email", health?.passwordRecovery]].map(([name, value]) => <div key={name} className={styles.checkItem}><span className={`${styles.checkDot} ${readyState(value, name === "QR signing key" || name === "Public QR domain") ? styles.checkReady : value ? styles.checkFailed : ""}`} /><span>{name}</span><strong>{healthState(value)}</strong></div>)}</div>{health?.lastError && <div className={styles.lastError}><CircleAlert size={13} /><span>{health.lastError}</span></div>}</Card>
      <Card className={styles.quickCard}><div><span className={styles.quickIcon}><Download size={16} /></span><strong>Need a production file?</strong><small>Download SVG, PDF, or a full ZIP package.</small></div><Button asChild variant="secondary" size="sm"><Link href="/admin/labels">Open production <ArrowDownRight size={14} /></Link></Button></Card>
    </div>
  </div>;
}
