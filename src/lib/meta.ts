import type { Metadata } from 'next';
import { SITE } from './site';
import { truncate } from './format';

export function pageMetadata(o: { title: string; description: string; path: string; noindex?: boolean; image?: string | false }): Metadata {
  const description = truncate(o.description, 160);
  return {
    title: o.title,
    description,
    alternates: { canonical: o.path },
    ...(o.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: o.title, description, url: o.path, siteName: SITE.name,
      locale: SITE.locale, type: 'website',
      ...(o.image === false ? {} : { images: [o.image ?? '/opengraph-image'] }),
    },
    twitter: { card: 'summary_large_image', title: o.title, description },
  };
}
