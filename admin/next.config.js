/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000',
    NEXT_PUBLIC_WS_BASE: process.env.NEXT_PUBLIC_WS_BASE || 'http://localhost:4000',
  },
};
module.exports = nextConfig;
