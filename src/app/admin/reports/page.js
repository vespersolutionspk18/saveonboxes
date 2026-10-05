"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, CircleAlert, Download, ScanLine, Search, ShieldCheck } from "lucide-react";
import { Badge } from "../../../components/ui/badge.jsx";
import { Button } from "../../../components/ui/button.jsx";
import { Card } from "../../../components/ui/card.jsx";
import { Input } from "../../../components/ui/input.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table.jsx";
import { adminRequest, fmtDate, fmtNumber } from "../admin-api.js";
import styles from "../admin.module.css";
import reportStyles from "./reports.module.css";

const variant = (status) => status?.toLowerCase() === "claimed" ? "success" : status?.toLowerCase() === "disabled" ? "warning" : "muted";

export default function ReportsPage() {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [batches, setBatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const [batchId, setBatchId] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "50" });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (status !== "all") params.set("status", status);
      if (batchId !== "all") params.set("batchId", batchId);
      if (search.trim()) params.set("query", search.trim());
      const [report, batchResult] = await Promise.all([
        adminRequest(`/api/admin/reports/labels?${params}`),
        adminRequest("/api/admin/batches?page=1&pageSize=100"),
      ]);
      setSummary(report.summary || null); setRows(report.labels || []); setTotal(Number(report.total) || 0); setBatches(batchResult.batches || []);
    } catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }, [page, from, to, status, batchId, search, refresh]);

  useEffect(() => { load(); }, [load]);

  const maxScans = Math.max(1, ...rows.map((row) => Number(row.scans) || 0));
  const filteredRows = useMemo(() => rows, [rows]);
  const csvParams = new URLSearchParams({ format: "csv" });
  if (from) csvParams.set("from", from);
  if (to) csvParams.set("to", to);
  if (status !== "all") csvParams.set("status", status);
  if (batchId !== "all") csvParams.set("batchId", batchId);
  if (search.trim()) csvParams.set("query", search.trim());

  return <div className={`${styles.page} ${reportStyles.page}`}>
    <div className={styles.pageHeading}>
      <div><h1>Scan reports</h1><p>Claim rates, QR scans and label health across production.</p></div>
      <Button asChild variant="secondary" className={reportStyles.exportButton}><Link href={`/api/admin/reports/labels?${csvParams.toString()}`}><Download size={14} /> Download report</Link></Button>
    </div>
    {error && <div className={styles.errorBanner} role="alert"><CircleAlert size={16} /><span>{error}</span>{(error.toLowerCase().includes("access") || error.toLowerCase().includes("sign in")) && <Link href="/login">Sign in</Link>}</div>}

    <div className={reportStyles.summaryGrid}>
      {[
        ["Labels in scope", summary?.total, "All issued labels matching filters", "#7c8d84"],
        ["Available", summary?.available, "Ready for a first scan", "#849389"],
        ["Claimed", summary?.claimed, "Connected to a customer", "#5d9474"],
        ["Scanned", summary?.scanned, "At least one recorded event", "#5f8790"],
        ["Disabled", summary?.disabled, "Blocked from claiming", "#b88748"],
      ].map(([title, value, note, color]) => <Card key={title} className={reportStyles.summaryCard}>
        <span className={reportStyles.summaryTop}><i style={{ background: color }} />{title}</span><strong>{loading && value == null ? "···" : fmtNumber(value)}</strong><small>{note}</small>
      </Card>)}
    </div>

    <Card className={reportStyles.filtersPanel}>
      <div className={reportStyles.filterHeading}><div><h2>Label activity</h2><p>Filter by scan date, batch, status, serial or customer email.</p></div><Badge variant="muted">{fmtNumber(total)} records</Badge></div>
      <div className={reportStyles.filterControls}>
        <label><span><CalendarDays size={12} /> Scan from</span><Input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
        <label><span><CalendarDays size={12} /> Scan through</span><Input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>
        <label className={reportStyles.filterSelect}><span>Batch</span><Select value={batchId} onValueChange={(value) => { setBatchId(value); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All batches</SelectItem>{batches.map((batch) => <SelectItem key={batch.id} value={batch.id}>{batch.name || `Batch ${String(batch.id).slice(0, 8)}`}</SelectItem>)}</SelectContent></Select></label>
        <label className={reportStyles.filterSelect}><span>Status</span><Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="available">Available</SelectItem><SelectItem value="claimed">Claimed</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent></Select></label>
        <label className={reportStyles.filterSearch}><span>Quick find</span><div><Search size={13} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Serial or customer email" /></div></label>
        <Button variant="secondary" size="sm" className={reportStyles.applyButton} onClick={() => { setPage(1); setRefresh((value) => value + 1); }}>Apply</Button>
      </div>
    </Card>

    <Card className={reportStyles.tablePanel}>
      <div className={reportStyles.tableHeading}><div><h2>Label scan detail</h2><p>Date filters apply to deduplicated customer opens and in-app camera detections; admin previews are excluded. Scan counts and first/last scan dates reflect the selected window.</p></div><div className={reportStyles.eventsCount}><ScanLine size={14} /> {fmtNumber(summary?.scanned)} scanned labels</div></div>
      <div className={reportStyles.tableWrap} role="region" aria-label="Label scan detail" tabIndex={0}>
        <p className={reportStyles.scrollHint}>Scroll horizontally to view all scan fields.</p>
        <Table className={reportStyles.table}>
          <TableHeader><TableRow><TableHead>Serial</TableHead><TableHead>State</TableHead><TableHead>Customer</TableHead><TableHead>Batch</TableHead><TableHead>Scans</TableHead><TableHead>First seen</TableHead><TableHead>Last seen</TableHead><TableHead>Claimed</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>{loading ? Array.from({ length: 6 }, (_, i) => <TableRow key={i}><TableCell colSpan={9}><span className={reportStyles.loadingRow}>Loading activity…</span></TableCell></TableRow>) : filteredRows.map((row) => <TableRow key={row.id}>
            <TableCell className={reportStyles.serial}>{row.serial}</TableCell><TableCell><Badge variant={variant(row.status)}>{row.status}</Badge></TableCell><TableCell>{row.owner?.email || <span className={reportStyles.muted}>Unclaimed</span>}</TableCell><TableCell>{row.batchName || String(row.batchId || "—").slice(0, 8)}</TableCell>
            <TableCell><span className={reportStyles.scanCount}>{fmtNumber(row.scans)}</span><span className={reportStyles.scanTrack}><i style={{ width: `${Math.max(row.scans ? 8 : 0, (Number(row.scans) || 0) * 100 / maxScans)}%` }} /></span></TableCell><TableCell>{fmtDate(row.firstScannedAt)}</TableCell><TableCell>{fmtDate(row.lastScannedAt)}</TableCell><TableCell>{fmtDate(row.claimedAt)}</TableCell><TableCell><Link href={`/admin/support?label=${encodeURIComponent(row.id)}`} className={reportStyles.detailLink}>Details</Link></TableCell>
          </TableRow>)}</TableBody>
        </Table>
        {!loading && filteredRows.length === 0 && <div className={reportStyles.empty}><Activity size={20} /><strong>No matching scan records</strong><span>Try another date range or remove a filter.</span></div>}
      </div>
      <div className={reportStyles.pagination}><span>Showing {total ? `${Math.min((page - 1) * 50 + 1, total)}–${Math.min(page * 50, total)}` : "0"} of {fmtNumber(total)} labels</span><div><Button size="sm" variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><span>Page {page}</span><Button size="sm" variant="ghost" disabled={page * 50 >= total || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
    </Card>

    <div className={reportStyles.reportFoot}><ShieldCheck size={14} /><span>Reports show serials and account data only. Claim URLs and QR bearer tokens stay in production files.</span></div>
  </div>;
}
