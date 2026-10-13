import { notFound } from "next/navigation";
import ProductPage from "../../components/ProductPage";
import { allProducts, formatPrice, getProductBySlug } from "../../catalog-tree";

export function generateStaticParams() {
  return allProducts.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return {};
  const fallback = [product.size, product.color, formatPrice(product.price)].filter(Boolean).join(" · ");
  return {
    title: `${product.name} | SaveOnBoxes`,
    description: product.description || fallback || `Details and specifications for ${product.name}.`,
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();
  return <ProductPage product={product} />;
}
