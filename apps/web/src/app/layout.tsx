import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { AccountBoot } from "@/components/AccountBoot";
import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const body = Plus_Jakarta_Sans({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

const description = "The household account. Shared rent, splits and money home, opened with one passkey.";

export const metadata: Metadata = {
  metadataBase: new URL("https://vesta-pi-neon.vercel.app"),
  title: "Vesta",
  description,
  openGraph: { type: "website", siteName: "Vesta", title: "Vesta: money for the people you live with", description },
  twitter: { card: "summary_large_image", title: "Vesta: money for the people you live with", description },
  applicationName: "Vesta",
  appleWebApp: { capable: true, title: "Vesta", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#f6f4ef",
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
