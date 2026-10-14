import { describe, it, expect } from 'vitest';
import { pageMetadata } from '@/lib/meta';

describe('pageMetadata', () => {
  it('sets canonical, og, twitter, truncates description', () => {
    const m = pageMetadata({ title: 'Shop', description: 'x'.repeat(300), path: '/shop' });
    expect(m.alternates?.canonical).toBe('/shop');
    expect((m.description as string).length).toBeLessThanOrEqual(160);
    expect(m.openGraph).toMatchObject({ title: 'Shop', url: '/shop', type: 'website', locale: 'en_IN' });
    expect(m.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(m.robots).toBeUndefined();
  });
  it('noindex,follow when requested', () => {
    expect(pageMetadata({ title: 'a', description: 'b', path: '/shop', noindex: true }).robots).toEqual({ index: false, follow: true });
  });
});

describe('pageMetadata og image', () => {
  it('defaults to the site OG image so child pages do not lose og:image', () => {
    expect(pageMetadata({ title: 'a', description: 'b', path: '/shop' }).openGraph).toMatchObject({ images: ['/opengraph-image'] });
  });
  it('image:false omits it (page has its own opengraph-image file)', () => {
    expect((pageMetadata({ title: 'a', description: 'b', path: '/x', image: false }).openGraph as { images?: unknown }).images).toBeUndefined();
  });
});
