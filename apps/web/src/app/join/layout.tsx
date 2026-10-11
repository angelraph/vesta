import type { Metadata } from "next";

const title = "You're invited to move in on Vesta";
const description = "Your housemate added you to their house. Tap to join with a passkey: no password, no email.";

export const metadata: Metadata = {
  title: "Join a house · Vesta",
  description,
  // Setting these replaces the root ones, so the picture has to come along.
  openGraph: { type: "website", siteName: "Vesta", title, description, images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image.jpg"] },
};

export default function JoinLayout({ children }: LayoutProps<"/join">) {
  return children;
}
