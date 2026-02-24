import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: 'http://127.0.0.1:3001/api/:path*',
    },
    {
      source: '/auth/:path*',
      destination: 'http://127.0.0.1:3001/auth/:path*',
    },
  ],
};

export default nextConfig;
