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

export const metadata: Metadata = {
  title: "OnlyGoodBites – Smarter Grocery Picks",
  description:
    "Enter your grocery list and get ranked product options with estimated prices, nutrition scores, and diet-fit ratings. Save lists and track what you actually buy.",
  keywords: ["grocery", "healthy food", "nutrition score", "diet", "product ranking"],
  themeColor: "#000000",
  manifest: "/manifest.json",
  openGraph: {
    title: "OnlyGoodBites – Smarter Grocery Picks",
    description: "Ranked grocery product discovery with nutrition and diet-fit scores.",
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
