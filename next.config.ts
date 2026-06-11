import type { NextConfig } from 'next'
import path from 'path'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/firestore\.googleapis\.com/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'firestore-cache',
          networkTimeoutSeconds: 10,
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
      {
        urlPattern: /^https:\/\/lh3\.googleusercontent\.com/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-avatars',
          expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
    ],
  },
})

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
}

export default withPWA(nextConfig)
