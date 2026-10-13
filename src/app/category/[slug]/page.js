import { notFound } from "next/navigation";
import CategoryPage from "../../components/CategoryPage";
import { categoryTree, getCategoryTree } from "../../catalog-tree";

export function generateStaticParams() {
  return categoryTree.map((category) => ({ slug: category.id }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const category = getCategoryTree(slug);
  if (!category) return {};
  return {
    title: `${category.label} | SaveOnBoxes`,
    description: `Shop ${category.count} ${category.label} products at SaveOnBoxes — every size and style we stock, grouped by type with images and specifications.`,
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const category = getCategoryTree(slug);
  if (!category) notFound();
  return <CategoryPage category={category} />;
}
