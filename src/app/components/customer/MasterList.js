"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, boxNumber } from "./api";
import { CustomerFrame, CustomerIcon, LoadingState, PageHeading } from "./CustomerFrame";
import { Badge } from "../../../components/ui/badge.jsx";

export default function MasterList() {
  const router = useRouter();
  const [boxes, setBoxes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/boxes/print", { cache: "no-store" }).then((data) => {
      setBoxes(data.boxes || []); setRooms(data.rooms || []);
    }).catch((e) => {
      if (e.status === 401) router.replace(`/login?next=${encodeURIComponent("/dashboard/print")}`);
      else setError(e.message || "Your list could not be loaded.");
    }).finally(() => setLoading(false));
  }, [router]);

  const grouped = useMemo(() => {
    const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
    const groups = new Map();
    for (const box of boxes) {
      const destination = box.room?.name || roomNames.get(box.roomId) || "Room not set";
      if (!groups.has(destination)) groups.set(destination, []);
      groups.get(destination).push(box);
    }
    return [...groups.entries()].sort(([a], [b]) => a === "Room not set" ? 1 : b === "Room not set" ? -1 : a.localeCompare(b)).map(([room, entries]) => [room, entries.sort((a, b) => Number(a.boxNumber) - Number(b.boxNumber))]);
  }, [boxes, rooms]);

  return <CustomerFrame active="print">
    <main className="customer-main master-list-page">
      <Link className="customer-back-link no-print" href="/dashboard"><CustomerIcon name="back" size={16} /> All boxes</Link>
      <PageHeading eyebrow="PRINTABLE MOVE PLAN" title="Master list" description="Every box, its destination and everything packed inside." action={<button className="customer-button customer-button-primary no-print" onClick={() => window.print()}><CustomerIcon name="print" size={16} /> Print this list</button>} />
      {error && <div className="customer-alert no-print" role="alert">{error}<button onClick={() => window.location.reload()}>Try again</button></div>}
      {loading ? <LoadingState label="Putting your list together…" /> : boxes.length === 0 ? <div className="customer-empty"><span className="customer-empty-icon"><CustomerIcon name="box" /></span><h2>No boxes yet</h2><p>When you scan your first label, your master list will appear here.</p><Link className="customer-button customer-button-primary no-print" href="/dashboard">Go to my boxes</Link></div> : <>
        <div className="master-list-meta"><span>{boxes.length} {boxes.length === 1 ? "box" : "boxes"}</span><span>{boxes.reduce((n, box) => n + (box.items?.length || 0), 0)} inventory lines</span><span>Printed {new Date().toLocaleDateString()}</span></div>
        {grouped.map(([room, entries]) => <section className="master-room" key={room}>
          <h2><span className="master-room-dot" />{room}<span className="master-room-count">{entries.length}</span></h2>
          <div className="master-boxes">{entries.map((box) => <article className="master-box" key={box.id}>
            <div className="master-box-heading"><strong>{boxNumber(box)}</strong>{box.name && <span>{box.name}</span>}<Badge variant={box.status === "packed" ? "success" : box.status === "unpacked" ? "muted" : "warning"} className={`status-pill status-${box.status || "packing"}`}>{box.status || "packing"}</Badge></div>
            {(box.fragile || box.openEarly) && <p className="master-flags">{[box.fragile && "Handle with care", box.openEarly && "Open first"].filter(Boolean).join(" · ")}</p>}
            {box.items?.length ? <ul>{box.items.map((item) => <li key={item.id || `${box.id}-${item.name}`}><span>{item.name}</span><span>× {item.quantity || 1}</span></li>)}</ul> : <p className="master-empty-inventory">No inventory added</p>}
            {box.notes && <p className="master-notes">{box.notes}</p>}
          </article>)}</div>
        </section>)}
      </>}
      <p className="master-print-footer">Save On Boxes · Your moving list</p>
    </main>
  </CustomerFrame>;
}
