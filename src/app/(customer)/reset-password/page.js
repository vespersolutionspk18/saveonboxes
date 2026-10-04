import PasswordRecovery from "../../components/customer/PasswordRecovery";

export const metadata = { title: "Choose a new password | Save On Boxes", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <PasswordRecovery mode="reset" />;
}
