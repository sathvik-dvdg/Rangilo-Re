/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  experimental: {
    serverComponentsExternalPackages: ['razorpay'],
  },
};

export default nextConfig;
