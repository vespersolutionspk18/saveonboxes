import { notFound } from "next/navigation";
import CategoryPage from "../../components/CategoryPage";
import { categoryPages, getCategoryPage } from "../../category-data";

export function generateStaticParams() {
  return categoryPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = getCategoryPage(slug);
  if (!page) return {};
  return {
    title: `${page.title} | SaveOnBoxes`,
    description: `${page.title} — every size and style we stock, with images and specifications.`,
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const page = getCategoryPage(slug);
  if (!page) notFound();
  return <CategoryPage page={page} />;
}
