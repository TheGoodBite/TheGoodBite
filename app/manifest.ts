import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Good Bite",
    short_name: "TheGoodBite",
    description: "Ranked grocery product discovery with nutrition, budget, and diet-fit scores.",
    start_url: "/",
    display: "standalone",
    background_color: "#f0faf2",
    theme_color: "#166534",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
}
