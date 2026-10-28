import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

const sizes = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512];

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name, short_name: SITE.name, description: SITE.description, start_url: '/', display: 'standalone',
    background_color: '#f6efe4', theme_color: '#c8553d', lang: 'en-IN',
    icons: [
      ...sizes.map(n => ({ src: `/icons/icon-${n}.png`, sizes: `${n}x${n}`, type: 'image/png', purpose: 'any' as const })),
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
