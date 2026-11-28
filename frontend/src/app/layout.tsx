import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "RKMSP Clinical Suite",
  description: "Ramakrishna Mission Seva Pratishthan — Ward Rounds, Patient Records & Digital AI Clinical Scribe",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RKMSP Clinical"
  },
  other: {
    "mobile-web-app-capable": "yes"
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-180.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#0F766E",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakarta.variable}>
      <body className="min-h-screen bg-[#F4F7F8] text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
