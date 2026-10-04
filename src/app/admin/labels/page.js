"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Boxes, Check, ChevronLeft, ChevronRight, CircleAlert, FileArchive, FileImage, FileText, LoaderCircle, PackagePlus, QrCode, Search, Sparkles, X } from "lucide-react";
import { Badge } from "../../../components/ui/badge.jsx";
import { Button } from "../../../components/ui/button.jsx";
import { Card, CardContent } from "../../../components/ui/card.jsx";
import { Input } from "../../../components/ui/input.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table.jsx";
import { adminRequest, batchStatus, downloadHref, fmtDate, fmtNumber } from "../admin-api.js";
import styles from "../admin.module.css";
import pageStyles from "./labels.module.css";

const LIMIT = 5000;

function BatchActions({ batch }) {
  const id = batch.id;
  const total = Math.max(1, Number(batch.quantity) || 1);
  const partCount = Math.ceil(total / 500);
  const [part, setPart] = useState(1);
  const offset = (part - 1) * 500;
  const end = Math.min(total, offset + 500);
  return <div className={pageStyles.exports}>
    {partCount > 1 && <label className={pageStyles.partPicker}><span>Part</span><select aria-label={`Export part for ${batch.name || `batch ${String(id).slice(0, 8)}`}`} value={part} onChange={(event) => setPart(Number(event.target.value))}>{Array.from({ length: partCount }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} of {partCount}</option>)}</select></label>}
    <span className={pageStyles.exportRange}>{partCount > 1 ? `Labels ${fmtNumber(offset + 1)}–${fmtNumber(end)} of ${fmtNumber(total)}` : `${fmtNumber(total)} labels`}</span>
    <a href={downloadHref(id, "pdf", offset)} className={pageStyles.exportLink} title={`Download gift-card PDF for labels ${offset + 1} through ${end}`}><FileText size={13} /> PDF</a>
    <a href={downloadHref(id, "svg", offset)} className={pageStyles.exportLink} title={`Download SVG ZIP for labels ${offset + 1} through ${end}`}><FileImage size={13} /> SVGs</a>
    <a href={downloadHref(id, "zip", offset)} className={`${pageStyles.exportLink} ${pageStyles.exportPrimary}`} title={`Download production ZIP for labels ${offset + 1} through ${end}`}><FileArchive size={13} /> Full ZIP</a>
  </div>;
}

function statusVariant(status) {
  const value = String(status || "").toLowerCase();
  if (value === "claimed" || value === "active" || value === "generated" || value === "ready") return "success";
  if (value === "disabled" || value === "attention") return "warning";
  return "muted";
}

function LabelProductionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedBatch = searchParams.get("batch") || "all";
  const [batches, setBatches] = useState([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchPage, setBatchPage] = useState(1);
  const [labels, setLabels] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [quantity, setQuantity] = useState("100");
  const [batchName, setBatchName] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: "50" });
      if (search.trim()) query.set("query", search.trim());
      if (status !== "all") query.set("status", status);
      if (selectedBatch !== "all") query.set("batchId", selectedBatch);
      const [batchResult, labelResult] = await Promise.all([
        adminRequest(`/api/admin/batches?page=${batchPage}&pageSize=6`),
        adminRequest(`/api/admin/labels?${query.toString()}`),
      ]);
      let batchRows = batchResult.batches || [];
      if (selectedBatch !== "all" && !batchRows.some((batch) => batch.id === selectedBatch)) {
        const selected = await adminRequest(`/api/admin/batches/${encodeURIComponent(selectedBatch)}`).catch(() => null);
        if (selected?.batch) batchRows = [selected.batch, ...batchRows].slice(0, 6);
      }
      setBatches(batchRows);
      setBatchTotal(Number(batchResult.total) || 0);
      setLabels(labelResult.labels || []);
      setTotal(Number(labelResult.total) || 0);
    } catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }, [page, batchPage, search, status, selectedBatch, refreshKey]);

  useEffect(() => { load(); }, [load]);

  const labelStats = useMemo(() => ({ claimed: labels.filter((item) => item.status?.toLowerCase() === "claimed").length, available: labels.filter((item) => item.status?.toLowerCase() === "available").length, disabled: labels.filter((item) => item.status?.toLowerCase() === "disabled").length }), [labels]);

  async function createBatch(event) {
    event.preventDefault();
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1 || amount > LIMIT) { setError(`Choose a whole number from 1 to ${LIMIT.toLocaleString()}.`); return; }
    setCreating(true); setError(""); setNotice(null);
    try {
      const result = await adminRequest("/api/admin/batches", { method: "POST", body: JSON.stringify({ quantity: amount, name: batchName.trim() || undefined, layout: { cardWidthMm: 85.6, cardHeightMm: 54, cardsPerPage: 1, includeSerial: true, includeWriteFields: true } }) });
      const created = result.batch;
      setBatchName(""); setPage(1); setBatchPage(1); setNotice({ count: Number(result.labelsCreated) || amount, batch: created });
      setRefreshKey((key) => key + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) { setError(reason.message); }
    finally { setCreating(false); }
  }

  return <div className={`${styles.page} ${pageStyles.page}`}>
    <div className={styles.pageHeading}>
      <div><div className={styles.kicker}><span className={styles.liveDot} /> LABEL OPERATIONS</div><h1>QR production</h1><p>Issue permanent labels, keep every serial accounted for, and prepare print files.</p></div>
      <div className={pageStyles.headingCount}><QrCode size={15} /><span>{fmtNumber(total)} labels in view</span></div>
    </div>

    {error && <div className={styles.errorBanner} role="alert"><CircleAlert size={16} /><span>{error}</span>{(error.toLowerCase().includes("access") || error.toLowerCase().includes("sign in")) && <Link href="/login">Sign in</Link>}</div>}
    {notice && <div className={pageStyles.successNotice} role="status"><span className={pageStyles.successIcon}><Check size={15} /></span><div><strong>{fmtNumber(notice.count)} unique labels created and saved</strong><small>{notice.batch?.name || `Batch ${String(notice.batch?.id || "").slice(0, 8)}`} is ready. Exports contain the saved label identifiers.</small></div><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div>}

    <div className={pageStyles.productionGrid}>
      <Card className={pageStyles.generatorCard}>
        <div className={pageStyles.generatorHeading}><span className={pageStyles.generatorGlyph}><Sparkles size={16} /></span><div><h2>Issue a label batch</h2><p>New unique URLs are saved as labels before any artwork is downloaded.</p></div></div>
        <form className={pageStyles.generatorForm} onSubmit={createBatch}>
          <label className={pageStyles.quantityField}><span>How many labels?</span><div className={pageStyles.quantityInput}><Input type="number" min="1" max={LIMIT} step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-label="Number of labels to generate" /><span>labels</span></div><small>1–{LIMIT.toLocaleString()} per batch. Generate another batch at any time.</small></label>
          <label className={pageStyles.batchNameField}><span>Batch name <em>optional</em></span><Input maxLength={80} placeholder="e.g. October retail run" value={batchName} onChange={(event) => setBatchName(event.target.value)} /></label>
          <div className={pageStyles.layoutPreview}>
            <div className={pageStyles.previewCard} aria-hidden="true"><div className={pageStyles.previewLogo}>SAVE ON BOXES</div><div className={pageStyles.previewScratch}><div className={pageStyles.previewQr}>QR</div><span>SCRATCH TO REVEAL</span></div><div className={pageStyles.previewMeta}><span>BX-008241</span><span>BOX NO. ____</span></div></div>
            <div className={pageStyles.layoutText}><strong>Gift-card format</strong><span>85.6 × 54 mm · one label per PDF page</span><span>Serial and write-in box number included</span><span>Scratch-off QR area needs printer proofing</span><small>Preview artwork is decorative and cannot be scanned.</small></div>
          </div>
          <Button type="submit" className={pageStyles.generateButton} disabled={creating}>
            {creating ? <><LoaderCircle className="animate-spin" size={15} /> Saving labels…</> : <><PackagePlus size={15} /> Generate &amp; save labels</>}
          </Button>
          <div className={pageStyles.guardrail}><CircleAlert size={13} /><span>Issuing a batch creates permanent, claimable labels. The print preview itself never claims or activates them.</span></div>
        </form>
      </Card>

      <Card className={pageStyles.productionAside}>
        <div className={pageStyles.asideHeading}><span className={pageStyles.asideIcon}><Boxes size={16} /></span><div><h2>Print and pack</h2><p>Each batch contains its own permanent labels.</p></div></div>
        <div className={pageStyles.steps}>
          <div className={pageStyles.step}><span>01</span><div><strong>Generate once</strong><small>Unique codes are committed to the label registry.</small></div></div>
          <div className={pageStyles.step}><span>02</span><div><strong>Download the bundle</strong><small>Print the PDF or use individual SVG artwork.</small></div></div>
          <div className={pageStyles.step}><span>03</span><div><strong>Cover before sale</strong><small>Apply opaque scratch material over the QR.</small></div></div>
        </div>
        <div className={pageStyles.exportNote}><FileArchive size={15} /><div><strong>Full ZIP package</strong><small>PDF, organized SVG files and a serial manifest, in parts of up to 500 labels.</small></div></div>
      </Card>
    </div>

    <Card className={pageStyles.batchPanel}>
      <div className={pageStyles.sectionTop}><div><h2>Issued batches</h2><p>Re-download artwork from the saved identifiers at any time.</p></div><Badge variant="muted">{fmtNumber(batchTotal)} total</Badge></div>
      <div className={pageStyles.batchGrid}>
        {loading && batches.length === 0 ? [0, 1].map((item) => <div className={pageStyles.batchCard} key={item}><div className={pageStyles.batchCardTop}><div><div className={pageStyles.skeletonText} /><div className={pageStyles.skeletonSub} /></div><div className={pageStyles.skeletonStatus} /></div><div className={pageStyles.batchProgress}><span /><small>Loading batch data</small></div></div>) : batches.map((batch) => {
          const claimPercent = batch.quantity ? Math.round((batch.claimedCount || 0) * 100 / batch.quantity) : 0;
          const available = batch.availableCount ?? Math.max(0, Number(batch.quantity || 0) - Number(batch.claimedCount || 0) - Number(batch.disabledCount || 0));
          return <article className={pageStyles.batchCard} key={batch.id}>
            <div className={pageStyles.batchCardTop}><div><Link href={`/admin/labels?batch=${encodeURIComponent(batch.id)}`} className={pageStyles.batchTitle}>{batch.name || `Batch ${String(batch.id).slice(0, 8)}`}</Link><small>Created {fmtDate(batch.createdAt)}</small></div><Badge variant={statusVariant(batchStatus(batch))}>{batchStatus(batch)}</Badge></div>
            <div className={pageStyles.batchNumbers}><span><strong>{fmtNumber(batch.quantity)}</strong><small>issued</small></span><span><strong>{fmtNumber(batch.claimedCount)}</strong><small>claimed</small></span><span><strong>{fmtNumber(available)}</strong><small>available</small></span><span><strong>{fmtNumber(batch.scanCount)}</strong><small>scans</small></span><span><strong>{fmtNumber(batch.disabledCount)}</strong><small>disabled</small></span></div>
            <div className={pageStyles.batchProgress}><div className={pageStyles.progressTrack}><span style={{ width: `${Math.min(100, claimPercent)}%` }} /></div><small>{claimPercent}% claimed</small></div>
            <BatchActions batch={batch} />
          </article>;
        })}
        {!loading && !batches.length && <div className={pageStyles.emptyBatch}><QrCode size={20} /><strong>Your first batch starts here</strong><span>Choose a quantity and generate production labels.</span></div>}
      </div>
      {batchTotal > 6 && <div className={pageStyles.batchPagination}><span>Page {batchPage} of {Math.ceil(batchTotal / 6)}</span><div><Button variant="ghost" size="sm" disabled={batchPage <= 1 || loading} onClick={() => setBatchPage((value) => Math.max(1, value - 1))}><ChevronLeft size={14} /> Previous</Button><Button variant="ghost" size="sm" disabled={batchPage * 6 >= batchTotal || loading} onClick={() => setBatchPage((value) => value + 1)}>Next <ChevronRight size={14} /></Button></div></div>}
    </Card>

    <Card className={pageStyles.labelPanel}>
      <div className={pageStyles.sectionTop}><div><h2>Label registry</h2><p>Search permanent serials, owner accounts and scan activity.</p></div><div className={pageStyles.registryTotals}><span><i className={pageStyles.availableDot} /> Available {fmtNumber(labelStats.available)}</span><span><i className={pageStyles.claimedDot} /> Claimed {fmtNumber(labelStats.claimed)}</span><span><i className={pageStyles.disabledDot} /> Disabled {fmtNumber(labelStats.disabled)}</span></div></div>
      <form className={pageStyles.filters} onSubmit={(event) => { event.preventDefault(); setPage(1); load(); }}>
        <div className={pageStyles.searchField}><Search size={15} /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search serial, customer email…" aria-label="Search labels" /><button type="button" className={pageStyles.searchSubmit} onClick={() => { setPage(1); load(); }}>Search</button></div>
        <Select value={selectedBatch} onValueChange={(value) => { router.push(value === "all" ? "/admin/labels" : `/admin/labels?batch=${encodeURIComponent(value)}`); }}>
          <SelectTrigger className={pageStyles.selectTrigger} aria-label="Batch filter"><SelectValue placeholder="All batches" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All batches</SelectItem>{batches.map((batch) => <SelectItem key={batch.id} value={batch.id}>{batch.name || `Batch ${String(batch.id).slice(0, 8)}`}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger className={pageStyles.selectTrigger} aria-label="Status filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="available">Available</SelectItem><SelectItem value="claimed">Claimed</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent></Select>
      </form>
      <div className={pageStyles.registryTable}>
        <Table className={pageStyles.labelTable}>
          <TableHeader><TableRow><TableHead>Label serial</TableHead><TableHead>Batch</TableHead><TableHead>State</TableHead><TableHead>Account</TableHead><TableHead className={pageStyles.numberCell}>Scans</TableHead><TableHead>First scan</TableHead><TableHead>Last scan</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{loading ? Array.from({ length: 5 }, (_, i) => <TableRow key={i}><TableCell colSpan={8}><div className={pageStyles.loadingRow}>Loading label records…</div></TableCell></TableRow>) : labels.map((label) => <TableRow key={label.id}>
            <TableCell><Link className={pageStyles.serial} href={`/admin/support?label=${encodeURIComponent(label.id)}`}>{label.serial}</Link><small className={pageStyles.boxSub}>{label.box?.boxNumber ? `Box ${label.box.boxNumber}` : "Unassigned"}</small></TableCell>
            <TableCell>{label.batchName || String(label.batchId || "—").slice(0, 8)}</TableCell><TableCell><Badge variant={statusVariant(label.status)}>{label.status}</Badge></TableCell><TableCell>{label.owner?.email || <span className={pageStyles.dim}>—</span>}</TableCell><TableCell className={pageStyles.numberCell}>{fmtNumber(label.scans)}</TableCell><TableCell>{fmtDate(label.firstScannedAt)}</TableCell><TableCell>{fmtDate(label.lastScannedAt)}</TableCell><TableCell><Link className={pageStyles.rowAction} href={`/admin/support?label=${encodeURIComponent(label.id)}`} aria-label={`Open support record for ${label.serial}`}><ArrowRight size={14} /></Link></TableCell>
          </TableRow>)}</TableBody>
        </Table>
        {!loading && labels.length === 0 && <div className={pageStyles.emptyLabels}><Search size={18} /><strong>No matching labels</strong><span>Adjust the filters or issue a new batch.</span></div>}
      </div>
      <div className={pageStyles.pagination}><span>Showing {total ? `${Math.min((page - 1) * 50 + 1, total)}–${Math.min(page * 50, total)}` : "0"} of {fmtNumber(total)} labels</span><div><Button size="sm" variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={14} /> Previous</Button><span>Page {page}</span><Button size="sm" variant="ghost" disabled={page * 50 >= total || loading} onClick={() => setPage((value) => value + 1)}>Next <ChevronRight size={14} /></Button></div></div>
    </Card>
  </div>;
}

export default function LabelProductionPage() {
  return <Suspense fallback={<div className="admin-shell p-8 text-sm text-muted-foreground">Loading production console…</div>}><LabelProductionContent /></Suspense>;
}
