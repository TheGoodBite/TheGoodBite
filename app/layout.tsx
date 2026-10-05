import type { Metadata } from "next";
import "./globals.css";

export const viewport = {
  themeColor: "#ffffff"
};

export const metadata: Metadata = {
  title: "Meezany | Better groceries, without the homework.",
  description:
    "Explore grocery products in Open Food Facts order, with nutrition and price details. Filter by diets, allergens, FODMAP status, and nutrition quality.",
  keywords: ["grocery", "healthy food", "nutrition score", "diet", "product search", "fodmap", "allergens"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/brand/meezany-orange-icon.ico",
    apple: "/brand/meezany-orange-icon.png"
  },
  openGraph: {
    title: "Meezany | Better groceries, without the homework.",
    description: "Grocery product discovery with nutrition facts, prices, and preference matches.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
