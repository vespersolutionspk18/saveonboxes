import AuthScreen from "../../components/customer/AuthScreen";

export const metadata = { title: "Create your account | Save On Boxes", robots: { index: false, follow: false } };

export default function RegisterPage() {
  return <AuthScreen mode="register" />;
}
