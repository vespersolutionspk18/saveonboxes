import "./globals.css";
import Storefront from "./components/Storefront";

export const metadata = {
  title: "SaveOnBoxes | Moving Boxes, Kits & Extras",
  description: "Moving boxes, packing kits and supplies for your next move.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return <html lang="en-NZ"><body><Storefront>{children}</Storefront></body></html>;
}
