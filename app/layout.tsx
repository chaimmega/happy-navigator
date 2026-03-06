import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Happy Navigator — Find your happiest bike route",
  description:
    "Enter two locations and discover the most scenic, green, and cycle-friendly route — scored by parks, cycleways, lighting, traffic stress, and elevation. Powered by OpenStreetMap + AI.",
  keywords: ["bike route", "cycling", "happy route", "OpenStreetMap", "route planner"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10b981",
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
