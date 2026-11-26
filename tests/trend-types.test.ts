import { describe, it, expect } from 'vitest';
import { ApiError } from '@/lib/errors';
import { parseItemInput, trendBlockHeading, trendSourceLine } from '@/lib/trend-types';

const good = () => ({
  kind: 'craft',
  title: 'Block printed linen',
  why: 'Buyers are searching for natural dyes and hand block prints.',
  category: 'Textiles',
  tags: ['linen', 'block print'],
  sources: [{ title: 'Design weekly', url: 'https://example.com/a' }],
});
const status = (fn: () => unknown) => {
  try { fn(); } catch (e) { return e instanceof ApiError ? e.status : 'other'; }
  return 'none';
};

describe('trendBlockHeading', () => {
  it('names the block after the kinds of its items', () => {
    expect(trendBlockHeading(['craft', 'craft'])).toBe('Crafts to look at');
    expect(trendBlockHeading(['art'])).toBe('Art to look at');
    expect(trendBlockHeading(['craft', 'art'])).toBe('Arts and crafts to look at');
  });
  it('gives no heading when there is no craft or art item', () => {
    expect(trendBlockHeading([])).toBeNull();
    expect(trendBlockHeading(['workshop'])).toBeNull();
  });
});

describe('trendSourceLine', () => {
  it('credits each origin in plain words', () => {
    expect(trendSourceLine(['web'])).toBe('Gathered from Google News, then picked by our team.');
    expect(trendSourceLine(['pinterest', 'web', 'manual'])).toBe('Gathered from Google News, Pinterest and our own research, then picked by our team.');
    expect(trendSourceLine(['manual'])).toBe('Gathered from our own research, then picked by our team.');
  });
});

describe('parseItemInput', () => {
  it('accepts a good item and trims it', () => {
    const item = parseItemInput({ ...good(), title: '  Block printed linen  ' }, 'manual');
    expect(item).toEqual({ ...good(), title: 'Block printed linen', origin: 'manual' });
  });
  it('rejects a source url that is not https', () => {
    expect(status(() => parseItemInput({ ...good(), sources: [{ title: 'Bad', url: 'javascript:alert(1)' }] }, 'web'))).toBe(400);
    expect(status(() => parseItemInput({ ...good(), sources: [{ title: 'Bad', url: 'http://x.in' }] }, 'web'))).toBe(400);
  });
  it('rejects a source link that carries credentials', () => {
    expect(status(() => parseItemInput({ ...good(), sources: [{ title: 'Bad', url: 'https://google.com@evil.com' }] }, 'web'))).toBe(400);
    expect(status(() => parseItemInput({ ...good(), sources: [{ title: 'Bad', url: 'https://user:pass@x.in' }] }, 'web'))).toBe(400);
  });
  it('stores a source link in its normalised form', () => {
    const item = parseItemInput({ ...good(), sources: [{ title: 'Shouty', url: ' HTTPS://X.IN ' }] }, 'web');
    expect(item.sources).toEqual([{ title: 'Shouty', url: 'https://x.in/' }]);
  });
  it('requires at least one source', () => {
    expect(status(() => parseItemInput({ ...good(), sources: [] }, 'web'))).toBe(400);
  });
  it('rejects a 2-character title and 7 tags', () => {
    expect(status(() => parseItemInput({ ...good(), title: 'ab' }, 'web'))).toBe(400);
    expect(status(() => parseItemInput({ ...good(), tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }, 'web'))).toBe(400);
  });
  it('keeps a title with markup as plain text (it is escaped when shown)', () => {
    const item = parseItemInput({ ...good(), title: '<script>alert(1)</script>' }, 'web');
    expect(item.title).toBe('<script>alert(1)</script>');
  });
  it('allows a source with no link and an item with no category', () => {
    const item = parseItemInput({ kind: 'art', title: 'Miniature art', why: 'Small works are selling well online.', tags: [], sources: [{ title: 'Our own research' }] }, 'manual');
    expect(item.sources).toEqual([{ title: 'Our own research' }]);
    expect(item.category).toBeUndefined();
  });
});
