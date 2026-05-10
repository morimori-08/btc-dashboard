/** @type {import('next').NextConfig} */
const nextConfig = {
  // API URL を環境変数で管理
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },
}
module.exports = nextConfig
