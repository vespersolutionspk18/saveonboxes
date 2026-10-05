"use client";

import { useState } from "react";
import { getHomeBoxSections, kits, rooms, supplies } from "./catalog";
import { Icon, ProductSection } from "./components/Storefront";

function BrandHero() {
  return <section className="brand-hero" aria-labelledby="hero-title">
      <div className="hero-copy">
      <div className="hero-eyebrow"><span><Icon name="package" size={19} /></span>Your Reliable Boxes &amp; Supplies Partner</div>
      <h1 id="hero-title">Pack Smarter.<br />Stack it. Tape it.<br />Ship it with<br /><span className="hero-brand-line"><span>Save On Boxes</span><i>.</i></span></h1>
      <div className="hero-underline" aria-hidden="true" />
      <p>Strong, stackable moving boxes and every packing supply you need — delivered to your door. Pick your sizes, build your kit, and we will have it ready when you are.</p>
    </div>
    <div className="hero-art" aria-hidden="true">
      <span className="hero-orange-disc" />
      <span className="hero-gold-disc" />
      <span className="hero-spark hero-spark-one">✦</span>
      <span className="hero-spark hero-spark-two">✦</span>
      <img src="/assets/herocutout.webp" alt="" fetchPriority="high" />
    </div>
  </section>;
}

function RoomTiles({ selectedRoom, onSelect }) {
  return <section className="room-section" aria-labelledby="room-section-title">
    <div className="room-section-heading">
      <div><span className="eyebrow-label">Shop by room</span><h2 id="room-section-title">Pack room by room</h2></div>
      <p>Choose a room to see the boxes that fit.</p>
    </div>
    <div className="room-grid">
      {rooms.filter((room) => room.id !== "nursery").map((room) => <button key={room.id} className={`room-card${selectedRoom === room.id ? " is-selected" : ""}`} onClick={() => onSelect(room.id)} aria-pressed={selectedRoom === room.id} aria-controls="room-products">
        <span className="room-card-image"><img src={`/boxes/${encodeURIComponent(room.image)}`} alt="" loading="lazy" /></span>
        <span className="room-card-title">{room.tile}</span>
      </button>)}
    </div>
  </section>;
}

export default function HomePage() {
  const [activeRoom, setActiveRoom] = useState(null);
  const selectedRoom = rooms.find((room) => room.id === activeRoom);
  const visibleSections = getHomeBoxSections(activeRoom);
  const visibleProductCount = visibleSections.reduce((count, section) => count + section.products.length, 0);
  const chooseRoom = (roomId) => {
    setActiveRoom(roomId);
    requestAnimationFrame(() => document.getElementById("room-products")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  return <main id="home">
    <BrandHero />
    <RoomTiles selectedRoom={activeRoom} onSelect={chooseRoom} />
    <section className="catalogue room-results" id="room-products" aria-label="Boxes for the selected room" data-room={activeRoom || "all"}>
      <div className="room-results-toolbar">
        <p role="status" aria-live="polite">{selectedRoom ? selectedRoom.title : "All moving boxes"} <span>· {visibleProductCount} products</span></p>
        {activeRoom && <button onClick={() => setActiveRoom(null)}>View all boxes</button>}
      </div>
      {visibleSections.map((section) => <ProductSection key={`${activeRoom || "all"}-${section.id}`} id={`room-product-${section.id}`} title={section.title} products={section.products} carousel />)}
    </section>
    <section className="kit-section" id="kits">
      <div className="catalogue-intro kit-intro"><div><span className="eyebrow-label">Box-only bundles</span><h2>Moving kits, made simple</h2></div><p>Standard box quantities for each home size. Add specialty boxes only for the things you own.</p></div>
      <div className="catalogue kit-catalogue"><ProductSection id="kit-row" title="Moving Kits:" icon="box" products={kits} carousel /></div>
    </section>
    <section className="catalogue supplies-section" id="extras">
      <div className="catalogue-intro"><div><span className="eyebrow-label">Packing supplies</span><h2>Tape, tools &amp; protection</h2></div><p>Everything you need to seal, label and protect your belongings through moving day.</p></div>
      <ProductSection id="supply-row" title="Packing Supplies & Extras:" products={supplies.filter((product) => !product.isSupplierCatalog)} carousel />
    </section>
  </main>;
}
