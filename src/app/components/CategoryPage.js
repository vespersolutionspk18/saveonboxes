import Link from "next/link";

/**
 * A Uline-style category page: breadcrumb, title, a featured row of three
 * cards, then four cards to a row. Cards are not links yet — the individual
 * product pages do not exist — except where the card maps onto another
 * category page we already have.
 */
function CategoryCard({ card, base, featured = false }) {
  const inner = <>
    <span className="category-card-image">
      {card.image
        ? <img src={`${base}/${card.image}`} alt="" loading="lazy" />
        : <span className="category-card-placeholder" aria-hidden="true" />}
    </span>
    <span className="category-card-label">{card.name}</span>
  </>;

  const className = `category-card${featured ? " is-featured" : ""}${card.to ? "" : " is-static"}`;
  if (card.to) return <Link href={card.to} className={className}>{inner}</Link>;
  return <div className={className} data-sku={card.sku || undefined}>{inner}</div>;
}

export default function CategoryPage({ page }) {
  const base = `/categories/${page.slug}`;
  const hasFeaturedRow = page.featured.length === 3 && page.items.length >= 4;
  const gridCards = hasFeaturedRow ? page.items : [...page.featured, ...page.items];

  return <main className="category-page" id="category-page">
    <nav className="category-breadcrumb" aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      <span aria-hidden="true">/</span>
      <Link href="/">Moving Boxes and Supplies</Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{page.title}</span>
    </nav>
    <h1 className="category-page-title">{page.title}</h1>

    {hasFeaturedRow && <>
      <div className="category-grid category-grid-featured">
        {page.featured.map((card) => <CategoryCard key={`f-${card.name}`} card={card} base={base} featured />)}
      </div>
      <hr className="category-divider" />
    </>}

    <div className="category-grid">
      {gridCards.map((card) => <CategoryCard key={`${card.sku || ""}-${card.name}`} card={card} base={base} />)}
    </div>
  </main>;
}
