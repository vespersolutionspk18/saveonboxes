"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, boxDisplayName, boxStickerSerial } from "./api";
import { CustomerFrame, CustomerIcon, EmptyState, LoadingState, PageHeading } from "./CustomerFrame";
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
  const requestGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setError(""); setLoading(true); setLoadingMore(false); setPage(1);
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
      if (generation !== requestGeneration.current) return;
      setBoxes(Array.isArray(boxData.boxes) ? boxData.boxes : []);
      setTotal(Number(boxData.total ?? boxData.boxes?.length ?? 0));
      setSummary(boxData.summary || { packed: 0, packing: 0, unpacked: 0, items: 0 });
      setRooms(Array.isArray(roomData.rooms) ? roomData.rooms : []);
    } catch (e) {
      if (generation !== requestGeneration.current) return;
      if (e.status === 401) router.replace("/login");
      else setError(e.message || "We could not load your boxes.");
    } finally { if (generation === requestGeneration.current) setLoading(false); }
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
    const params = new URLSearchParams(window.location.search);
    if (params.get("addRoom") === "1") setAddingRoom(true);
    if (params.get("scan") === "1") {
      setScannerOpen(true);
      router.replace("/dashboard", { scroll: false });
    }
  }, [router]);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchText), 220);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const loadMore = async () => {
    if (loading || loadingMore || boxes.length >= total) return;
    const nextPage = page + 1;
    const generation = requestGeneration.current;
    setLoadingMore(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: "50" });
      if (query.trim()) params.set("query", query.trim());
      if (roomId) params.set("roomId", roomId);
      if (status) params.set("status", status);
      const data = await api(`/api/boxes?${params}`, { cache: "no-store" });
      if (generation !== requestGeneration.current) return;
      setBoxes((current) => [...current, ...(data.boxes || [])]);
      setPage(nextPage);
    } catch (e) { if (generation === requestGeneration.current) setError(e.message || "More boxes could not be loaded."); }
    finally { if (generation === requestGeneration.current) setLoadingMore(false); }
  };

  async function createRoom(event) {
    event.preventDefault(); setRoomError("");
    try {
      const { room } = await api("/api/rooms", { method: "POST", body: JSON.stringify({ name: roomName.trim() }) });
      if (room) setRooms((old) => [...old, room]);
      setRoomName(""); setAddingRoom(false);
    } catch (e) { setRoomError(e.message || "Room could not be added."); }
  }

  const anyFilter = Boolean(query || roomId || status);
  return <CustomerFrame active={scannerOpen ? "scan" : "boxes"} onScan={() => setScannerOpen(true)}>
    <main className="customer-main">
      <PageHeading title="My boxes" description="Find what you packed and know where it belongs." action={<button className="customer-button customer-button-primary" type="button" onClick={() => setScannerOpen(true)}><CustomerIcon name="scan" size={18} /> Scan label</button>} />

      <section className="customer-toolbar" aria-label="Find and filter boxes">
        <label className="customer-search"><CustomerIcon name="search" size={19} /><Input className="customer-search-input" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search items, name or label serial" aria-label="Search items, box name or label serial" /></label>
        <div className="customer-filters">
          <label className="filter-select"><span className="sr-only">Filter by room</span><select value={roomId} onChange={(e) => setRoomId(e.target.value)}><option value="">All rooms</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
          <label className="filter-select"><span className="sr-only">Filter by stage</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All stages</option><option value="packing">Packing</option><option value="packed">Packed</option><option value="unpacked">Unpacked</option></select></label>
          <button className="icon-text-button" onClick={() => setAddingRoom((value) => !value)}><CustomerIcon name="plus" size={18} /> Add room</button>
        </div>
      </section>

      <section className="customer-overview" aria-label="Move summary">
        <div className="overview-stat"><strong>{loading ? "—" : total}</strong><span>{total === 1 ? "box" : "boxes"}</span></div>
        <div className="overview-stat"><strong>{loading ? "—" : summary.packed}</strong><span>packed</span></div>
        <div className="overview-stat"><strong>{loading ? "—" : summary.items}</strong><span>{summary.items === 1 ? "item listed" : "items listed"}</span></div>
      </section>

      {addingRoom && <form className="add-room-form" onSubmit={createRoom}>
        <label htmlFor="new-room">Give your room a name</label><Input className="customer-field-input" id="new-room" autoFocus value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Kitchen, bedroom, garage…" maxLength={60} required />
        <button className="customer-button customer-button-primary" disabled={!roomName.trim()}>Add room</button><button className="customer-button customer-button-quiet" type="button" onClick={() => { setAddingRoom(false); setRoomError(""); }}>Cancel</button>
        {roomError && <span className="customer-inline-error" role="alert">{roomError}</span>}
      </form>}

      <div className="box-list-heading"><h2>{anyFilter ? "Search results" : "All boxes"}</h2><span className="box-result-count">{loading ? "Loading…" : `${total} ${total === 1 ? "box" : "boxes"}`}</span></div>
      {error && <div className="customer-alert" role="alert">{error} <button onClick={load}>Try again</button></div>}
      {loading ? <LoadingState /> : boxes.length === 0 ? <EmptyState title={anyFilter ? "Nothing found yet" : "Your first box is one scan away"} description={anyFilter ? "Try another word or clear a filter." : "Scratch the cover from a Save On Boxes label, then scan its QR code while signed in. We’ll add the box for you."} action={anyFilter ? <button className="customer-button customer-button-quiet" onClick={() => { setSearchText(""); setQuery(""); setRoomId(""); setStatus(""); }}>Clear search</button> : <button className="customer-button customer-button-primary" onClick={() => setScannerOpen(true)}>Scan a label</button>} /> : <div className="box-list">
        {boxes.map((box) => <Link className="box-row" key={box.id} href={`/dashboard/boxes/${encodeURIComponent(box.id)}`}>
          <span className="box-row-main"><strong className="box-row-name">{boxDisplayName(box)}</strong>{boxStickerSerial(box) && <span className="box-row-serial">Label serial {boxStickerSerial(box)}</span>}<span className="box-row-destination">{box.room?.name || "Room not set"}</span>
            {query && box.matchingItems?.length > 0 ? <span className="box-match">Found: {box.matchingItems.slice(0, 3).map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`).join(" · ")}</span> : <span className="box-row-count">{box.itemCount || 0} {box.itemCount === 1 ? "item" : "items"}</span>}
          </span>
          <Badge variant={box.status === "packed" ? "success" : box.status === "unpacked" ? "muted" : "warning"} className={`status-pill status-${box.status || "packing"}`}>{statusLabels[box.status] || "Packing"}</Badge>
        </Link>)}
      </div>}
      {!loading && boxes.length > 0 && boxes.length < total && <div className="load-more-row"><button className="customer-button customer-button-quiet" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading more…" : `Load more boxes (${total - boxes.length} left)`}</button></div>}
      <p className="customer-hint">Your room is where each box should go when you unpack.</p>
      {scannerOpen && <LabelScanner onClose={() => setScannerOpen(false)} onToken={(token) => { setScannerOpen(false); router.push(`/q/${encodeURIComponent(token)}?source=camera`); }} />}
    </main>
  </CustomerFrame>;
}
