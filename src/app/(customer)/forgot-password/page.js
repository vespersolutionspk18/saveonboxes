import PasswordRecovery from "../../components/customer/PasswordRecovery";

export const metadata = { title: "Reset your password | Save On Boxes", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <PasswordRecovery mode="request" />;
}
