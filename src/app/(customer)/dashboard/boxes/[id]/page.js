import { redirect } from "next/navigation";

export const metadata = { title: "My boxes | Save On Boxes", robots: { index: false, follow: false } };

// Boxes live on the dashboard now. Keep the old link working by sending it there
// with that box expanded.
export default async function BoxPage({ params }) {
  const { id } = await params;
  redirect(`/dashboard?box=${encodeURIComponent(id)}`);
}
