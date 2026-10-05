"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, boxNumber } from "./api";
import { CustomerFrame, CustomerIcon, CustomerLogo, LoadingState } from "./CustomerFrame";
import { Input } from "../../../components/ui/input.jsx";
import { Textarea } from "../../../components/ui/textarea.jsx";

const statusLabels = { packing: "Packing", packed: "Packed", unpacked: "Unpacked" };

export default function BoxDetails({ id }) {
  const router = useRouter();
  const [box, setBox] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [originRoomId, setOriginRoomId] = useState("");
  const [status, setStatus] = useState("packing");
  const [notes, setNotes] = useState("");
  const [fragile, setFragile] = useState(false);
  const [openEarly, setOpenEarly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingRooms, setSavingRooms] = useState(false);
  const [message, setMessage] = useState("");
  const [roomMessage, setRoomMessage] = useState("");
  const [roomsEditorOpen, setRoomsEditorOpen] = useState(false);
  const [roomCreationFor, setRoomCreationFor] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [error, setError] = useState("");
  const [itemText, setItemText] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPhoto, setItemPhoto] = useState(null);
  const [itemBusy, setItemBusy] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [wasJustAdded, setWasJustAdded] = useState(false);
  const addPhotoInput = useRef(null);
  const pendingItemMutations = useRef(new Set());
  const [busyItemIds, setBusyItemIds] = useState(() => new Set());

  useEffect(() => { setWasJustAdded(new URLSearchParams(window.location.search).get("added") === "1"); }, []);

  function mergeBoxMetadata(nextBox) {
    if (!nextBox) return;
    setBox((current) => current
      ? { ...nextBox, items: current.items ?? nextBox.items ?? [] }
      : nextBox);
  }

  const load = useCallback(async () => {
    setError("");
    try {
      const [boxResponse, roomResponse] = await Promise.all([
        api(`/api/boxes/${encodeURIComponent(id)}`, { cache: "no-store" }),
        api("/api/rooms", { cache: "no-store" }),
      ]);
      const next = boxResponse.box;
      setBox(next); setRooms(roomResponse.rooms || []);
      setName(next.name || boxNumber(next)); setRoomId(next.roomId || ""); setOriginRoomId(next.originRoomId || ""); setStatus(next.status || "packing"); setNotes(next.notes || ""); setFragile(Boolean(next.fragile)); setOpenEarly(Boolean(next.openEarly));
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
      const response = await api(`/api/boxes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() || boxNumber(box), roomId: roomId || null, originRoomId: originRoomId || null, status, notes: notes.trim() || null, fragile, openEarly }) });
      mergeBoxMetadata(response.box);
      setName(response.box?.name || boxNumber(box));
      setMessage("Saved"); window.setTimeout(() => setMessage(""), 2200);
    } catch (e) { setError(e.message || "Changes could not be saved."); }
    finally { setSaving(false); }
  }

  async function saveRooms(event) {
    event.preventDefault(); if (!box) return;
    setSavingRooms(true); setRoomMessage(""); setError("");
    try {
      const response = await api(`/api/boxes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ roomId: roomId || null, originRoomId: originRoomId || null }) });
      mergeBoxMetadata(response.box);
      setRoomMessage("Rooms saved"); window.setTimeout(() => setRoomMessage(""), 2200);
    } catch (e) { setError(e.message || "The rooms could not be saved."); }
    finally { setSavingRooms(false); }
  }

  async function createRoom(event) {
    event.preventDefault();
    if (!newRoomName.trim() || !roomCreationFor || creatingRoom) return;
    setCreatingRoom(true); setRoomMessage(""); setError("");
    try {
      const { room } = await api("/api/rooms", { method: "POST", body: JSON.stringify({ name: newRoomName.trim() }) });
      if (!room) throw new Error("The room could not be added.");
      const field = roomCreationFor === "origin" ? "originRoomId" : "roomId";
      setRooms((current) => current.some((entry) => entry.id === room.id) ? current : [...current, room]);
      if (field === "originRoomId") setOriginRoomId(room.id); else setRoomId(room.id);
      setNewRoomName(""); setRoomCreationFor("");
      let response;
      try {
        response = await api(`/api/boxes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ [field]: room.id }) });
      } catch (e) {
        setError(`Room added and selected. Save rooms to attach it to this box. ${e.message}`);
        return;
      }
      mergeBoxMetadata(response.box);
      setRoomMessage(`${field === "originRoomId" ? "Origin" : "Destination"} room added`);
      window.setTimeout(() => setRoomMessage(""), 2200);
    } catch (e) { setError(e.message || "Room could not be added."); }
    finally { setCreatingRoom(false); }
  }

  async function addItems(event) {
    event.preventDefault();
    const itemName = itemText.trim();
    if (!itemName) return;
    setItemBusy(true); setError("");
    try {
      const preparedPhoto = itemPhoto ? await prepareItemPhoto(itemPhoto) : null;
      const response = await api(`/api/boxes/${encodeURIComponent(id)}/items`, { method: "POST", body: JSON.stringify({ name: itemName, quantity: Math.max(1, Number(itemQty) || 1) }) });
      if (!response.item) throw new Error("The item could not be added.");
      const item = response.item;
      setBox((current) => current ? { ...current, items: [...(current.items || []), item] } : current);
      setItemText(""); setItemQty("1"); setItemPhoto(null);
      if (addPhotoInput.current) addPhotoInput.current.value = "";
      if (preparedPhoto) {
        try { await saveItemPhoto(item, preparedPhoto, true); }
        catch { setError("Item added. Its photo was not saved; choose Add photo on that item to retry."); }
      }
    } catch (e) { setError(e.message || "We could not add this item. Try again."); }
    finally { setItemBusy(false); }
  }

  async function prepareItemPhoto(file) {
    const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!supportedTypes.has(file.type)) throw new Error("Choose a JPG, PNG or WebP photo.");
    if (file.size > 25 * 1024 * 1024) throw new Error("That photo is very large. Choose one under 25 MB.");
    if (typeof createImageBitmap !== "function") throw new Error("This browser could not prepare the photo. Try a JPG, PNG or WebP file in a recent browser.");
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error("This photo could not be opened. Choose a JPG, PNG or WebP image."); }
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 30_000_000) {
      bitmap.close();
      throw new Error("That image is too large to process. Choose a smaller photo.");
    }
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) { bitmap.close(); throw new Error("This browser could not prepare the photo. Try again with a different image."); }
    context.fillStyle = "#FFFFFF"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.82, 0.68, 0.54, 0.4]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (!blob) throw new Error("This browser could not compress the photo. Choose another image.");
      if (blob.size <= 3_500_000) return new File([blob], blob.type === "image/webp" ? "box-item.webp" : "box-item.png", { type: blob.type });
    }
    throw new Error("This photo is still too large after compression. Choose a smaller image.");
  }

  async function saveItemPhoto(item, file, alreadyPrepared = false) {
    if (pendingItemMutations.current.has(item.id)) throw new Error("Wait for the current item change to finish.");
    pendingItemMutations.current.add(item.id);
    setBusyItemIds((current) => new Set(current).add(item.id));
    try {
      const preparedPhoto = alreadyPrepared ? file : await prepareItemPhoto(file);
      const form = new FormData();
      form.append("image", preparedPhoto);
      const result = await api(`/api/items/${encodeURIComponent(item.id)}/image`, { method: "POST", body: form });
      const baseImageUrl = result.imageUrl || `/api/items/${encodeURIComponent(item.id)}/image`;
      const imageUrl = `${baseImageUrl}${baseImageUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
      setBox((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, hasImage: true, imageUrl } : entry) }));
    } finally {
      pendingItemMutations.current.delete(item.id);
      setBusyItemIds((current) => { const next = new Set(current); next.delete(item.id); return next; });
    }
  }

  async function removeItemPhoto(item) {
    if (pendingItemMutations.current.has(item.id)) return;
    pendingItemMutations.current.add(item.id);
    setBusyItemIds((current) => new Set(current).add(item.id));
    setError("");
    try {
      await api(`/api/items/${encodeURIComponent(item.id)}/image`, { method: "DELETE" });
      setBox((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, hasImage: false, imageUrl: null } : entry) }));
    } catch (e) { setError(e.message || "Photo could not be removed."); }
    finally {
      pendingItemMutations.current.delete(item.id);
      setBusyItemIds((current) => { const next = new Set(current); next.delete(item.id); return next; });
    }
  }

  async function updateItem(item, patch) {
    if (pendingItemMutations.current.has(item.id)) return;
    pendingItemMutations.current.add(item.id);
    setBusyItemIds((current) => new Set(current).add(item.id));
    setError("");
    try {
      const response = await api(`/api/items/${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify(patch) });
      const updated = response.item || { ...item, ...patch };
      setBox((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? updated : entry) }));
      setEditingItem(null);
    } catch (e) { setError(e.message || "Item could not be updated."); }
    finally {
      pendingItemMutations.current.delete(item.id);
      setBusyItemIds((current) => { const next = new Set(current); next.delete(item.id); return next; });
    }
  }

  async function removeItem(item) {
    if (pendingItemMutations.current.has(item.id)) return;
    pendingItemMutations.current.add(item.id);
    setBusyItemIds((current) => new Set(current).add(item.id));
    setError("");
    try {
      await api(`/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      setBox((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }));
    } catch (e) { setError(e.message || "Item could not be removed."); }
    finally {
      pendingItemMutations.current.delete(item.id);
      setBusyItemIds((current) => { const next = new Set(current); next.delete(item.id); return next; });
    }
  }

  if (!box && !error) return <CustomerFrame><main className="customer-main"><LoadingState label="Opening your box…" /></main></CustomerFrame>;
  if (!box) return <CustomerFrame><main className="customer-main"><Link className="customer-back-link" href="/dashboard">All boxes</Link><div className="customer-alert" role="alert">{error}<button onClick={load}>Try again</button></div></main></CustomerFrame>;

  const items = box.items || [];
  return <CustomerFrame>
    <main className="customer-main customer-box-detail">
      <Link className="customer-back-link" href="/dashboard">All boxes</Link>
      {wasJustAdded && <div className="box-added-notice"><span className="added-check"><CustomerIcon name="check" size={15} /></span><span><strong>Your box is ready.</strong> Add what’s inside, and choose a room anytime.</span></div>}
      <div className="box-detail-heading">
        <div><h1>{boxNumber(box)}</h1>{box.name && box.name !== boxNumber(box) && <p className="box-optional-name">{box.name}</p>}</div>
        <div className="box-heading-actions"><button className="customer-button customer-button-quiet" type="button" onClick={() => window.print()}><CustomerIcon name="print" size={16} /> Print box</button><button className="customer-button customer-button-primary" type="submit" form="box-details-form" disabled={saving}>{saving ? "Saving…" : "Save box"}</button></div>
      </div>
      {error && <div className="customer-alert" role="alert">{error}<button onClick={load}>Reload</button></div>}

      <section className="box-destination-section" aria-labelledby="destination-title">
        <div className="box-destination-summary"><div className="box-destination-title-row"><h2 id="destination-title">Room plan</h2><button className="box-rooms-toggle" type="button" aria-expanded={roomsEditorOpen} aria-controls="box-rooms-editor" onClick={() => setRoomsEditorOpen((open) => !open)}>{roomsEditorOpen ? "Done choosing rooms" : roomId || originRoomId ? "Edit rooms" : "Choose rooms"}</button></div><p><span>From</span><strong>{box.originRoom?.name || "Not set"}</strong></p><p><span>To</span><strong>{box.room?.name || "Not set"}</strong></p></div>
        <div className="box-rooms-editor" id="box-rooms-editor" hidden={!roomsEditorOpen}>
        <form className="box-destination-form" onSubmit={saveRooms}>
          <label className="field-label" htmlFor="box-origin-room">Origin room<select id="box-origin-room" value={originRoomId} onChange={(e) => setOriginRoomId(e.target.value)}><option value="">Not set</option>{rooms.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}</select></label>
          <button className="box-add-room-link" type="button" onClick={() => { setRoomCreationFor("origin"); setNewRoomName(""); }} disabled={creatingRoom}>Add origin room</button>
          <label className="field-label" htmlFor="box-destination-room">Destination room<select id="box-destination-room" value={roomId} onChange={(e) => setRoomId(e.target.value)}><option value="">Not set</option>{rooms.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}</select></label>
          <button className="box-add-room-link" type="button" onClick={() => { setRoomCreationFor("destination"); setNewRoomName(""); }} disabled={creatingRoom}>Add destination room</button>
          <div className="box-destination-save"><span role="status">{savingRooms ? "Saving…" : roomMessage}</span><button className="customer-button customer-button-primary" disabled={savingRooms || creatingRoom}>{savingRooms ? "Saving rooms…" : "Save rooms"}</button></div>
        </form>
        {roomCreationFor && <form className="inline-room-form" onSubmit={createRoom}><label htmlFor="inline-new-room">New {roomCreationFor} room</label><Input className="customer-field-input" id="inline-new-room" autoFocus value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="For example, Kitchen" maxLength={60} required /><button className="customer-button customer-button-primary" disabled={creatingRoom || !newRoomName.trim()}>{creatingRoom ? "Adding…" : "Add room"}</button><button className="customer-button customer-button-quiet" type="button" onClick={() => setRoomCreationFor("")}>Cancel</button></form>}
        </div>
      </section>

      <div className="box-detail-grid">
        <section className="box-section box-inventory-section">
          <div className="box-section-heading"><div><h2>Inside this box <span className="heading-count">{items.length}</span></h2></div><p>Add each item on its own.</p></div>
          {items.length === 0 ? <div className="inventory-empty"><span className="customer-empty-icon"><CustomerIcon name="spark" size={21} /></span><p>What are you putting in this box?</p></div> : <table className="inventory-table" aria-label="Box inventory" role="table">
            <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Item</th><th scope="col" role="columnheader">Photo</th><th scope="col" role="columnheader">Quantity</th><th scope="col" role="columnheader">Actions</th></tr></thead>
            <tbody role="rowgroup">{items.map((item) => { const itemPending = busyItemIds.has(item.id); const imageSrc = item.imageUrl || `/api/items/${encodeURIComponent(item.id)}/image`; return <tr key={item.id} role="row" aria-busy={itemPending}>
              <td data-label="Item" role="cell">{editingItem === item.id ? <form className="inventory-edit" onSubmit={(e) => { e.preventDefault(); if (!itemPending) updateItem(item, { name: editValue.trim() }); }}><input value={editValue} onChange={(e) => setEditValue(e.target.value)} aria-label="Edit item name" autoFocus disabled={itemPending} /><button className="item-action item-save" aria-label="Save item name" disabled={itemPending || !editValue.trim()}>{itemPending ? <span className="customer-spinner" /> : <CustomerIcon name="check" size={16} />}</button><button className="item-action" type="button" onClick={() => setEditingItem(null)} aria-label="Cancel editing" disabled={itemPending}><CustomerIcon name="close" size={16} /></button></form> : <span className="inventory-item-name">{item.name}{item.notes && <small>{item.notes}</small>}</span>}</td>
              <td data-label="Photo" role="cell"><div className="inventory-photo-cell">{item.hasImage && <img className="inventory-item-photo" src={imageSrc} alt={`Photo of ${item.name}`} loading="lazy" />}<label className={`item-photo-control${itemPending ? " item-photo-disabled" : ""}`} htmlFor={`item-photo-${item.id}`}><CustomerIcon name="photo" size={16} /><span>{item.hasImage ? "Change photo" : "Add photo"}</span><input id={`item-photo-${item.id}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) saveItemPhoto(item, file).catch((failure) => setError(failure.message || "Photo could not be saved.")); e.target.value = ""; }} disabled={itemPending} /></label>{item.hasImage && <button className="item-photo-remove" type="button" onClick={() => removeItemPhoto(item)} disabled={itemPending}>{itemPending ? "Saving…" : "Remove photo"}</button>}</div></td>
              <td data-label="Quantity" role="cell"><span className="inventory-quantity"><button aria-label={`Remove one ${item.name}`} onClick={() => updateItem(item, { quantity: Math.max(1, (Number(item.quantity) || 1) - 1) })} disabled={itemPending}>−</button><strong>{itemPending ? <span className="customer-spinner" aria-label="Saving item" /> : (item.quantity || 1)}</strong><button aria-label={`Add one ${item.name}`} onClick={() => updateItem(item, { quantity: (Number(item.quantity) || 1) + 1 })} disabled={itemPending}>+</button></span></td>
              <td data-label="Actions" role="cell"><div className="inventory-row-actions"><button className="item-action" onClick={() => { setEditingItem(item.id); setEditValue(item.name); }} aria-label={`Edit ${item.name}`} disabled={itemPending || editingItem === item.id}><CustomerIcon name="edit" size={16} /></button><button className="item-action item-delete" onClick={() => removeItem(item)} aria-label={`Remove ${item.name}`} disabled={itemPending}><CustomerIcon name="trash" size={16} /></button></div></td>
            </tr>; })}</tbody>
          </table>}
          <form className="add-items-form" onSubmit={addItems}>
            <label htmlFor="item-name">Add one item</label>
            <Input className="customer-field-input" id="item-name" value={itemText} onChange={(e) => setItemText(e.target.value)} placeholder="For example, kettle" maxLength={120} required />
            <p className="add-photo-help">Optional photo: JPG, PNG or WebP.</p>
            <div className="add-items-controls"><label>Quantity <Input className="customer-quantity-input" type="number" min="1" max="999" value={itemQty} onChange={(e) => setItemQty(e.target.value)} /></label><label className="add-item-photo-label">Photo (optional)<input ref={addPhotoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setItemPhoto(e.target.files?.[0] || null)} /></label><button className="customer-button customer-button-primary" disabled={itemBusy || !itemText.trim()}><CustomerIcon name="plus" size={16} /> {itemBusy ? "Adding…" : "Add item"}</button></div>
          </form>
        </section>

        <section className="box-section box-properties-section">
          <form id="box-details-form" onSubmit={saveDetails}>
            <div className="box-section-heading"><div><h2>More details</h2></div></div>
            <label className="field-label">Box name <Input className="customer-field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={boxNumber(box)} maxLength={80} /></label>
            <label className="field-label">Packing stage<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="packing">Packing</option><option value="packed">Packed</option><option value="unpacked">Unpacked</option></select></label>
            <label className="field-label">Notes <span className="field-optional">optional</span><Textarea className="customer-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything helpful when you unpack" rows={3} maxLength={1000} /></label>
            <div className="box-flags"><label><input type="checkbox" checked={fragile} onChange={(e) => setFragile(e.target.checked)} /><span>Handle with care</span></label><label><input type="checkbox" checked={openEarly} onChange={(e) => setOpenEarly(e.target.checked)} /><span>Open first</span></label></div>
            <div className="box-save-row"><span role="status">{saving ? "Saving…" : message}</span><button className="customer-button customer-button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save box"}</button></div>
          </form>
          <p className="box-privacy-note">This label stays with this box. You can update its room and contents anytime.</p>
        </section>
      </div>
      <section className="box-print-sheet" aria-label="Printable box list">
        <div className="box-print-brand"><CustomerLogo /></div>
        <h1>{boxNumber(box)}{box.name && box.name !== boxNumber(box) ? ` · ${box.name}` : ""}</h1>
        <dl className="box-print-details">
          <div><dt>Origin</dt><dd>{box.originRoom?.name || "Not set"}</dd></div>
          <div><dt>Destination</dt><dd>{box.room?.name || "Not set"}</dd></div>
          <div><dt>Packing stage</dt><dd>{statusLabels[box.status] || "Packing"}</dd></div>
          {box.fragile && <div><dt>Care</dt><dd>Handle with care</dd></div>}
          {box.openEarly && <div><dt>Open first</dt><dd>Yes</dd></div>}
          {box.notes && <div><dt>Notes</dt><dd>{box.notes}</dd></div>}
        </dl>
        <h2>Inventory</h2>
        <table><thead><tr><th>Item</th><th>Quantity</th></tr></thead><tbody>{items.length ? items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.quantity || 1}</td></tr>) : <tr><td colSpan="2">No inventory added</td></tr>}</tbody></table>
      </section>
    </main>
  </CustomerFrame>;
}
