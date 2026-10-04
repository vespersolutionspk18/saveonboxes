import "../platform.css";
import AdminShell from "./components/AdminShell.jsx";

export const metadata = {
  title: "Operations Console | SaveOnBoxes",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
