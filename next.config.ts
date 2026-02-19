import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove static export for Vercel deployment
  // output: 'export',
  // trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Remove base path for Vercel
  // assetPrefix: process.env.NODE_ENV === 'production' ? '/chess-scoring-analyze' : undefined,
  // basePath: process.env.NODE_ENV === 'production' ? '/chess-scoring-analyze' : undefined,
};

export default nextConfig;
