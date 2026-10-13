import Link from "next/link";
import { formatPrice, imageFor } from "../catalog-tree";
import styles from "./CategoryPage.module.css";

/**
 * A Uline-style category listing page: breadcrumb, title, a row of jump chips,
 * then one grid of product cards per subcategory. Every card links to that
 * product's own page. Server component — no hooks, no client JavaScript.
 */

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

function ProductCard({ product }) {
  const price = formatPrice(product.price);
  return <Link href={`/product/${product.slug}`} className={styles.card}>
    <span className={styles.cardImage}>
      <img src={imageFor(product)} alt="" loading="lazy" />
    </span>
    <span className={styles.cardBody}>
      <span className={styles.cardName}>{product.name}</span>
      {product.size ? <span className={styles.cardSize}>{product.size}</span> : null}
      {price
        ? <span className={styles.cardPrice}>{price}</span>
        : <span className={styles.cardPriceQuiet}>Price coming soon</span>}
    </span>
  </Link>;
}

export default function CategoryPage({ category }) {
  const showChips = category.subcategories.length >= 2;

  return <main className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      <span aria-hidden="true">/</span>
      <Link href="/">Moving Boxes and Supplies</Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{category.label}</span>
    </nav>

    <h1 className={styles.title}>{category.label}</h1>
    <p className={styles.count}>{plural(category.count, "product")}</p>

    {showChips && <nav className={styles.chips} aria-label="Subcategories">
      {category.subcategories.map((subcategory) => <a
        key={subcategory.id}
        href={`#sub-${subcategory.id}`}
        className={styles.chip}
      >
        {subcategory.name}
        <span className={styles.chipCount}>{subcategory.products.length}</span>
      </a>)}
    </nav>}

    {category.subcategories.map((subcategory) => <section
      key={subcategory.id}
      id={`sub-${subcategory.id}`}
      className={styles.section}
    >
      <h2 className={styles.sectionTitle}>
        {subcategory.name}
        <span className={styles.sectionCount}>{plural(subcategory.products.length, "product")}</span>
      </h2>
      <div className={styles.grid}>
        {subcategory.products.map((product) => <ProductCard key={product.slug} product={product} />)}
      </div>
    </section>)}
  </main>;
}
