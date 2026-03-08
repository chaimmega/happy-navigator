import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Happy Navigator — Find your happiest canoe route",
  description:
    "Enter a put-in and take-out location and discover the most scenic, green, and paddle-friendly canoe route — scored by waterways, parks, calm water, lighting, portage difficulty, and motorboat traffic. Powered by OpenStreetMap + AI.",
  keywords: ["canoe route", "paddling", "kayaking", "happy route", "OpenStreetMap", "route planner"],
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
