import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { AccountBoot } from "@/components/AccountBoot";
import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const body = Plus_Jakarta_Sans({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Vesta",
  description: "The household account. Shared rent, splits and money home, opened with one passkey.",
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
