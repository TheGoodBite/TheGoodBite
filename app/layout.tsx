import type { Metadata } from "next";
import "./globals.css";

export const viewport = {
  themeColor: "#ffffff"
};

export const metadata: Metadata = {
  title: "Meezany | Better groceries, without the homework.",
  description:
    "Convert your grocery list into ranked healthy products sorted by price. Filter by diets, allergens, FODMAP status, and nutrition quality.",
  keywords: ["grocery", "healthy food", "nutrition score", "diet", "product ranking", "fodmap", "allergens"],
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/meezany-mark.svg", apple: "/brand/meezany-icon.png" },
  openGraph: {
    title: "Meezany | Better groceries, without the homework.",
    description: "Ranked grocery product discovery with nutrition, budget, and diet-fit scores.",
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
