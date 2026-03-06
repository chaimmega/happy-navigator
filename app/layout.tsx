import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Happy Navigator — Find your happiest bike route",
  description:
    "Enter two locations and discover the most scenic, green, and cycle-friendly route between them — scored by parks, cycleways, and waterways.",
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
