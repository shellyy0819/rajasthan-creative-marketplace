import type { NextConfig } from 'next';

/**
 * Extra hostnames allowed to open the dev server, for sharing it through a tunnel (ngrok, cloudflared). Set DEV_ORIGINS to a comma-separated list of
 * exact hostnames, for example DEV_ORIGINS=my-name.ngrok-free.dev npm run dev. Empty by default and only used by `next dev`.
 */
const devOrigins = (process.env.DEV_ORIGINS ?? '').split(',').map(h => h.trim()).filter(Boolean);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(devOrigins.length ? { allowedDevOrigins: devOrigins } : {}),
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
    ];
  },
};

export default nextConfig;
