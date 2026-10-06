import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ["/share/:path*", "/api/shares/:path*", "/api/lists/:path*"].map(source => ({ source, headers: [
      { key: "Cache-Control", value: "private, no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ] }));
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" }
    ]
  }
};

export default nextConfig;
