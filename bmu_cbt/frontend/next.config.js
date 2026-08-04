/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    domains: ['localhost'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api',
  },
  // Handle chunk loading issues
  experimental: {
    optimizeCss: false,
  },
  // Ensure proper asset loading
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : undefined,
  // Add headers for proper caching
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  // Disable webpack config optimizations that might cause issues
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (!isServer) {
      // On client side, ignore Node.js modules that axios tries to load
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        path: false,
        stream: false,
        crypto: false,
        http: false,
        https: false,
        zlib: false,
        util: false,
        buffer: false,
        process: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
