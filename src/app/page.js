"use client";


import Link from "next/link";
import { getHomeBoxSections, kits, movingCategories, supplies } from "./catalog";
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

function MovingBoxesAndSupplies() {
  return <section className="category-section" aria-labelledby="category-section-title">
    <div className="category-section-heading"><h2 id="category-section-title">Moving Boxes and Supplies</h2></div>
    <div className="category-grid">
      {movingCategories.map((category) => <Link key={category.id} href={category.href} className={`category-card${category.featured ? " is-featured" : ""}`}>
        <span className="category-card-image"><img src={`/categories/${category.image}`} alt="" loading="lazy" /></span>
        <span className="category-card-label">{category.label}</span>
      </Link>)}
    </div>
  </section>;
}

export default function HomePage() {
  const visibleSections = getHomeBoxSections(null);
  const visibleProductCount = visibleSections.reduce((count, section) => count + section.products.length, 0);
  return <main id="home">
    <BrandHero />
    <MovingBoxesAndSupplies />
    <section className="catalogue room-results" id="room-products" aria-label="All moving boxes">
      <div className="room-results-toolbar">
        <p>All moving boxes <span>· {visibleProductCount} products</span></p>
      </div>
      {visibleSections.map((section) => <ProductSection key={section.id} id={`room-product-${section.id}`} title={section.title} products={section.products} carousel />)}
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
