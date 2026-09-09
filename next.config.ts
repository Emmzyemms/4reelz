import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  // Opens the treemap in your browser automatically when ANALYZE=true
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // Allow arbitrarily large request/response bodies through API routes.
  // Needed for video uploads which can be several GB.
  experimental: {
    serverActions: {
      bodySizeLimit: '4gb',
    },
  },
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        // Backend stores video thumbnails and clip thumbnails on Cloudinary
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default withBundleAnalyzer(nextConfig);
