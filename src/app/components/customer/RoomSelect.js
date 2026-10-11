"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CustomerIcon } from "./CustomerFrame";

// Inline room picker. Clicking the trigger opens a dropdown that lists the
// account's rooms and lets the customer add a new one by typing in the same
// box, no separate form or page.
export default function RoomSelect({ label, value, rooms, disabled = false, onSelect, onCreate }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const current = useMemo(() => rooms.find((room) => room.id === value) || null, [rooms, value]);
  const trimmed = text.trim();
  const needle = trimmed.toLowerCase();
  const filtered = useMemo(() => needle ? rooms.filter((room) => room.name.toLowerCase().includes(needle)) : rooms, [rooms, needle]);
  const exactMatch = useMemo(() => rooms.find((room) => room.name.toLowerCase() === needle) || null, [rooms, needle]);
  const canCreate = trimmed.length > 0 && !exactMatch;
  const isBusy = working || disabled;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setError("");
      const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
    setText("");
    setError("");
  }, [open]);

  async function choose(roomId) {
    if (isBusy) return;
    if ((roomId || "") === (value || "")) {
      setOpen(false);
      return;
    }
    setWorking(true);
    setError("");
    try {
      await onSelect(roomId || null);
      setOpen(false);
    } catch (failure) {
      setError(failure?.message || "That room could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  async function create() {
    if (isBusy || !canCreate) return;
    setWorking(true);
    setError("");
    try {
      await onCreate(trimmed);
      setOpen(false);
    } catch (failure) {
      setError(failure?.message || "That room could not be added.");
    } finally {
      setWorking(false);
    }
  }

  function onSearchKeyDown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (canCreate) create();
    else if (exactMatch) choose(exactMatch.id);
    else if (filtered.length === 1) choose(filtered[0].id);
  }

  return <div className="bx-room" ref={rootRef}>
    <span className="bx-room-label">{label}</span>
    <button type="button" className="bx-room-trigger" aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((currentOpen) => !currentOpen)}>
      <span className={current ? "bx-room-value" : "bx-room-value bx-room-value-empty"}>{current ? current.name : "Not set"}</span>
      {working ? <span className="customer-spinner bx-spinner-sm" /> : <CustomerIcon name="chevron" size={16} />}
    </button>
    {open && <div className="bx-room-menu" role="listbox" aria-label={`${label} room`}>
      <input ref={inputRef} className="bx-room-search" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={onSearchKeyDown} placeholder="Type a room name" aria-label={`Search or add a ${label.toLowerCase()} room`} maxLength={60} />
      <div className="bx-room-options">
        <button type="button" role="option" aria-selected={!value} className={`bx-room-option${!value ? " is-selected" : ""}`} onClick={() => choose(null)}>
          <span className="bx-room-none">Not set</span>
          {!value && <CustomerIcon name="check" size={15} />}
        </button>
        {filtered.map((room) => <button type="button" key={room.id} role="option" aria-selected={room.id === value} className={`bx-room-option${room.id === value ? " is-selected" : ""}`} onClick={() => choose(room.id)}>
          <span>{room.name}</span>
          {room.id === value && <CustomerIcon name="check" size={15} />}
        </button>)}
        {canCreate && <button type="button" role="option" aria-selected={false} className="bx-room-create" onClick={create}>
          <CustomerIcon name="plus" size={15} />
          <span>Add “{trimmed}”</span>
        </button>}
        {rooms.length === 0 && !trimmed && <p className="bx-room-hint">No rooms yet. Type a name to add one.</p>}
      </div>
      {error && <p className="bx-room-error" role="alert">{error}</p>}
    </div>}
  </div>;
}
