import { securityHeaders } from './lib/securityHeaders.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A self-contained server in .next/standalone for the Docker image (see Dockerfile).
  output: 'standalone',
  transpilePackages: ['three'],
  experimental: {
    serverComponentsExternalPackages: ['razorpay', 'web-push'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders(process.env) }];
  },
};

export default nextConfig;
