import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meezany",
    short_name: "Meezany",
    description: "Ranked grocery product discovery with nutrition, budget, and diet-fit scores.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111111",
    icons: [
      {
        src: "/brand/meezany-orange-icon.png",
        sizes: "256x256",
        type: "image/png"
      }
    ]
  };
}
