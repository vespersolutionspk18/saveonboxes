"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, Clock3, FileClock, Search, ShieldCheck } from "lucide-react";
import { Badge } from "../../../components/ui/badge.jsx";
import { Button } from "../../../components/ui/button.jsx";
import { Card } from "../../../components/ui/card.jsx";
import { Input } from "../../../components/ui/input.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table.jsx";
import { adminRequest, fmtDateTime, fmtNumber } from "../admin-api.js";
import styles from "../admin.module.css";
import auditStyles from "./audit.module.css";

const actionName = (event) => event.action || event.eventKind || event.type || "Admin action";
const category = (value) => /label|assign|claim|disable|enable/i.test(value) ? "Label" : /customer|account|user/i.test(value) ? "Customer" : "System";

export default function AuditPage() {
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await adminRequest(`/api/admin/audit?page=${page}&pageSize=50`);
      setEvents(result.events || []); setTotal(Number(result.total) || 0);
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const visibleEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      const name = actionName(event);
      const textMatch = !term || `${name} ${event.reason || ""} ${event.actor?.email || event.actorEmail || ""} ${event.labelSerial || event.serial || ""}`.toLowerCase().includes(term);
      return textMatch && (kind === "all" || category(name).toLowerCase() === kind);
    });
  }, [events, search, kind]);

  return <div className={`${styles.page} ${auditStyles.page}`}>
    <div className={styles.pageHeading}><div><h1>Audit log</h1><p>Permanent history of privileged changes and support corrections.</p></div><Badge variant="muted"><ShieldCheck size={12} /> Immutable records</Badge></div>
    {error && <div className={styles.errorBanner} role="alert"><CircleAlert size={16} /><span>{error}</span>{error.toLowerCase().includes("access") && <Link href="/login">Sign in</Link>}</div>}
    <Card className={auditStyles.auditCard}>
      <div className={auditStyles.auditHead}><div className={auditStyles.auditTitle}><span><FileClock size={16} /></span><div><h2>Administrative events</h2><p>Operator, action, reason and affected record are captured for each change.</p></div></div><div className={auditStyles.totalPill}>{fmtNumber(total)} events</div></div>
      <div className={auditStyles.filters}><div className={auditStyles.search}><Search size={14} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search operator, reason, serial…" aria-label="Search audit records" /></div><Select value={kind} onValueChange={(value) => setKind(value)}><SelectTrigger className={auditStyles.kindSelect} aria-label="Filter event type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All activity</SelectItem><SelectItem value="label">Label actions</SelectItem><SelectItem value="customer">Customer actions</SelectItem><SelectItem value="system">System actions</SelectItem></SelectContent></Select></div>
      <div className={auditStyles.tableWrap} role="region" aria-label="Audit events" tabIndex={0}><p className={auditStyles.scrollHint}>Scroll horizontally to see each event’s reason and record.</p><Table className={auditStyles.table}>
        <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Category</TableHead><TableHead>Operator</TableHead><TableHead>Reason</TableHead><TableHead>Label / record</TableHead><TableHead><Clock3 size={12} /> Time</TableHead></TableRow></TableHeader>
        <TableBody>{loading ? Array.from({ length: 7 }, (_, index) => <TableRow key={index}><TableCell colSpan={6}><span className={auditStyles.loading}>Loading audit events…</span></TableCell></TableRow>) : visibleEvents.map((event) => {
          const name = actionName(event);
          const actionLabel = name.replaceAll("_", " ");
          const sentenceAction = `${actionLabel.slice(0, 1).toUpperCase()}${actionLabel.slice(1)}`;
          const labelId = event.labelId || (/label/i.test(event.targetType || "") ? event.targetId : null);
          const recordName = event.labelSerial || event.serial || event.boxNumber || event.targetType || (event.targetId ? String(event.targetId).slice(0, 12) : "—");
          return <TableRow key={event.id}>
            <TableCell><strong className={auditStyles.actionName}>{sentenceAction}</strong><small className={auditStyles.eventId}>{event.id ? `Event ${String(event.id).slice(0, 8)}` : ""}</small></TableCell>
            <TableCell><Badge variant={category(name) === "Label" ? "success" : category(name) === "Customer" ? "muted" : "warning"}>{category(name)}</Badge></TableCell>
            <TableCell>{event.actor?.email || event.actorEmail || event.adminEmail || "System"}</TableCell>
            <TableCell className={auditStyles.reason}>{event.reason || <span>Administrative action</span>}</TableCell>
            <TableCell>{labelId ? <Link className={auditStyles.recordLink} href={`/admin/support?label=${encodeURIComponent(labelId)}`}>{recordName}</Link> : recordName}</TableCell>
            <TableCell className={auditStyles.timeCell}>{fmtDateTime(event.createdAt || event.at)}</TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
      {!loading && !visibleEvents.length && <div className={auditStyles.empty}><FileClock size={20} /><strong>No audit entries match</strong><span>Try a different search or event category.</span></div>}</div>
      <div className={auditStyles.pagination}><span>Page {page} · {fmtNumber(total)} total events</span><div><Button size="sm" variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><Button size="sm" variant="ghost" disabled={page * 50 >= total || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
    </Card>
    <div className={auditStyles.retention}><ShieldCheck size={13} /><span>Audit history is kept with the label record, including after disabling, enabling or owner correction.</span></div>
  </div>;
}
