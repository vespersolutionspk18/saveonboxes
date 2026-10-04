"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, boxNumber } from "./api";
import { CustomerFrame, CustomerIcon, LoadingState } from "./CustomerFrame";
import { Input } from "../../../components/ui/input.jsx";
import { Textarea } from "../../../components/ui/textarea.jsx";

export default function BoxDetails({ id }) {
  const router = useRouter();
  const [box, setBox] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [status, setStatus] = useState("packing");
  const [notes, setNotes] = useState("");
  const [fragile, setFragile] = useState(false);
  const [openEarly, setOpenEarly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [itemText, setItemText] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemBusy, setItemBusy] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [wasJustAdded, setWasJustAdded] = useState(false);

  useEffect(() => { setWasJustAdded(new URLSearchParams(window.location.search).get("added") === "1"); }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      const [boxResponse, roomResponse] = await Promise.all([
        api(`/api/boxes/${encodeURIComponent(id)}`, { cache: "no-store" }),
        api("/api/rooms", { cache: "no-store" }),
      ]);
      const next = boxResponse.box;
      setBox(next); setRooms(roomResponse.rooms || []);
      setName(next.name || ""); setRoomId(next.roomId || ""); setStatus(next.status || "packing"); setNotes(next.notes || ""); setFragile(Boolean(next.fragile)); setOpenEarly(Boolean(next.openEarly));
    } catch (e) {
      if (e.status === 401) router.replace(`/login?next=${encodeURIComponent(`/dashboard/boxes/${id}`)}`);
      else setError(e.message || "We could not open this box.");
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function saveDetails(event) {
    event.preventDefault(); if (!box) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await api(`/api/boxes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() || null, roomId: roomId || null, status, notes: notes.trim() || null, fragile, openEarly }) });
      if (response.box) setBox(response.box);
      setMessage("Saved"); window.setTimeout(() => setMessage(""), 2200);
    } catch (e) { setError(e.message || "Changes could not be saved."); }
    finally { setSaving(false); }
  }

  async function addItems(event) {
    event.preventDefault();
    const names = itemText.split(/\n|,/).map((value) => value.trim()).filter(Boolean);
    if (!names.length) return;
    setItemBusy(true); setError("");
    try {
      const additions = [];
      for (const itemName of names) {
        const response = await api(`/api/boxes/${encodeURIComponent(id)}/items`, { method: "POST", body: JSON.stringify({ name: itemName, quantity: Math.max(1, Number(itemQty) || 1) }) });
        if (response.item) additions.push(response.item);
      }
      setBox((current) => current ? { ...current, items: [...(current.items || []), ...additions] } : current);
      setItemText(""); setItemQty("1");
    } catch (e) { setError(e.message || "We could not add these items. Try again."); }
    finally { setItemBusy(false); }
  }

  async function updateItem(item, patch) {
    setError("");
    try {
      const response = await api(`/api/items/${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify(patch) });
      const updated = response.item || { ...item, ...patch };
      setBox((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? updated : entry) }));
      setEditingItem(null);
    } catch (e) { setError(e.message || "Item could not be updated."); }
  }

  async function removeItem(item) {
    setError("");
    try {
      await api(`/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      setBox((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }));
    } catch (e) { setError(e.message || "Item could not be removed."); }
  }

  if (!box && !error) return <CustomerFrame><main className="customer-main"><LoadingState label="Opening your box…" /></main></CustomerFrame>;
  if (!box) return <CustomerFrame><main className="customer-main"><Link className="customer-back-link" href="/dashboard"><CustomerIcon name="back" /> All boxes</Link><div className="customer-alert" role="alert">{error}<button onClick={load}>Try again</button></div></main></CustomerFrame>;

  const items = box.items || [];
  return <CustomerFrame>
    <main className="customer-main customer-box-detail">
      <Link className="customer-back-link" href="/dashboard"><CustomerIcon name="back" size={16} /> All boxes</Link>
      {wasJustAdded && <div className="box-added-notice"><span className="added-check"><CustomerIcon name="check" size={15} /></span><span><strong>Your box is ready.</strong> Choose its room and add what’s inside.</span></div>}
      <div className="box-detail-heading">
        <div><div className="customer-eyebrow">YOUR BOX</div><h1>{boxNumber(box)}</h1>{box.name && <p className="box-optional-name">{box.name}</p>}</div>
        <button className="customer-button customer-button-quiet" onClick={() => window.print()}><CustomerIcon name="print" size={16} /> Print box</button>
      </div>
      {error && <div className="customer-alert" role="alert">{error}<button onClick={load}>Reload</button></div>}

      <div className="box-detail-grid">
        <section className="box-section box-inventory-section">
          <div className="box-section-heading"><div><span className="customer-eyebrow">INSIDE THIS BOX</span><h2>Inventory <span className="heading-count">{items.length}</span></h2></div><p>Write one item per line or separate with commas.</p></div>
          {items.length === 0 ? <div className="inventory-empty"><span className="customer-empty-icon"><CustomerIcon name="spark" size={21} /></span><p>What are you putting in this box?</p></div> : <ul className="inventory-list">
            {items.map((item) => <li key={item.id} className="inventory-item">
              {editingItem === item.id ? <form className="inventory-edit" onSubmit={(e) => { e.preventDefault(); updateItem(item, { name: editValue.trim() }); }}><input value={editValue} onChange={(e) => setEditValue(e.target.value)} aria-label="Edit item name" autoFocus /><button className="item-action item-save" aria-label="Save item name"><CustomerIcon name="check" size={16} /></button><button className="item-action" type="button" onClick={() => setEditingItem(null)} aria-label="Cancel editing"><CustomerIcon name="close" size={16} /></button></form> : <>
                <span className="inventory-item-name">{item.name}{item.notes && <small>{item.notes}</small>}</span>
                <span className="inventory-quantity"><button aria-label={`Remove one ${item.name}`} onClick={() => updateItem(item, { quantity: Math.max(1, (Number(item.quantity) || 1) - 1) })}>−</button><strong>{item.quantity || 1}</strong><button aria-label={`Add one ${item.name}`} onClick={() => updateItem(item, { quantity: (Number(item.quantity) || 1) + 1 })}>+</button></span>
                <button className="item-action" onClick={() => { setEditingItem(item.id); setEditValue(item.name); }} aria-label={`Edit ${item.name}`}><CustomerIcon name="edit" size={16} /></button>
                <button className="item-action item-delete" onClick={() => removeItem(item)} aria-label={`Remove ${item.name}`}><CustomerIcon name="trash" size={16} /></button>
              </>}
            </li>)}
          </ul>}
          <form className="add-items-form" onSubmit={addItems}>
            <label htmlFor="item-list">Add something</label>
            <Textarea className="customer-textarea add-items-textarea" id="item-list" value={itemText} onChange={(e) => setItemText(e.target.value)} placeholder="Kettle, mugs, dish towels…" rows={2} />
            <div className="add-items-controls"><label>Qty each <Input className="customer-quantity-input" type="number" min="1" max="999" value={itemQty} onChange={(e) => setItemQty(e.target.value)} /></label><button className="customer-button customer-button-primary" disabled={itemBusy || !itemText.trim()}><CustomerIcon name="plus" size={16} /> {itemBusy ? "Adding…" : "Add items"}</button></div>
          </form>
        </section>

        <section className="box-section box-properties-section">
          <form onSubmit={saveDetails}>
            <div className="box-section-heading"><div><span className="customer-eyebrow">WHERE IT GOES</span><h2>Box details</h2></div></div>
            <label className="field-label">Destination room<select value={roomId} onChange={(e) => setRoomId(e.target.value)}><option value="">Choose a room</option>{rooms.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}</select>{rooms.length === 0 && <Link className="customer-text-link" href="/dashboard?addRoom=1">Add a room</Link>}</label>
            <label className="field-label">Box name <span className="field-optional">optional</span><Input className="customer-field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example, everyday dishes" maxLength={80} /></label>
            <label className="field-label">Packing stage<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="packing">Packing</option><option value="packed">Packed</option><option value="unpacked">Unpacked</option></select></label>
            <label className="field-label">Notes <span className="field-optional">optional</span><Textarea className="customer-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything helpful when you unpack" rows={3} maxLength={1000} /></label>
            <div className="box-flags"><label><input type="checkbox" checked={fragile} onChange={(e) => setFragile(e.target.checked)} /><span>Handle with care</span></label><label><input type="checkbox" checked={openEarly} onChange={(e) => setOpenEarly(e.target.checked)} /><span>Open first</span></label></div>
            <div className="box-save-row"><span role="status">{saving ? "Saving…" : message}</span><button className="customer-button customer-button-primary" disabled={saving}>{saving ? "Saving…" : "Save box"}</button></div>
          </form>
          <p className="box-privacy-note">This label stays with this box. You can update its room and contents anytime.</p>
        </section>
      </div>
    </main>
  </CustomerFrame>;
}
