import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk"
});

export const viewport = {
  themeColor: "#166534"
};

export const metadata: Metadata = {
  title: "The Good Bite – Healthy Picks, Honest Prices",
  description:
    "Convert your grocery list into ranked healthy products sorted by price. Filter by diets, allergens, FODMAP status, and nutrition quality.",
  keywords: ["grocery", "healthy food", "nutrition score", "diet", "product ranking", "fodmap", "allergens"],
  manifest: "/manifest.json",
  openGraph: {
    title: "The Good Bite – Healthy Picks, Honest Prices",
    description: "Ranked grocery product discovery with nutrition, budget, and diet-fit scores.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
