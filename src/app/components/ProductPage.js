import Link from "next/link";
import {
  formatPrice,
  getCategoryTree,
  imageFor,
  productSpecs,
  relatedProducts,
  subcategoryName,
} from "../catalog-tree";
import ProductBuyPanel from "./ProductBuyPanel";
import styles from "./ProductPage.module.css";

/**
 * A single product, presented as a plain two-column page: image and facts at the
 * top, then a spec table, the supplier description, and a short row of siblings
 * from the same subcategory. No tabs, no carousels, no reviews.
 */
export default function ProductPage({ product }) {
  const category = getCategoryTree(product.ulineCategorySlug);
  const categoryLabel = category?.label || product.vendorCategory || "Catalogue";
  const categoryHref = product.ulineCategorySlug ? `/category/${product.ulineCategorySlug}` : "/";
  const subcategory = subcategoryName(product);
  // A handful of products have no Uline taxonomy, so their subcategory falls
  // back to the category name — don't print the same word twice in the trail.
  const showSubcategory = subcategory.toLowerCase() !== categoryLabel.toLowerCase();
  const specs = productSpecs(product);
  const siblings = relatedProducts(product, 8);
  const price = formatPrice(product.price);
  const bundlePrice = formatPrice(product.bundlePrice);
  const bundle = product.bundleQty > 1
    ? `${product.bundleQty} per bundle${bundlePrice ? ` · ${bundlePrice}` : ""}`
    : null;

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href={categoryHref}>{categoryLabel}</Link>
        <span aria-hidden="true">/</span>
        {showSubcategory && (
          <>
            <span>{subcategory}</span>
            <span aria-hidden="true">/</span>
          </>
        )}
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className={styles.top}>
        <div className={styles.media}>
          <img src={imageFor(product)} alt={product.name} />
        </div>
        <div className={styles.facts}>
          <h1 className={styles.title}>{product.name}</h1>
          {product.variantLabel && <p className={styles.variant}>{product.variantLabel}</p>}
          <p className={price ? styles.price : styles.pricePending}>{price || "Price coming soon"}</p>
          {bundle && <p className={styles.bundle}>{bundle}</p>}
          <ProductBuyPanel product={product} />
          {product.partial && (
            <p className={styles.note}>
              {product.supplier || "The supplier"} does not publish a price for this item.
            </p>
          )}
          {product.sourceUrl && (
            <a className={styles.sourceLink} href={product.sourceUrl} target="_blank" rel="noreferrer">
              Product source
            </a>
          )}
        </div>
      </div>

      {specs.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Specifications</h2>
          <dl className={styles.specs}>
            {specs.map(([label, value]) => (
              <div className={styles.specRow} key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {product.description && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Description</h2>
          <p className={styles.description}>{product.description}</p>
        </section>
      )}

      {siblings.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>More in {subcategory}</h2>
          <div className={styles.grid}>
            {siblings.map((sibling) => (
              <Link key={sibling.slug} href={`/product/${sibling.slug}`} className={styles.card}>
                <span className={styles.cardImage}>
                  <img src={imageFor(sibling)} alt={sibling.name} loading="lazy" />
                </span>
                <span className={styles.cardName}>{sibling.name}</span>
                {sibling.size && <span className={styles.cardSize}>{sibling.size}</span>}
                <span className={styles.cardPrice}>{formatPrice(sibling.price) || "Price coming soon"}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
