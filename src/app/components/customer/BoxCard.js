"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, boxDisplayName, boxStickerSerial, defaultBoxName } from "./api";
import { CustomerIcon, CustomerLogo } from "./CustomerFrame";
import RoomSelect from "./RoomSelect";
import { prepareItemPhoto } from "./photo";

const statusLabels = { packing: "Packing", packed: "Packed", unpacked: "Unpacked" };
const statusClasses = { packed: "status-packed", unpacked: "status-unpacked", packing: "status-packing" };

function newMutationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

// Editable table cell for text. Commits on blur or Enter, reverts on Escape.
function InlineText({ value, ariaLabel, placeholder, maxLength, required = false, disabled, onCommit }) {
  const [text, setText] = useState(value);
  const skip = useRef(false);
  useEffect(() => { setText(value); }, [value]);

  async function commit() {
    if (skip.current) { skip.current = false; return; }
    const next = text.trim();
    if (next === (value || "").trim()) return;
    if (required && !next) { setText(value); return; }
    try { await onCommit(next); }
    catch { setText(value); }
  }

  return <input className="bx-cell-input" value={text} aria-label={ariaLabel} placeholder={placeholder} maxLength={maxLength} disabled={disabled}
    onChange={(event) => setText(event.target.value)}
    onBlur={commit}
    onKeyDown={(event) => {
      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === "Escape") { skip.current = true; setText(value); event.currentTarget.blur(); }
    }} />;
}

// Editable table cell for quantity. Clamps to 1..10000.
function InlineQuantity({ value, ariaLabel, disabled, onCommit }) {
  const [text, setText] = useState(String(value));
  const skip = useRef(false);
  useEffect(() => { setText(String(value)); }, [value]);

  function clamp(raw) {
    const parsed = Math.round(Number(raw));
    if (!Number.isFinite(parsed)) return null;
    return Math.min(10000, Math.max(1, parsed));
  }

  async function commit() {
    if (skip.current) { skip.current = false; return; }
    const next = clamp(text);
    if (next === null || next === value) { setText(String(value)); return; }
    try { await onCommit(next); }
    catch { setText(String(value)); }
  }

  return <input className="bx-cell-input bx-cell-qty" type="number" inputMode="numeric" min="1" max="10000" value={text} aria-label={ariaLabel} disabled={disabled}
    onChange={(event) => setText(event.target.value)}
    onBlur={commit}
    onKeyDown={(event) => {
      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === "Escape") { skip.current = true; setText(String(value)); event.currentTarget.blur(); }
    }} />;
}

function BoxPrintSheet({ box }) {
  const items = box.items || [];
  const name = boxDisplayName(box);
  const serial = boxStickerSerial(box);
  return <section className="box-print-sheet" aria-label="Printable box list">
    <div className="box-print-brand"><CustomerLogo /></div>
    <h1>{name}</h1>
    {serial && <p className="box-print-serial">Label serial {serial}</p>}
    <dl className="box-print-details">
      <div><dt>Origin</dt><dd>{box.originRoom?.name || "Not set"}</dd></div>
      <div><dt>Destination</dt><dd>{box.room?.name || "Not set"}</dd></div>
      <div><dt>Packing stage</dt><dd>{statusLabels[box.status] || "Packing"}</dd></div>
      {box.fragile && <div><dt>Care</dt><dd>Handle with care</dd></div>}
      {box.openEarly && <div><dt>Open first</dt><dd>Yes</dd></div>}
      {box.notes && <div><dt>Notes</dt><dd>{box.notes}</dd></div>}
    </dl>
    <h2>Inventory</h2>
    <table><thead><tr><th>Item</th><th>Quantity</th></tr></thead><tbody>
      {items.length ? items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.quantity || 1}</td></tr>) : <tr><td colSpan="2">No inventory added</td></tr>}
    </tbody></table>
  </section>;
}

