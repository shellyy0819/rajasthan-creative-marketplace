import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return { name: SITE.name, short_name: 'Rang', description: SITE.description, start_url: '/', display: 'standalone', background_color: '#f8f4ee', theme_color: '#405746', lang: 'en-IN' };
}
