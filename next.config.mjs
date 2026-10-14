/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['razorpay'],
    // Rewrites barrel imports to the modules actually used, so dev compiles hundreds fewer files.
    optimizePackageImports: ['framer-motion'],
  },
};

export default nextConfig;
