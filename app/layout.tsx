import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Happy Navigator — Discover your happiest route",
  description:
    "Enter start and destination to discover the most scenic, stress-free route — scored for parks, waterfront views, green spaces, and overall enjoyment. Powered by Google Maps + AI.",
  keywords: ["happy route", "scenic route", "route planner", "Google Maps", "parks", "waterfront"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
