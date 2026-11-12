import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/request-origin', () => ({ requestOrigin: async () => 'https://rr.test' }));
vi.mock('@/lib/cities', () => ({ listActiveCities: async () => [{ id: 1, name: 'Udaipur', slug: 'udaipur', state: 'Rajasthan' }] }));

describe('GET /llms.txt', () => {
  it('serves markdown with absolute links on the request host and the live cities', async () => {
    const { GET } = await import('@/app/llms.txt/route');
    const res = await GET();
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
    const body = await res.text();
    expect(body).toMatch(/^# Craftofy/);
    expect(body).toContain('(https://rr.test/shop)');
    expect(body).toContain('(https://rr.test/cities/udaipur)');
    expect(body).not.toMatch(/Rajasthan/);
    // only link pages that are indexable and exist on production (not noindex /sell, not the unreleased /privacy and /terms)
    expect(body).not.toMatch(/\/(sell|privacy|terms)\)/);
  });
});
