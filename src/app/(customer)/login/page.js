import AuthScreen from "../../components/customer/AuthScreen";

export const metadata = { title: "Log in | Save On Boxes", robots: { index: false, follow: false } };

export default function LoginPage() {
  return <AuthScreen mode="login" />;
}
