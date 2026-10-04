"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, boxNumber } from "./api";
import { CustomerFrame, CustomerIcon, EmptyState, LoadingState, PageHeading } from "./CustomerFrame";
import { Card } from "../../../components/ui/card.jsx";
import { Input } from "../../../components/ui/input.jsx";
import { Badge } from "../../../components/ui/badge.jsx";
import LabelScanner from "./LabelScanner";

const statusLabels = { packing: "Packing", packed: "Packed", unpacked: "Unpacked" };

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [boxes, setBoxes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ packed: 0, packing: 0, unpacked: 0, items: 0 });
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [roomId, setRoomId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingRoom, setAddingRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomError, setRoomError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const searchRef = useRef(null);

  const load = useCallback(async () => {
    setError(""); setLoading(true); setPage(1);
    try {
      const params = new URLSearchParams();
      params.set("page", "1"); params.set("pageSize", "50");
      if (query.trim()) params.set("query", query.trim());
      if (roomId) params.set("roomId", roomId);
      if (status) params.set("status", status);
      const [boxData, roomData] = await Promise.all([
        api(`/api/boxes${params.size ? `?${params}` : ""}`, { cache: "no-store" }),
        api("/api/rooms", { cache: "no-store" }),
      ]);
      setBoxes(Array.isArray(boxData.boxes) ? boxData.boxes : []);
      setTotal(Number(boxData.total ?? boxData.boxes?.length ?? 0));
      setSummary(boxData.summary || { packed: 0, packing: 0, unpacked: 0, items: 0 });
      setRooms(Array.isArray(roomData.rooms) ? roomData.rooms : []);
    } catch (e) {
      if (e.status === 401) router.replace("/login");
      else setError(e.message || "We could not load your boxes.");
    } finally { setLoading(false); }
  }, [query, roomId, status, router]);

  useEffect(() => {
    let active = true;
    api("/api/auth/session", { cache: "no-store" }).then((data) => {
      if (!active) return;
      if (!data.user) { router.replace("/login"); return; }
      setUser(data.user);
    }).catch(() => router.replace("/login"));
    return () => { active = false; };
  }, [router]);

  useEffect(() => { if (user) load(); }, [user, load]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("addRoom") === "1") setAddingRoom(true);
    const onShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchText), 220);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const loadMore = async () => {
    if (loadingMore || boxes.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: "50" });
      if (query.trim()) params.set("query", query.trim());
      if (roomId) params.set("roomId", roomId);
      if (status) params.set("status", status);
      const data = await api(`/api/boxes?${params}`, { cache: "no-store" });
      setBoxes((current) => [...current, ...(data.boxes || [])]);
      setPage(nextPage);
    } catch (e) { setError(e.message || "More boxes could not be loaded."); }
    finally { setLoadingMore(false); }
  };

  async function createRoom(event) {
    event.preventDefault(); setRoomError("");
    try {
      const { room } = await api("/api/rooms", { method: "POST", body: JSON.stringify({ name: roomName.trim() }) });
      if (room) setRooms((old) => [...old, room]);
      setRoomName(""); setAddingRoom(false);
    } catch (e) { setRoomError(e.message || "Room could not be added."); }
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST", body: "{}" }); } finally { router.replace("/login"); }
  }

  const anyFilter = Boolean(query || roomId || status);
  return <CustomerFrame>
    <main className="customer-main">
      <PageHeading eyebrow="YOUR MOVING SPACE" title="My boxes" description="Find what you packed and know where it belongs." action={<button className="customer-button customer-button-quiet" onClick={logout}><CustomerIcon name="logout" size={16} /> Log out</button>} />

      <section className="customer-overview" aria-label="Move summary">
        <Card className="overview-stat"><span>Boxes found</span><strong>{loading ? "—" : total}</strong></Card>
        <Card className="overview-stat"><span>Packed</span><strong>{loading ? "—" : summary.packed}</strong></Card>
        <Card className="overview-stat"><span>Items listed</span><strong>{loading ? "—" : summary.items}</strong></Card>
        <button className="scan-prompt" onClick={() => setScannerOpen(true)} aria-label="Scan a new box label">
          <span className="scan-prompt-icon"><CustomerIcon name="scan" size={20} /></span><span><strong>Add a box</strong><small>Scratch a label, then scan it with your phone camera</small></span><span className="scan-prompt-arrow">↗</span>
        </button>
      </section>

      <section className="customer-toolbar" aria-label="Find and filter boxes">
        <label className="customer-search"><CustomerIcon name="search" size={19} /><Input ref={searchRef} className="customer-search-input" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search an item, like kettle" aria-label="Search boxes and contents" /><kbd>⌘ K</kbd></label>
        <div className="customer-filters">
          <label className="filter-select"><span className="sr-only">Filter by room</span><select value={roomId} onChange={(e) => setRoomId(e.target.value)}><option value="">All rooms</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
          <label className="filter-select"><span className="sr-only">Filter by status</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All stages</option><option value="packing">Packing</option><option value="packed">Packed</option><option value="unpacked">Unpacked</option></select></label>
          {rooms.length === 0 && <button className="customer-text-link" onClick={() => setAddingRoom(true)}>Add a room</button>}
          {rooms.length > 0 && <button className="icon-text-button" onClick={() => setAddingRoom((value) => !value)}><CustomerIcon name="plus" size={16} /> Room</button>}
        </div>
      </section>

      {addingRoom && <form className="add-room-form" onSubmit={createRoom}>
        <label htmlFor="new-room">Give your room a name</label><Input className="customer-field-input" id="new-room" autoFocus value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Kitchen, bedroom, garage…" maxLength={60} required />
        <button className="customer-button customer-button-primary" disabled={!roomName.trim()}>Add room</button><button className="customer-button customer-button-quiet" type="button" onClick={() => { setAddingRoom(false); setRoomError(""); }}>Cancel</button>
        {roomError && <span className="customer-inline-error" role="alert">{roomError}</span>}
      </form>}

      <div className="box-list-heading"><div><span className="customer-eyebrow">YOUR INVENTORY</span><h2>{anyFilter ? "Search results" : "All boxes"}</h2></div><span className="box-result-count">{loading ? "Loading…" : `${total} ${total === 1 ? "box" : "boxes"}`}</span></div>
      {error && <div className="customer-alert" role="alert">{error} <button onClick={load}>Try again</button></div>}
      {loading ? <LoadingState /> : boxes.length === 0 ? <EmptyState title={anyFilter ? "Nothing found yet" : "Your first box is one scan away"} description={anyFilter ? "Try another word or clear a filter." : "Scratch the cover from a Save On Boxes label, then scan its QR code while signed in. We’ll add the box for you."} action={anyFilter ? <button className="customer-button customer-button-quiet" onClick={() => { setSearchText(""); setQuery(""); setRoomId(""); setStatus(""); }}>Clear search</button> : <button className="customer-button customer-button-primary" onClick={() => setScannerOpen(true)}>Scan a label <span aria-hidden="true">↗</span></button>} /> : <div className="box-list">
        {boxes.map((box) => <Link className="box-row" key={box.id} href={`/dashboard/boxes/${encodeURIComponent(box.id)}`}>
          <span className="box-row-number"><CustomerIcon name="box" size={21} /></span>
          <span className="box-row-main"><strong>{boxNumber(box)}{box.name ? ` · ${box.name}` : ""}</strong><span>{box.room?.name || "Room not set"}{box.itemCount ? ` · ${box.itemCount} ${box.itemCount === 1 ? "item" : "items"}` : " · Add contents"}</span>
            {query && box.matchingItems?.length > 0 && <span className="box-match">Found: {box.matchingItems.slice(0, 3).map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`).join(" · ")}</span>}
          </span>
          <Badge variant={box.status === "packed" ? "success" : box.status === "unpacked" ? "muted" : "warning"} className={`status-pill status-${box.status || "packing"}`}>{statusLabels[box.status] || "Packing"}</Badge>
          <span className="box-row-arrow"><CustomerIcon name="arrow" size={18} /></span>
        </Link>)}
      </div>}
      {!loading && boxes.length > 0 && boxes.length < total && <div className="load-more-row"><button className="customer-button customer-button-quiet" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading more…" : `Load more boxes (${total - boxes.length} left)`}<span aria-hidden="true">↓</span></button></div>}
      <p className="customer-hint"><CustomerIcon name="spark" size={15} /> Tip: your room is where each box should go when you unpack.</p>
      {scannerOpen && <LabelScanner onClose={() => setScannerOpen(false)} onToken={(token) => { setScannerOpen(false); router.push(`/q/${encodeURIComponent(token)}?source=camera`); }} />}
    </main>
  </CustomerFrame>;
}
