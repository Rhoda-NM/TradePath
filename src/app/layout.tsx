import Pwa from "@/components/pwa";
import type { Metadata, Viewport } from "next";
import "./globals.css";
export const viewport: Viewport = { themeColor: "#5a1727" };
export const metadata: Metadata = {
  appleWebApp: { capable: true, title: "TradePath", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  title: "TradePath — Process before profit",
  description: "A deliberate daily practice for your trading journey.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Pwa />
        {children}
      </body>
    </html>
  );
}
