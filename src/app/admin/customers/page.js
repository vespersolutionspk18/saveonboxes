"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Search, Users } from "lucide-react";
import { Badge } from "../../../components/ui/badge.jsx";
import { Button } from "../../../components/ui/button.jsx";
import { Card } from "../../../components/ui/card.jsx";
import { Input } from "../../../components/ui/input.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table.jsx";
import { adminRequest, fmtDate, fmtNumber } from "../admin-api.js";
import styles from "../admin.module.css";
import customerStyles from "./customers.module.css";

const statusVariant = (status) => status?.toLowerCase() === "disabled" ? "warning" : status?.toLowerCase() === "active" ? "success" : "muted";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (query.trim()) params.set("query", query.trim());
      if (status !== "all") params.set("status", status);
      const result = await adminRequest(`/api/admin/customers?${params}`);
      setCustomers(result.customers || []); setTotal(Number(result.total) || 0);
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, [page, pageSize, query, status, refresh]);
  useEffect(() => { load(); }, [load]);

  return <div className={`${styles.page} ${customerStyles.page}`}>
    <div className={styles.pageHeading}><div><h1>Customers</h1><p>Find an account, review its box usage, and open the support record.</p></div><div className={customerStyles.total}><Users size={14} />{fmtNumber(total)} accounts</div></div>
    {error && <div className={styles.errorBanner} role="alert"><CircleAlert size={16} /><span>{error}</span>{error.toLowerCase().includes("access") && <Link href="/login">Sign in</Link>}</div>}
    <Card className={customerStyles.directoryCard}>
      <div className={customerStyles.toolbar}><div className={customerStyles.toolbarTitle}><h2>Account list</h2><p>Private account details are visible to super administrators only.</p></div><form className={customerStyles.filters} onSubmit={(event) => { event.preventDefault(); setPage(1); setRefresh((value) => value + 1); }}><div className={customerStyles.search}><Search size={14} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Email or phone" aria-label="Search customers" /></div><Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger className={customerStyles.statusSelect} aria-label="Filter account status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All accounts</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent></Select><Button size="sm" variant="secondary" type="submit">Search</Button></form></div>
      <div className={customerStyles.tableWrap} role="region" aria-label="Customer directory results" tabIndex={0}><p className={customerStyles.scrollHint}>Scroll horizontally to see account counts and dates.</p><Table className={customerStyles.table}>
        <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>Account</TableHead><TableHead>Boxes</TableHead><TableHead>Labels</TableHead><TableHead>Scans</TableHead><TableHead>Joined</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>{loading ? Array.from({ length: 7 }, (_, index) => <TableRow key={index}><TableCell colSpan={8}><span className={customerStyles.loading}>Loading customer accounts…</span></TableCell></TableRow>) : customers.map((customer) => <TableRow key={customer.id}>
          <TableCell><Link className={customerStyles.email} href={`/admin/support?customer=${encodeURIComponent(customer.id)}`}>{customer.email}</Link><small className={customerStyles.id}>ID {String(customer.id).slice(0, 10)}</small></TableCell><TableCell>{customer.phone || <span className={customerStyles.muted}>—</span>}</TableCell><TableCell><Badge variant={statusVariant(customer.status)}>{customer.status || "Active"}</Badge></TableCell><TableCell>{fmtNumber(customer.counts?.boxes ?? customer.boxesCount)}</TableCell><TableCell>{fmtNumber(customer.counts?.labels ?? customer.labelsCount)}</TableCell><TableCell>{fmtNumber(customer.counts?.scanEvents ?? customer.scanEventsCount)}</TableCell><TableCell>{fmtDate(customer.createdAt)}</TableCell><TableCell><Link className={customerStyles.openLink} href={`/admin/support?customer=${encodeURIComponent(customer.id)}`}>Open</Link></TableCell>
        </TableRow>)}</TableBody>
      </Table>{!loading && !customers.length && <div className={customerStyles.empty}><Users size={20} /><strong>No customer accounts found</strong><span>Try another search or account status.</span></div>}</div>
      <div className={customerStyles.pagination}><span>Showing {total ? `${Math.min((page - 1) * pageSize + 1, total)}–${Math.min(page * pageSize, total)}` : "0"} of {fmtNumber(total)} accounts</span><div><Button size="sm" variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><span>Page {page}</span><Button size="sm" variant="ghost" disabled={page * pageSize >= total || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
    </Card>
    <div className={customerStyles.note}>Selecting an account opens its support record for history and audited access actions.</div>
  </div>;
}
