"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, boxDisplayName, boxStickerSerial, defaultBoxName } from "./api";
import { CustomerFrame, CustomerIcon, CustomerLogo, LoadingState } from "./CustomerFrame";
import { Input } from "../../../components/ui/input.jsx";
import { Textarea } from "../../../components/ui/textarea.jsx";

const statusLabels = { packing: "Packing", packed: "Packed", unpacked: "Unpacked" };

function newMutationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function withTimeout(promise, milliseconds, message, code) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      const error = new Error(message);
      if (code) error.code = code;
      reject(error);
    }, milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

async function decodePhotoWithImage(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  const pendingImage = new Promise((resolve, reject) => {
    image.onload = () => resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) });
    image.onerror = () => reject(new Error("This browser could not open the photo. Choose a JPG, PNG or WebP image."));
    image.src = url;
  });
  try { return await withTimeout(pendingImage, 12_000, "This photo took too long to open. Choose a smaller photo or try again.", "PHOTO_DECODE_TIMEOUT"); }
  catch (error) { URL.revokeObjectURL(url); image.onload = null; image.onerror = null; throw error; }
}

async function decodePhoto(file) {
  if (typeof createImageBitmap === "function") {
    let pendingBitmap;
    try {
      pendingBitmap = createImageBitmap(file);
      const bitmap = await withTimeout(pendingBitmap, 12_000, "This photo took too long to open. Choose a smaller photo or try again.", "PHOTO_DECODE_TIMEOUT");
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close?.() };
    } catch (error) {
      pendingBitmap?.then((bitmap) => bitmap.close?.()).catch(() => {});
      if (error.code === "PHOTO_DECODE_TIMEOUT") throw error;
      // Some mobile browsers expose createImageBitmap but decode a camera format
      // only through HTMLImageElement. Try that bounded path before giving up.
    }
  }
  return decodePhotoWithImage(file);
}

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
  const [itemAddMessage, setItemAddMessage] = useState("");
  const [itemRetryRequired, setItemRetryRequired] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [wasJustAdded, setWasJustAdded] = useState(false);
  const addGalleryInput = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("idle");
  const [cameraMessage, setCameraMessage] = useState("");
  const [cameraStream, setCameraStream] = useState(null);
  const cameraVideo = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraTarget = useRef(null);
  const cameraRequest = useRef(0);
  const addAttemptInFlight = useRef(false);
  const pendingAddRequest = useRef(null);
  const pendingItemMutations = useRef(new Set());
  const [busyItemIds, setBusyItemIds] = useState(() => new Set());

  useEffect(() => { setWasJustAdded(new URLSearchParams(window.location.search).get("added") === "1"); }, []);

  useEffect(() => {
    const video = cameraVideo.current;
    if (!video || !cameraStream) return;
    video.srcObject = cameraStream;
    video.play().catch(() => {
      setCameraStatus("error");
      setCameraMessage("The camera opened, but its preview could not start. Close this and try again.");
    });
    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [cameraStream]);

  useEffect(() => () => {
    cameraRequest.current += 1;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

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
      setName(boxDisplayName(next)); setRoomId(next.roomId || ""); setOriginRoomId(next.originRoomId || ""); setStatus(next.status || "packing"); setNotes(next.notes || ""); setFragile(Boolean(next.fragile)); setOpenEarly(Boolean(next.openEarly));
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
      const response = await api(`/api/boxes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() || null, roomId: roomId || null, originRoomId: originRoomId || null, status, notes: notes.trim() || null, fragile, openEarly }) });
      mergeBoxMetadata(response.box);
      setName(boxDisplayName(response.box || { ...box, name: name.trim() || null }));
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

  function clearAddFields() {
    setItemText(""); setItemQty("1"); setItemPhoto(null);
    if (addGalleryInput.current) addGalleryInput.current.value = "";
  }

  function closeCamera() {
    cameraRequest.current += 1;
    cameraTarget.current = null;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraOpen(false);
    setCameraStatus("idle");
    setCameraMessage("");
  }

  async function openCamera(target) {
    const requestId = cameraRequest.current + 1;
    cameraRequest.current = requestId;
    cameraTarget.current = target;
    setCameraMessage("");
    setCameraOpen(true);
    setCameraStatus("starting");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("error");
      setCameraMessage("Camera access is unavailable here. Open SaveOnBoxes over HTTPS or choose a photo instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1600 }, height: { ideal: 1200 } },
      });
      if (cameraRequest.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      setCameraStream(stream);
    } catch (failure) {
      if (cameraRequest.current !== requestId) return;
      setCameraStatus("error");
      setCameraMessage(failure?.name === "NotAllowedError" || failure?.name === "SecurityError"
        ? "Allow camera access for this site in Chrome’s settings, then try again. Camera capture needs HTTPS."
        : failure?.name === "NotFoundError"
          ? "No camera was found on this device. Choose a photo instead."
          : failure?.name === "NotReadableError"
            ? "The camera is being used by another app. Close it and try again."
            : "The camera could not start. Try again or choose a photo instead.");
    }
  }

  async function captureCameraPhoto() {
    const video = cameraVideo.current;
    if (!video || video.videoWidth < 1 || video.videoHeight < 1 || cameraStatus !== "ready") return;
    setCameraStatus("capturing");
    const target = cameraTarget.current;
    try {
      const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("This browser could not prepare the photo. Choose a photo instead.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await withTimeout(new Promise((resolve, reject) => {
        canvas.toBlob((photo) => photo ? resolve(photo) : reject(new Error("This browser could not capture the photo. Try again.")), "image/jpeg", 0.9);
      }), 10_000, "Photo capture took too long. Try again.");
      const photo = new File([blob], `box-item-${Date.now()}.jpg`, { type: "image/jpeg" });
      closeCamera();
      if (target?.kind === "new") setItemPhoto(photo);
      else if (target?.kind === "item") {
        try { await saveItemPhoto(target.item, photo); }
        catch (failure) { setError(failure.message || "Photo could not be saved."); }
      }
    } catch (failure) {
      setCameraStatus("ready");
      setCameraMessage(failure.message || "Photo capture failed. Try again.");
    }
  }

  function clearMutationIfChanged(nextName = itemText, nextQuantity = itemQty) {
    const pending = pendingAddRequest.current;
    if (!pending) return;
    const quantity = Math.min(999, Math.max(1, Number(nextQuantity) || 1));
    if (pending.name !== nextName.trim() || pending.quantity !== quantity) {
      pendingAddRequest.current = null;
      setItemRetryRequired(false);
      setItemAddMessage("");
    }
  }

  async function addItems(event) {
    event.preventDefault();
    if (!itemRetryRequired) await submitItemAdd(false);
  }

  async function retryAddItem() {
    if (itemRetryRequired) await submitItemAdd(true);
  }

  async function submitItemAdd(isExplicitRetry) {
    if (addAttemptInFlight.current || (itemRetryRequired && !isExplicitRetry)) return;
    const itemName = itemText.trim();
    if (!itemName) return;
    const quantity = Math.min(999, Math.max(1, Number(itemQty) || 1));
    let pending = pendingAddRequest.current;
    if (!pending || pending.name !== itemName || pending.quantity !== quantity) {
      pending = { id: newMutationId(), name: itemName, quantity };
      pendingAddRequest.current = pending;
    }

    addAttemptInFlight.current = true;
    setItemBusy(true); setError(""); setItemAddMessage("");
    let postStarted = false;
    try {
      const preparedPhoto = itemPhoto ? await prepareItemPhoto(itemPhoto) : null;
      postStarted = true;
      const response = await api(`/api/boxes/${encodeURIComponent(id)}/items`, {
        method: "POST",
        timeoutMs: 20_000,
        body: JSON.stringify({ name: itemName, quantity, clientMutationId: pending.id }),
      });
      if (!response.item) throw new Error("The item could not be added.");
      const item = response.item;
      pendingAddRequest.current = null;
      setItemRetryRequired(false);
      setBox((current) => {
        if (!current) return current;
        const currentItems = current.items || [];
        return currentItems.some((entry) => entry.id === item.id)
          ? { ...current, items: currentItems.map((entry) => entry.id === item.id ? { ...entry, ...item } : entry) }
          : { ...current, items: [...currentItems, item] };
      });
      clearAddFields();
      if (preparedPhoto) {
        try { await saveItemPhoto(item, preparedPhoto, true); }
        catch { setItemAddMessage("Item added. Its photo was not saved; choose Take photo or Choose photo on that item to retry."); }
      }
    } catch (e) {
      const uncertain = postStarted && (e.timedOut || !e.status || e.status >= 500);
      if (uncertain) {
        setItemRetryRequired(true);
        setItemAddMessage("We could not confirm whether the item was saved. It is safe to retry, and we will prevent duplicates.");
      } else {
        if (postStarted) pendingAddRequest.current = null;
        setItemRetryRequired(false);
        setItemAddMessage(e.message || "We could not add this item. Your entry is still here; try again.");
      }
    } finally {
      addAttemptInFlight.current = false;
      setItemBusy(false);
    }
  }

  async function prepareItemPhoto(file) {
    const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const convertibleBrowserTypes = new Set(["image/heic", "image/heif", "image/avif", "image/gif", "image/bmp"]);
    const fileType = (file.type || "").toLowerCase();
    const extensionLooksLikePhoto = /\.(jpe?g|png|webp|heic|heif|avif|gif|bmp)$/i.test(file.name || "");
    if (!supportedTypes.has(fileType) && !convertibleBrowserTypes.has(fileType) && !((!fileType || fileType.startsWith("image/")) && extensionLooksLikePhoto)) {
      throw new Error("Choose a JPG, PNG or WebP photo. Your phone camera format can be converted if this browser supports it.");
    }
    if (file.size > 25 * 1024 * 1024) throw new Error("That photo is very large. Choose one under 25 MB.");

    let decoded;
    try { decoded = await decodePhoto(file); }
    catch (error) { throw new Error(error.message || "This photo could not be opened. Choose a JPG, PNG or WebP image."); }
    try {
      if (!decoded.width || !decoded.height || decoded.width * decoded.height > 30_000_000) {
        throw new Error("That image is too large to process. Choose a smaller photo.");
      }
      const scale = Math.min(1, 1600 / Math.max(decoded.width, decoded.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("This browser could not prepare the photo. Try again with another image.");
      context.fillStyle = "#FFFFFF"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

      for (const mimeType of ["image/webp", "image/jpeg"]) {
        for (const quality of [0.82, 0.68, 0.54, 0.4]) {
          const blob = await withTimeout(new Promise((resolve, reject) => {
            canvas.toBlob((encoded) => encoded ? resolve(encoded) : reject(new Error("This browser could not compress the photo. Choose another image.")), mimeType, quality);
          }), 10_000, "Photo preparation took too long. Choose a smaller photo or try again.");
          if (blob.size <= 3_500_000) {
            const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/png" ? "png" : "webp";
            return new File([blob], `box-item.${extension}`, { type: blob.type });
          }
        }
      }
      throw new Error("This photo is still too large after compression. Choose a smaller image.");
    } finally { decoded.release(); }
  }

  async function saveItemPhoto(item, file, alreadyPrepared = false) {
    if (pendingItemMutations.current.has(item.id)) throw new Error("Wait for the current item change to finish.");
    pendingItemMutations.current.add(item.id);
    setBusyItemIds((current) => new Set(current).add(item.id));
    try {
      const preparedPhoto = alreadyPrepared ? file : await prepareItemPhoto(file);
      const form = new FormData();
      form.append("image", preparedPhoto);
      const result = await api(`/api/items/${encodeURIComponent(item.id)}/image`, { method: "POST", timeoutMs: 30_000, body: form });
      const baseImageUrl = result.imageUrl || `/api/items/${encodeURIComponent(item.id)}/image`;
      const imageUrl = `${baseImageUrl}${baseImageUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
      setBox((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, hasImage: true, imageUrl } : entry) }));
    } finally {
      pendingItemMutations.current.delete(item.id);
      setBusyItemIds((current) => { const next = new Set(current); next.delete(item.id); return next; });
    }
  }

  function chooseAddPhoto(event) {
    const file = event.target.files?.[0] || null;
    if (file) setItemPhoto(file);
    event.target.value = "";
  }

  function chooseItemPhoto(event, item) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) saveItemPhoto(item, file).catch((failure) => setError(failure.message || "Photo could not be saved."));
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
  const displayName = boxDisplayName(box);
  const stickerSerial = boxStickerSerial(box);
  const defaultName = defaultBoxName(box);
  return <CustomerFrame>
    <main className="customer-main customer-box-detail">
      <Link className="customer-back-link" href="/dashboard">All boxes</Link>
      {wasJustAdded && <div className="box-added-notice"><span className="added-check"><CustomerIcon name="check" size={15} /></span><span><strong>Your box is ready.</strong> Add what’s inside, and choose a room anytime.</span></div>}
      <div className="box-detail-heading">
        <div><h1>{displayName}</h1>{stickerSerial && <p className="box-sticker-serial">Label serial {stickerSerial}</p>}</div>
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
              <td data-label="Photo" role="cell"><div className="inventory-photo-cell">{item.hasImage && <img className="inventory-item-photo" src={imageSrc} alt={`Photo of ${item.name}`} loading="lazy" />}<div className="inventory-photo-actions"><button className={`item-photo-control${itemPending ? " item-photo-disabled" : ""}`} type="button" onClick={() => openCamera({ kind: "item", item })} disabled={itemPending}><CustomerIcon name="photo" size={16} /><span>Take photo</span></button><label className={`item-photo-control${itemPending ? " item-photo-disabled" : ""}`} htmlFor={`item-photo-gallery-${item.id}`}><CustomerIcon name="photo" size={16} /><span>Choose photo</span><input id={`item-photo-gallery-${item.id}`} type="file" accept="image/*" onChange={(e) => chooseItemPhoto(e, item)} disabled={itemPending} /></label>{item.hasImage && <button className="item-photo-remove" type="button" onClick={() => removeItemPhoto(item)} disabled={itemPending}>{itemPending ? "Saving…" : "Remove photo"}</button>}</div></div></td>
              <td data-label="Quantity" role="cell"><span className="inventory-quantity"><button aria-label={`Remove one ${item.name}`} onClick={() => updateItem(item, { quantity: Math.max(1, (Number(item.quantity) || 1) - 1) })} disabled={itemPending}>−</button><strong>{itemPending ? <span className="customer-spinner" aria-label="Saving item" /> : (item.quantity || 1)}</strong><button aria-label={`Add one ${item.name}`} onClick={() => updateItem(item, { quantity: (Number(item.quantity) || 1) + 1 })} disabled={itemPending}>+</button></span></td>
              <td data-label="Actions" role="cell"><div className="inventory-row-actions"><button className="item-action" onClick={() => { setEditingItem(item.id); setEditValue(item.name); }} aria-label={`Edit ${item.name}`} disabled={itemPending || editingItem === item.id}><CustomerIcon name="edit" size={16} /></button><button className="item-action item-delete" onClick={() => removeItem(item)} aria-label={`Remove ${item.name}`} disabled={itemPending}><CustomerIcon name="trash" size={16} /></button></div></td>
            </tr>; })}</tbody>
          </table>}
          <form className="add-items-form" onSubmit={addItems} aria-busy={itemBusy}>
            <label htmlFor="item-name">Add one item</label>
            <Input className="customer-field-input" id="item-name" value={itemText} onChange={(e) => { clearMutationIfChanged(e.target.value, itemQty); setItemText(e.target.value); }} placeholder="For example, kettle" maxLength={120} required disabled={itemBusy} />
            <p className="add-photo-help">Optional photo. We’ll resize it for you.</p>
            {itemAddMessage && <div className={`add-item-message${itemRetryRequired ? " add-item-message-warning" : ""}`} role={itemRetryRequired ? "alert" : "status"}><p>{itemAddMessage}</p>{itemRetryRequired && <button className="customer-button customer-button-quiet" type="button" onClick={retryAddItem} disabled={itemBusy}>{itemBusy ? "Retrying…" : "Retry add"}</button>}</div>}
            <div className="add-items-controls">
              <label>Quantity <Input className="customer-quantity-input" type="number" min="1" max="999" value={itemQty} onChange={(e) => { clearMutationIfChanged(itemText, e.target.value); setItemQty(e.target.value); }} disabled={itemBusy} /></label>
              <div className="add-item-photo-picker"><span>Optional photo</span><div className="add-item-photo-actions">
                <button className={`item-photo-control${itemBusy ? " item-photo-disabled" : ""}`} type="button" onClick={() => openCamera({ kind: "new" })} disabled={itemBusy}><CustomerIcon name="photo" size={16} /><span>Take photo</span></button>
                <label className={`item-photo-control${itemBusy ? " item-photo-disabled" : ""}`} htmlFor="new-item-gallery"><CustomerIcon name="photo" size={16} /><span>Choose photo</span><input ref={addGalleryInput} id="new-item-gallery" type="file" accept="image/*" onChange={chooseAddPhoto} disabled={itemBusy} /></label>
                {itemPhoto && <><span className="add-photo-selected" title={itemPhoto.name}>{itemPhoto.name}</span><button className="item-photo-remove" type="button" onClick={() => setItemPhoto(null)} disabled={itemBusy}>Clear photo</button></>}
              </div></div>
              <button className="customer-button customer-button-primary" disabled={itemBusy || itemRetryRequired || !itemText.trim()}><CustomerIcon name="plus" size={16} /> {itemBusy ? "Adding…" : itemRetryRequired ? "Check retry below" : "Add item"}</button>
            </div>
          </form>
        </section>

        <section className="box-section box-properties-section">
          <form id="box-details-form" onSubmit={saveDetails}>
            <div className="box-section-heading"><div><h2>More details</h2></div></div>
            <label className="field-label">Box name <Input className="customer-field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName} maxLength={80} /></label>
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
        <h1>{displayName}</h1>
        {stickerSerial && <p className="box-print-serial">Label serial {stickerSerial}</p>}
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
    {cameraOpen && <div className="customer-modal-backdrop" onClick={closeCamera}>
      <section className="customer-scan-help item-camera-dialog" role="dialog" aria-modal="true" aria-labelledby="item-camera-title" onClick={(event) => event.stopPropagation()}>
        <button className="customer-modal-close" type="button" aria-label="Close camera" autoFocus onClick={closeCamera}><CustomerIcon name="close" /></button>
        <span className="scan-help-icon"><CustomerIcon name="photo" size={21} /></span>
        <h2 id="item-camera-title">Take a photo</h2>
        <p>{cameraTarget.current?.kind === "item" ? `Take a clear photo of ${cameraTarget.current.item.name}.` : "Take a clear photo of this item before you add it."}</p>
        <div className="item-camera-preview">
          <video ref={cameraVideo} muted playsInline autoPlay aria-label="Live camera preview" onCanPlay={() => { setCameraStatus("ready"); setCameraMessage(""); }} />
          {cameraStatus !== "ready" && cameraStatus !== "capturing" && <div className="item-camera-placeholder"><CustomerIcon name="photo" size={28} /><span>{cameraStatus === "starting" ? "Starting camera…" : "Camera preview unavailable"}</span></div>}
        </div>
        {cameraMessage && <p className="item-camera-message" role="alert">{cameraMessage}</p>}
        <div className="item-camera-actions">
          <button className="customer-button customer-button-quiet" type="button" onClick={closeCamera}>Cancel</button>
          <button className="customer-button customer-button-primary" type="button" onClick={captureCameraPhoto} disabled={cameraStatus !== "ready"}>{cameraStatus === "capturing" ? "Capturing…" : "Use photo"}</button>
        </div>
        <p className="item-camera-note">The photo is resized and attached to this item.</p>
      </section>
    </div>}
  </CustomerFrame>;
}