export default function BoxCard({ box, rooms, expanded, justAdded, onToggle, onRoomCreated }) {
  const boxId = box.id;
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingField, setSavingField] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [printing, setPrinting] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const loadedFor = useRef(null);
  const loadGeneration = useRef(0);
  const pendingMutations = useRef(new Set());
  const draftInputs = useRef(new Map());

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError("");
    try {
      const data = await api(`/api/boxes/${encodeURIComponent(boxId)}`, { cache: "no-store" });
      if (generation !== loadGeneration.current) return;
      setDetail(data.box);
    } catch (failure) {
      if (generation !== loadGeneration.current) return;
      setError(failure?.message || "This box could not be opened.");
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [boxId]);

  useEffect(() => {
    if (!expanded) return;
    if (loadedFor.current === boxId) return;
    loadedFor.current = boxId;
    load();
  }, [expanded, boxId, load]);

  function reload() {
    loadedFor.current = null;
    load();
  }

  useEffect(() => () => { loadGeneration.current += 1; }, []);

  useEffect(() => {
    if (!printing) return;
    let finished = false;
    const finish = () => { if (finished) return; finished = true; setPrinting(false); };
    window.addEventListener("afterprint", finish);
    const raf = window.requestAnimationFrame(() => window.print());
    const fallback = window.setTimeout(finish, 4000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
      window.removeEventListener("afterprint", finish);
    };
  }, [printing]);

  function setBusy(id, busy) {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function patchBox(patch, field) {
    setError("");
    if (field) setSavingField(field);
    try {
      const data = await api(`/api/boxes/${encodeURIComponent(boxId)}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (data.box) setDetail(data.box);
      return data.box;
    } catch (failure) {
      setError(failure?.message || "That change could not be saved.");
      setResetToken((token) => token + 1);
      throw failure;
    } finally {
      if (field) setSavingField("");
    }
  }

  async function selectRoom(field, roomId) {
    await patchBox({ [field]: roomId || null }, field);
  }

  async function createRoom(field, roomName) {
    const data = await api("/api/rooms", { method: "POST", body: JSON.stringify({ name: roomName }) });
    const room = data.room;
    if (!room) throw new Error("That room could not be added.");
    onRoomCreated?.(room);
    await patchBox({ [field]: room.id }, field);
    return room;
  }

  async function updateItem(item, patch) {
    if (pendingMutations.current.has(item.id)) return;
    pendingMutations.current.add(item.id);
    setBusy(item.id, true);
    setError("");
    try {
      const data = await api(`/api/items/${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify(patch) });
      const updated = data.item || { ...item, ...patch };
      setDetail((current) => current ? { ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, ...updated } : entry) } : current);
    } catch (failure) {
      setError(failure?.message || "That item could not be updated.");
      throw failure;
    } finally {
      pendingMutations.current.delete(item.id);
      setBusy(item.id, false);
    }
  }

  async function removeItem(item) {
    if (pendingMutations.current.has(item.id)) return;
    pendingMutations.current.add(item.id);
    setBusy(item.id, true);
    setError("");
    try {
      await api(`/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      setDetail((current) => current ? { ...current, items: current.items.filter((entry) => entry.id !== item.id) } : current);
    } catch (failure) {
      setError(failure?.message || "That item could not be removed.");
    } finally {
      pendingMutations.current.delete(item.id);
      setBusy(item.id, false);
    }
  }

  function addDraft() {
    const draft = { key: newMutationId(), name: "", qty: "1", mutationId: newMutationId() };
    setDrafts((current) => [...current, draft]);
    window.requestAnimationFrame(() => draftInputs.current.get(draft.key)?.focus());
  }

  function updateDraft(key, patch) {
    setDrafts((current) => current.map((draft) => draft.key === key
      ? { ...draft, ...patch, mutationId: patch.name !== undefined && patch.name !== draft.name ? newMutationId() : draft.mutationId }
      : draft));
  }

  function removeDraft(key) {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
  }

  async function commitDraft(draft) {
    if (pendingMutations.current.has(draft.key)) return;
    const itemName = draft.name.trim();
    if (!itemName) { removeDraft(draft.key); return; }
    const quantity = Math.min(10000, Math.max(1, Math.round(Number(draft.qty) || 1)));
    pendingMutations.current.add(draft.key);
    setBusy(draft.key, true);
    setError("");
    try {
      const data = await api(`/api/boxes/${encodeURIComponent(boxId)}/items`, {
        method: "POST",
        body: JSON.stringify({ name: itemName, quantity, clientMutationId: draft.mutationId }),
      });
      if (!data.item) throw new Error("That item could not be added.");
      setDetail((current) => current ? { ...current, items: [...current.items, data.item] } : current);
      removeDraft(draft.key);
    } catch (failure) {
      setError(failure?.message || "That item could not be added. Try again.");
    } finally {
      pendingMutations.current.delete(draft.key);
      setBusy(draft.key, false);
    }
  }

  async function uploadItemPhoto(item, file) {
    if (pendingMutations.current.has(item.id)) return;
    pendingMutations.current.add(item.id);
    setBusy(item.id, true);
    setError("");
    try {
      const prepared = await prepareItemPhoto(file);
      const form = new FormData();
      form.append("image", prepared);
      const data = await api(`/api/items/${encodeURIComponent(item.id)}/image`, { method: "POST", timeoutMs: 30_000, body: form });
      const base = data.imageUrl || `/api/items/${encodeURIComponent(item.id)}/image`;
      const imageUrl = `${base}${base.includes("?") ? "&" : "?"}v=${Date.now()}`;
      setDetail((current) => current ? { ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, hasImage: true, imageUrl } : entry) } : current);
    } catch (failure) {
      setError(failure?.message || "That photo could not be saved.");
    } finally {
      pendingMutations.current.delete(item.id);
      setBusy(item.id, false);
    }
  }

  async function removeItemPhoto(item) {
    if (pendingMutations.current.has(item.id)) return;
    pendingMutations.current.add(item.id);
    setBusy(item.id, true);
    setError("");
    try {
      await api(`/api/items/${encodeURIComponent(item.id)}/image`, { method: "DELETE" });
      setDetail((current) => current ? { ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, hasImage: false, imageUrl: null } : entry) } : current);
    } catch (failure) {
      setError(failure?.message || "That photo could not be removed.");
    } finally {
      pendingMutations.current.delete(item.id);
      setBusy(item.id, false);
    }
  }

  function onPhotoPicked(event, item) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) uploadItemPhoto(item, file);
  }

  const display = detail || box;
  const displayName = boxDisplayName(display);
  const serial = boxStickerSerial(display);
  const items = detail?.items || [];
  const itemCount = detail ? items.length : (box.itemCount || 0);
  const fallbackName = detail ? defaultBoxName(detail) : "";
  const customName = detail && detail.name && detail.name !== fallbackName ? detail.name : "";
  const notesValue = detail?.notes ?? "";

  return <article className={`bx-card${expanded ? " is-open" : ""}`}>
    <button type="button" className="bx-card-head" aria-expanded={expanded} onClick={onToggle}>
      <span className={`bx-chevron${expanded ? " is-open" : ""}`}><CustomerIcon name="chevron" size={18} /></span>
      <span className="bx-card-heading">
        <strong className="bx-card-name">{displayName}</strong>
        <span className="bx-card-meta">
          {serial && <span className="bx-card-serial">Label {serial}</span>}
          <span className="bx-card-dest"><CustomerIcon name="room" size={14} />{display.room?.name || "Room not set"}</span>
          <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
        </span>
      </span>
      <span className={`status-pill ${statusClasses[display.status] || "status-packing"}`}>{statusLabels[display.status] || "Packing"}</span>
    </button>

    {expanded && <div className="bx-card-body">
      {justAdded && <div className="box-added-notice"><span className="added-check"><CustomerIcon name="check" size={15} /></span><span><strong>Your box is ready.</strong> Add what is inside, then choose a room.</span></div>}
      {error && <div className="customer-alert" role="alert">{error}<button type="button" onClick={reload}>Reload</button></div>}

      {loading && !detail
        ? <div className="customer-loading"><span className="customer-spinner" />Opening your box…</div>
        : detail && <>
          <div className="bx-roomplan">
            <RoomSelect label="From" value={detail.originRoomId || ""} rooms={rooms} disabled={savingField === "originRoomId"} onSelect={(id) => selectRoom("originRoomId", id)} onCreate={(name) => createRoom("originRoomId", name)} />
            <RoomSelect label="To" value={detail.roomId || ""} rooms={rooms} disabled={savingField === "roomId"} onSelect={(id) => selectRoom("roomId", id)} onCreate={(name) => createRoom("roomId", name)} />
            <button type="button" className="bx-print" onClick={() => setPrinting(true)}><CustomerIcon name="print" size={16} /> Print box</button>
          </div>

          <table className="bx-table" aria-label="Box inventory">
            <thead><tr>
              <th scope="col">Item</th>
              <th scope="col" className="bx-col-photo">Photo</th>
              <th scope="col" className="bx-col-qty">Qty</th>
              <th scope="col" className="bx-col-del"><span className="sr-only">Remove</span></th>
            </tr></thead>
            <tbody>
              {items.map((item) => {
                const pending = busyIds.has(item.id);
                const imageSrc = item.imageUrl || `/api/items/${encodeURIComponent(item.id)}/image`;
                return <tr key={item.id} aria-busy={pending}>
                  <td className="bx-cell-name">
                    <InlineText value={item.name} ariaLabel={`Item name for ${item.name}`} maxLength={240} required disabled={pending} onCommit={(next) => updateItem(item, { name: next })} />
                  </td>
                  <td className="bx-cell-photo">
                    <div className="bx-photo">
                      <label className={`bx-photo-btn${pending ? " is-disabled" : ""}`} title={item.hasImage ? "Change photo" : "Add photo"}>
                        {item.hasImage ? <img src={imageSrc} alt="" loading="lazy" /> : <CustomerIcon name="photo" size={16} />}
                        <span className="sr-only">{item.hasImage ? `Change photo of ${item.name}` : `Add photo to ${item.name}`}</span>
                        <input type="file" accept="image/*" disabled={pending} onChange={(event) => onPhotoPicked(event, item)} />
                      </label>
                      {item.hasImage && <button type="button" className="bx-photo-remove" aria-label={`Remove photo of ${item.name}`} disabled={pending} onClick={() => removeItemPhoto(item)}><CustomerIcon name="close" size={14} /></button>}
                    </div>
                  </td>
                  <td className="bx-cell-qty">
                    <InlineQuantity value={item.quantity || 1} ariaLabel={`Quantity of ${item.name}`} disabled={pending} onCommit={(next) => updateItem(item, { quantity: next })} />
                  </td>
                  <td className="bx-cell-del">
                    <button type="button" className="bx-row-delete" aria-label={`Remove ${item.name}`} disabled={pending} onClick={() => removeItem(item)}>{pending ? <span className="customer-spinner bx-spinner-sm" /> : <CustomerIcon name="trash" size={16} />}</button>
                  </td>
                </tr>;
              })}
              {drafts.map((draft) => {
                const pending = busyIds.has(draft.key);
                return <tr key={draft.key} className="bx-draft-row" aria-busy={pending}
                  onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) commitDraft(draft); }}>
                  <td className="bx-cell-name">
                    <input ref={(element) => { if (element) draftInputs.current.set(draft.key, element); else draftInputs.current.delete(draft.key); }}
                      className="bx-cell-input" value={draft.name} placeholder="Item name" aria-label="New item name" maxLength={240} disabled={pending}
                      onChange={(event) => updateDraft(draft.key, { name: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") { event.preventDefault(); commitDraft(draft); }
                        if (event.key === "Escape") removeDraft(draft.key);
                      }} />
                  </td>
                  <td className="bx-cell-photo"><span className="bx-photo-pending">Save row to add a photo</span></td>
                  <td className="bx-cell-qty">
                    <input className="bx-cell-input bx-cell-qty" type="number" inputMode="numeric" min="1" max="10000" value={draft.qty} aria-label="New item quantity" disabled={pending}
                      onChange={(event) => updateDraft(draft.key, { qty: event.target.value })}
                      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitDraft(draft); } }} />
                  </td>
                  <td className="bx-cell-del">
                    <button type="button" className="bx-row-delete" aria-label="Discard new item" disabled={pending} onClick={() => removeDraft(draft.key)}>{pending ? <span className="customer-spinner bx-spinner-sm" /> : <CustomerIcon name="close" size={16} />}</button>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
          {items.length === 0 && drafts.length === 0 && <p className="bx-table-empty">Nothing here yet. Add the first item below.</p>}
          <div className="bx-table-foot">
            <button type="button" className="bx-add-item" onClick={addDraft}><CustomerIcon name="plus" size={16} /> Add item</button>
          </div>

          <div className="bx-details">
            <label className="bx-detail-field">
              <span>Box name</span>
              <input key={`name-${resetToken}-${detail.name ?? ""}`} className="bx-detail-input" defaultValue={customName} placeholder={fallbackName} maxLength={80} disabled={savingField === "name"}
                onBlur={(event) => { const next = event.target.value.trim(); if (next !== customName) patchBox({ name: next || null }, "name").catch(() => {}); }}
                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
            </label>
            <label className="bx-detail-field">
              <span>Stage</span>
              <select className="bx-detail-input" value={detail.status || "packing"} disabled={savingField === "status"} onChange={(event) => patchBox({ status: event.target.value }, "status").catch(() => {})}>
                <option value="packing">Packing</option>
                <option value="packed">Packed</option>
                <option value="unpacked">Unpacked</option>
              </select>
            </label>
            <div className="bx-flags">
              <label><input type="checkbox" checked={Boolean(detail.fragile)} disabled={savingField === "fragile"} onChange={(event) => patchBox({ fragile: event.target.checked }, "fragile").catch(() => {})} /><span>Handle with care</span></label>
              <label><input type="checkbox" checked={Boolean(detail.openEarly)} disabled={savingField === "openEarly"} onChange={(event) => patchBox({ openEarly: event.target.checked }, "openEarly").catch(() => {})} /><span>Open first</span></label>
            </div>
            <label className="bx-detail-field bx-detail-notes">
              <span>Notes</span>
              <input key={`notes-${resetToken}-${notesValue}`} className="bx-detail-input" defaultValue={notesValue} placeholder="Anything helpful when you unpack" maxLength={1000} disabled={savingField === "notes"}
                onBlur={(event) => { const next = event.target.value.trim(); if (next !== notesValue) patchBox({ notes: next || null }, "notes").catch(() => {}); }}
                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
            </label>
            <span className="bx-detail-status" role="status">{savingField ? "Saving…" : ""}</span>
          </div>
        </>}
    </div>}

    {printing && detail && <BoxPrintSheet box={detail} />}
  </article>;
}
