import ScanClaim from "../../../components/customer/ScanClaim";

export const metadata = { title: "Opening your box | Save On Boxes", robots: { index: false, follow: false } };

export default async function ScanPage({ params }) {
  const { token } = await params;
  return <ScanClaim token={token} />;
}
