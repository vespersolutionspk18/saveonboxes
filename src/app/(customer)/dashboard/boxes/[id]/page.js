import BoxDetails from "../../../../components/customer/BoxDetails";

export const metadata = { title: "Box details | Save On Boxes", robots: { index: false, follow: false } };

export default async function BoxPage({ params }) {
  const { id } = await params;
  return <BoxDetails id={id} />;
}
