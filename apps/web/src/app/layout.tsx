import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { AccountBoot } from "@/components/AccountBoot";
import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const body = Inter({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vesta",
  description: "The household account. Shared rent, splits and money home, opened with one passkey.",
  applicationName: "Vesta",
  appleWebApp: { capable: true, title: "Vesta", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#fbf8f1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AccountBoot />
        {children}
      </body>
    </html>
  );
}
