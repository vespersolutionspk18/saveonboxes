"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, AlertTriangle, Boxes, CheckCircle2, CircleAlert, CircleUserRound, Clock3, LoaderCircle, Mail, Phone, Search, ShieldCheck, UserRoundCog, X } from "lucide-react";
import { Badge } from "../../../components/ui/badge.jsx";
import { Button } from "../../../components/ui/button.jsx";
import { Card } from "../../../components/ui/card.jsx";
import { Input } from "../../../components/ui/input.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select.jsx";
import { Textarea } from "../../../components/ui/textarea.jsx";
import { adminRequest, fmtDate, fmtDateTime, fmtNumber } from "../admin-api.js";
import styles from "../admin.module.css";
import supportStyles from "./support.module.css";

const statusVariant = (value) => value?.toLowerCase() === "claimed" || value?.toLowerCase() === "active" ? "success" : value?.toLowerCase() === "disabled" || value?.toLowerCase() === "suspended" ? "warning" : "muted";

function SupportContent() {
  const searchParams = useSearchParams();
  const initialLabel = searchParams.get("label") || "";
  const initialCustomer = searchParams.get("customer") || "";
  const [labelQuery, setLabelQuery] = useState("");
  const [labelResults, setLabelResults] = useState([]);
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [events, setEvents] = useState([]);
  const [audit, setAudit] = useState([]);
  const [action, setAction] = useState("assign");
  const [targetUser, setTargetUser] = useState("");
  const [reason, setReason] = useState("");
  const [loadingLabel, setLoadingLabel] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountReason, setAccountReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const openLabel = useCallback(async (labelId, { preserveNotice = false } = {}) => {
    if (!labelId) return;
    setLoadingLabel(true); setError(""); if (!preserveNotice) setNotice("");
    try {
      const data = await adminRequest(`/api/admin/labels/${encodeURIComponent(labelId)}`);
      setSelectedLabel(data.label || null); setEvents(data.events || []); setAudit(data.audit || []);
    } catch (cause) { setError(cause.message); setSelectedLabel(null); }
    finally { setLoadingLabel(false); }
  }, []);

  const openCustomer = useCallback(async (userId) => {
    if (!userId) return;
    setLoadingCustomer(true); setError("");
    try {
      const data = await adminRequest(`/api/admin/customers/${encodeURIComponent(userId)}`);
      setSelectedCustomer(data.customer || null);
      if (data.customer?.id) setTargetUser(data.customer.id);
    } catch (cause) { setError(cause.message); setSelectedCustomer(null); }
    finally { setLoadingCustomer(false); }
  }, []);

  useEffect(() => { if (initialLabel) openLabel(initialLabel); }, [initialLabel, openLabel]);
  useEffect(() => { if (initialCustomer) openCustomer(initialCustomer); }, [initialCustomer, openCustomer]);

  async function findRecords(event) {
    event.preventDefault(); setSearching(true); setError("");
    const query = labelQuery.trim();
    if (!query) { setSearching(false); setLabelResults([]); setCustomerResults([]); return; }
    try {
      const [labelData, customerData] = await Promise.all([
        adminRequest(`/api/admin/labels?query=${encodeURIComponent(query)}&page=1&pageSize=8`),
        adminRequest(`/api/admin/customers?query=${encodeURIComponent(query)}&page=1&pageSize=8`),
      ]);
      setLabelResults(labelData.labels || []); setCustomerResults(customerData.customers || []);
    } catch (cause) { setError(cause.message); }
    finally { setSearching(false); }
  }

  async function submitCorrection(event) {
    event.preventDefault();
    if (!selectedLabel?.id) { setError("Select a label before making a correction."); return; }
    if (reason.trim().length < 10) { setError("Add a clear reason of at least 10 characters for the audit record."); return; }
    if (action === "assign" && !targetUser) { setError("Search for and select the customer who should own this label."); return; }
    if (action === "assign" && selectedLabel.owner?.id && targetUser !== selectedLabel.owner.id && !window.confirm("Transfer this existing box to the selected customer? Its inventory and box record will be preserved.")) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const body = { action, reason: reason.trim(), ...(action === "assign" ? { userId: targetUser } : {}) };
      await adminRequest(`/api/admin/labels/${encodeURIComponent(selectedLabel.id)}/correct`, { method: "POST", body: JSON.stringify(body) });
      const correctionText = action === "assign" ? selectedLabel.owner?.id ? "Existing box ownership corrected; inventory and history retained." : "Label assigned and its first box created." : action === "disable" ? "Label disabled." : "Label enabled.";
      setNotice(`${selectedLabel.serial}: ${correctionText}`);
      setReason("");
      await openLabel(selectedLabel.id, { preserveNotice: true });
    } catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  }

  async function changeCustomerAccess() {
    if (!selectedCustomer?.id) return;
    if (accountReason.trim().length < 10) { setError("Add an account access reason of at least 10 characters."); return; }
    const disabling = selectedCustomer.status?.toLowerCase() !== "disabled";
    if (disabling && !window.confirm(`Disable ${selectedCustomer.email}? Their active sessions will be revoked; their records will remain.`)) return;
    setSavingAccount(true); setError(""); setNotice("");
    try {
      const result = await adminRequest(`/api/admin/customers/${encodeURIComponent(selectedCustomer.id)}/status`, { method: "PATCH", body: JSON.stringify({ action: disabling ? "disable" : "enable", reason: accountReason.trim() }) });
      setAccountReason(""); setNotice(`${result.customer?.email || selectedCustomer.email} account ${disabling ? "disabled" : "enabled"}.`);
      await openCustomer(selectedCustomer.id);
    } catch (cause) { setError(cause.message); }
    finally { setSavingAccount(false); }
  }

  return <div className={`${styles.page} ${supportStyles.page}`}>
    <div className={styles.pageHeading}><div><h1>Support desk</h1><p>Look up an account or label, inspect activity, and make audited corrections.</p></div><Badge variant="warning"><ShieldCheck size={12} /> Admin actions are logged</Badge></div>
    {error && <div className={styles.errorBanner} role="alert"><CircleAlert size={16} /><span>{error}</span>{error.toLowerCase().includes("access") && <Link href="/login">Sign in</Link>}</div>}
    {notice && <div className={supportStyles.notice} role="status"><CheckCircle2 size={15} /><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}

    <div className={supportStyles.supportGrid}>
      <div className={supportStyles.leftColumn}>
        <Card className={supportStyles.searchCard}>
          <div className={supportStyles.cardHeading}><div className={supportStyles.headingIcon}><Search size={15} /></div><div><h2>Find a record</h2><p>Search by label serial, customer email or phone.</p></div></div>
          <form onSubmit={findRecords} className={supportStyles.searchForm}>
            <Input value={labelQuery} onChange={(event) => setLabelQuery(event.target.value)} placeholder="Serial, email or phone" autoComplete="off" />
            <Button type="submit" size="sm" disabled={searching}>{searching ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />} Find</Button>
          </form>
          <div className={supportStyles.resultsGroup}><div className={supportStyles.resultsLabel}>Labels <span>{labelResults.length}</span></div>
            {labelResults.map((label) => <button key={label.id} type="button" className={`${supportStyles.resultRow} ${selectedLabel?.id === label.id ? supportStyles.resultSelected : ""}`} onClick={() => openLabel(label.id)}><span className={supportStyles.resultGlyph}><Boxes size={14} /></span><span className={supportStyles.resultText}><strong>{label.serial}</strong><small>{label.owner?.email || "Unclaimed label"}</small></span><Badge variant={statusVariant(label.status)}>{label.status}</Badge></button>)}
            {labelResults.length === 0 && <div className={supportStyles.resultEmpty}>Search to find matching labels.</div>}
          </div>
          <div className={supportStyles.resultsGroup}><div className={supportStyles.resultsLabel}>Customers <span>{customerResults.length}</span></div>
            {customerResults.map((customer) => <button key={customer.id} type="button" className={`${supportStyles.resultRow} ${selectedCustomer?.id === customer.id ? supportStyles.resultSelected : ""}`} onClick={() => openCustomer(customer.id)}><span className={`${supportStyles.resultGlyph} ${supportStyles.customerGlyph}`}><CircleUserRound size={14} /></span><span className={supportStyles.resultText}><strong>{customer.email}</strong><small>{customer.phone || "No phone"} · {fmtNumber(customer.boxesCount)} boxes</small></span><Badge variant={statusVariant(customer.status)}>{customer.status || "Active"}</Badge></button>)}
            {customerResults.length === 0 && <div className={supportStyles.resultEmpty}>Customer matches appear here.</div>}
          </div>
        </Card>

        {selectedCustomer && <Card className={supportStyles.customerCard}>
          <div className={supportStyles.customerTop}><span className={supportStyles.customerAvatar}><CircleUserRound size={18} /></span><div><h2>{selectedCustomer.email}</h2><small>Customer since {fmtDate(selectedCustomer.createdAt)}</small></div><Badge variant={statusVariant(selectedCustomer.status)}>{selectedCustomer.status || "Active"}</Badge></div>
          <div className={supportStyles.customerFacts}><span><Mail size={12} /> {selectedCustomer.email}</span><span><Phone size={12} /> {selectedCustomer.phone || "No phone recorded"}</span></div>
          <div className={supportStyles.customerMetrics}><span><strong>{fmtNumber(selectedCustomer.counts?.boxes ?? selectedCustomer.boxesCount ?? selectedCustomer.boxes?.length)}</strong><small>Boxes</small></span><span><strong>{fmtNumber(selectedCustomer.counts?.labels ?? selectedCustomer.labelsCount)}</strong><small>Labels</small></span><span><strong>{fmtNumber(selectedCustomer.counts?.scanEvents)}</strong><small>Scans</small></span></div>
          <div className={supportStyles.accountAccess}><div className={supportStyles.accountAccessTop}><div><strong>Account access</strong><small>Disabling revokes active sessions. Customer records remain.</small></div><Badge variant={selectedCustomer.status?.toLowerCase() === "disabled" ? "warning" : "success"}>{selectedCustomer.status || "active"}</Badge></div><Textarea maxLength={1000} minLength={10} value={accountReason} onChange={(event) => setAccountReason(event.target.value)} placeholder="Reason required for account access change" /><Button type="button" size="sm" variant={selectedCustomer.status?.toLowerCase() === "disabled" ? "secondary" : "destructive"} disabled={savingAccount} onClick={changeCustomerAccess}>{savingAccount ? <><LoaderCircle size={13} className="animate-spin" /> Saving</> : selectedCustomer.status?.toLowerCase() === "disabled" ? "Enable account" : "Disable account"}</Button></div>
          <div className={supportStyles.customerSubhead}>Recent boxes</div>
          <div className={supportStyles.customerBoxes}>{(selectedCustomer.boxes || []).slice(0, 6).map((box) => <article className={supportStyles.customerBox} key={box.id}>
            <div className={supportStyles.customerBoxTop}><div><strong>{box.name || `Box ${box.boxNumber}`}</strong><small>Box {box.boxNumber}</small></div><Badge variant={statusVariant(box.status)}>{box.status || "Packing"}</Badge></div>
            <div className={supportStyles.roomPair}><span><small>Origin</small><strong>{box.originRoomName || "Not set"}</strong></span><span><small>Destination</small><strong>{box.roomName || box.room?.name || "Not set"}</strong></span></div>
            <small className={supportStyles.contentsCount}>{fmtNumber(box.items?.length)} inventory records</small>
          </article>)}{!selectedCustomer.boxes?.length && <span className={supportStyles.resultEmpty}>No box details available.</span>}</div>
        </Card>}
      </div>

      <div className={supportStyles.rightColumn}>
        <Card className={supportStyles.labelDetail}>
          <div className={supportStyles.cardHeading}><div className={`${supportStyles.headingIcon} ${supportStyles.labelGlyph}`}><Boxes size={15} /></div><div><h2>Label record</h2><p>Ownership, claim activity and scan history</p></div>{selectedLabel && <Badge variant={statusVariant(selectedLabel.status)}>{selectedLabel.status}</Badge>}</div>
          {loadingLabel ? <div className={supportStyles.detailLoading}><LoaderCircle size={17} className="animate-spin" /> Loading label history…</div> : selectedLabel ? <>
            <div className={supportStyles.labelSummary}><div><span>Printed serial</span><strong>{selectedLabel.serial}</strong></div><div><span>Batch</span><strong>{selectedLabel.batchName || String(selectedLabel.batchId || "—").slice(0, 8)}</strong></div><div><span>Box number</span><strong>{selectedLabel.box?.boxNumber ? `Box ${selectedLabel.box.boxNumber}` : "—"}</strong></div><div><span>Scan count</span><strong>{fmtNumber(selectedLabel.scans)}</strong></div></div>
            {selectedLabel.box && <section className={supportStyles.boxContents} aria-label="Box details and inventory">
              <div className={supportStyles.boxContentsHeading}><div><h3>{selectedLabel.box.name || `Box ${selectedLabel.box.boxNumber}`}</h3><p>Rooms and inventory</p></div></div>
              <div className={supportStyles.roomPair}><span><small>Origin</small><strong>{selectedLabel.box.originRoomName || "Not set"}</strong></span><span><small>Destination</small><strong>{selectedLabel.box.roomName || "Not set"}</strong></span></div>
              <div className={supportStyles.inventoryList}>
                {(selectedLabel.items || []).map((item) => <div className={supportStyles.inventoryItem} key={item.id}>
                  {item.hasImage && <Image className={supportStyles.itemPhoto} src={`/api/items/${encodeURIComponent(item.id)}/image`} width={48} height={48} alt={`Photo of ${item.name}`} unoptimized loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}
                  <span className={supportStyles.inventoryText}><strong>{item.name}</strong>{item.notes && <small>{item.notes}</small>}</span>
                  <span className={supportStyles.itemQuantity}>× {fmtNumber(item.quantity)}</span>
                </div>)}
                {!selectedLabel.items?.length && <div className={supportStyles.noEvents}>No inventory items recorded for this box.</div>}
              </div>
            </section>}
            <div className={supportStyles.ownerBlock}><span className={supportStyles.ownerIcon}><CircleUserRound size={16} /></span><div><small>Current account</small><strong>{selectedLabel.owner?.email || "Unclaimed"}</strong><span>{selectedLabel.owner?.phone || (selectedLabel.owner ? "Phone unavailable" : "No account connected")}</span></div><span className={supportStyles.claimedAt}>{selectedLabel.claimedAt ? `Claimed ${fmtDate(selectedLabel.claimedAt)}` : "Not claimed"}</span></div>
            <div className={supportStyles.eventGrid}><div><small>First scan</small><strong>{fmtDateTime(selectedLabel.firstScannedAt)}</strong></div><div><small>Last scan</small><strong>{fmtDateTime(selectedLabel.lastScannedAt)}</strong></div><div><small>Label created</small><strong>{fmtDateTime(selectedLabel.createdAt)}</strong></div></div>
            <div className={supportStyles.sectionLabel}><Activity size={13} /> Scan events</div>
            <div className={supportStyles.timeline}>{events.slice(0, 12).map((event, index) => <div className={supportStyles.timelineItem} key={event.id || index}><span className={supportStyles.timelineDot} /><div><strong>{event.outcome || event.eventKind || event.type || "Scan recorded"}</strong><small>{event.actor?.email || event.accountEmail || event.email || event.source || "Customer scan"}</small></div><time>{fmtDateTime(event.createdAt || event.at)}</time></div>)}{!events.length && <div className={supportStyles.noEvents}>No scan events recorded.</div>}</div>
            <div className={supportStyles.sectionLabel}><ShieldCheck size={13} /> Admin history</div>
            <div className={supportStyles.auditList}>{audit.slice(0, 6).map((entry, index) => <div className={supportStyles.auditItem} key={entry.id || index}><span><strong>{entry.action || entry.type || "Admin change"}</strong><small>{entry.reason || "No reason provided"} · {entry.actor?.email || entry.actorEmail || entry.adminEmail || "Administrator"}</small></span><time>{fmtDateTime(entry.createdAt || entry.at)}</time></div>)}{!audit.length && <div className={supportStyles.noEvents}>No admin corrections recorded.</div>}</div>
          </> : <div className={supportStyles.emptyDetail}><Boxes size={22} /><strong>Select a label</strong><span>Choose a result to inspect its ownership, scans and support history.</span></div>}
        </Card>

        <Card className={supportStyles.correctionCard}>
          <div className={supportStyles.cardHeading}><div className={`${supportStyles.headingIcon} ${supportStyles.correctionGlyph}`}><UserRoundCog size={15} /></div><div><h2>Manual correction</h2><p>Each change is preserved in the admin audit log.</p></div></div>
          <form className={supportStyles.correctionForm} onSubmit={submitCorrection}>
            <label className={supportStyles.formField}><span>Action</span><Select value={action} onValueChange={setAction}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="assign">Assign or correct owner</SelectItem><SelectItem value="disable">Disable label</SelectItem><SelectItem value="enable">Enable label</SelectItem></SelectContent></Select></label>
            {action === "assign" && <label className={supportStyles.formField}><span>Assign to</span><Select value={targetUser} onValueChange={setTargetUser}><SelectTrigger><SelectValue placeholder="Find customer first" /></SelectTrigger><SelectContent>{customerResults.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.email}</SelectItem>)}</SelectContent></Select></label>}
            {action === "assign" && selectedCustomer && <div className={supportStyles.targetHint}>Selected customer: <strong>{selectedCustomer.email}</strong></div>}
            <label className={supportStyles.formField}><span>Reason <em>required · at least 10 characters</em></span><Textarea maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What happened and why is this correction needed?" required minLength={10} /></label>
            <div className={supportStyles.correctionFoot}><span><AlertTriangle size={13} /> A claimed QR stays attached to its one box. Owner corrections preserve its record and inventory.</span><Button type="submit" size="sm" disabled={saving || !selectedLabel}>{saving ? <><LoaderCircle size={13} className="animate-spin" /> Saving</> : "Apply correction"}</Button></div>
            {!selectedLabel && <small className={supportStyles.requiresLabel}>Select a label before applying an action.</small>}
          </form>
        </Card>
      </div>
    </div>
    <div className={supportStyles.auditHint}><Clock3 size={13} /><span>Corrections record who changed a label, the previous state, the new state, and the required reason.</span><Link href="/admin/audit">Open full audit log</Link></div>
  </div>;
}

export default function SupportPage() {
  return <Suspense fallback={<div className="admin-shell p-8 text-sm text-muted-foreground">Loading support desk…</div>}><SupportContent /></Suspense>;
}
