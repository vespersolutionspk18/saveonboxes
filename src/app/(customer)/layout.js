import "../platform.css";
import "../customer-app.css";

export default function CustomerLayout({ children }) {
  return <div className="customer-app customer-shell">{children}</div>;
}
