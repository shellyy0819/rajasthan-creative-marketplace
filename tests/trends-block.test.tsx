// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
import { TrendsBlock } from '@/components/trends/TrendsBlock';
import { TrendsPreviewBar } from '@/components/trends/TrendsPreviewBar';
import type { MatchedItem } from '@/lib/trend-match';
import type { TrendsForPage } from '@/lib/trend-preview';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

let n = 0;
const item = (o: Partial<MatchedItem> = {}): MatchedItem => ({
  id: `i${++n}`, kind: 'craft', title: `Block prints ${n}`, why: `People want block prints, reason ${n}.`, tags: [], origin: 'web',
  sources: [{ title: `Source ${n}` }], show: true, count: 3, href: '/shop?q=block', ...o,
});
const page = (items: MatchedItem[], o: Partial<TrendsForPage> = {}): TrendsForPage => ({
  items, sourceLine: 'Gathered from public web sources, then picked by our team.', updatedOn: new Date('2026-11-24T10:00:00Z'), previewing: false, ...o,
});
const headings = () => screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);

describe('TrendsBlock sections', () => {
  it('shows only craft items under "Crafts to look at" and no workshop section', () => {
    render(<TrendsBlock data={page([item(), item()])} />);
    expect(headings()).toEqual(['Crafts to look at']);
    expect(document.querySelectorAll('article')).toHaveLength(2);
  });
  it('a craft and an art item share "Arts and crafts to look at"', () => {
    render(<TrendsBlock data={page([item({ kind: 'craft' }), item({ kind: 'art' })])} />);
    expect(headings()).toEqual(['Arts and crafts to look at']);
  });
  it('workshop items get their own section, headed "Workshops on the rise"', () => {
    render(<TrendsBlock data={page([item({ kind: 'craft', title: 'A craft' }), item({ kind: 'workshop', title: 'A workshop', href: '/workshops' })])} />);
    expect(headings()).toEqual(['Crafts to look at', 'Workshops on the rise']);
    const ws = screen.getByRole('heading', { level: 2, name: 'Workshops on the rise' }).closest('section')!;
    expect(within(ws).getByRole('heading', { level: 3 }).textContent).toBe('A workshop');
    expect(within(ws).queryByText('A craft')).toBeNull();
  });
  it('a block of only workshops has just the workshop section', () => {
    render(<TrendsBlock data={page([item({ kind: 'workshop' })])} />);
    expect(headings()).toEqual(['Workshops on the rise']);
  });
});

describe('TrendsBlock cards', () => {
  it('shows the title, why, category eyebrow, tags as pills, and the sources by name', () => {
    render(<TrendsBlock data={page([item({ title: 'Blue pottery', why: 'Mugs are selling more.', category: 'Pottery', tags: ['Mugs', 'Planters'], sources: [{ title: 'Pinterest Trends' }, { title: 'Style Desk' }] })])} />);
    const card = screen.getByRole('heading', { level: 3, name: 'Blue pottery' }).closest('article')!;
    expect(within(card).getByText('Mugs are selling more.')).toBeTruthy();
    expect(card.querySelector('.eyebrow')!.textContent).toBe('Pottery');
    expect(Array.from(card.querySelectorAll('li')).map(li => li.textContent)).toEqual(['Mugs', 'Planters']);
    expect(card.textContent).toContain('Source: Pinterest Trends, Style Desk');
  });
  it('no category means no eyebrow, no tags means no pills', () => {
    render(<TrendsBlock data={page([item()])} />);
    expect(document.querySelector('article .eyebrow')).toBeNull();
    expect(document.querySelector('article ul')).toBeNull();
  });
  it('links a source only when it has an https url, with rel noopener noreferrer, else plain text', () => {
    render(<TrendsBlock data={page([item({ sources: [{ title: 'Linked', url: 'https://example.com/a' }, { title: 'Plain' }, { title: 'Sneaky', url: 'javascript:alert(1)' }, { title: 'Insecure', url: 'http://example.com' }] })])} />);
    const linked = screen.getByRole('link', { name: 'Linked' });
    expect(linked.getAttribute('href')).toBe('https://example.com/a');
    expect(linked.getAttribute('rel')).toBe('noopener noreferrer');
    expect(linked.getAttribute('target')).toBe('_blank');
    expect(screen.queryByRole('link', { name: 'Plain' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sneaky' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Insecure' })).toBeNull();
    const src = linked.closest('p')!.textContent;
    expect(src).toContain('Plain');
    expect(src).toContain('Sneaky');
    expect(src).toContain('Insecure');
  });
  it('the count links to href: "See N pieces →" (one piece is singular), "See N workshops →" for workshops', () => {
    render(<TrendsBlock data={page([
      item({ title: 'Many', count: 14, href: '/shop?q=many' }),
      item({ title: 'One', count: 1, href: '/shop?q=one' }),
      item({ kind: 'workshop', title: 'Few', count: 3, href: '/workshops?q=few' }),
      item({ kind: 'workshop', title: 'Single', count: 1, href: '/workshops?q=single' }),
    ])} />);
    expect(screen.getByRole('link', { name: 'See 14 pieces →' }).getAttribute('href')).toBe('/shop?q=many');
    expect(screen.getByRole('link', { name: 'See 1 piece →' }).getAttribute('href')).toBe('/shop?q=one');
    expect(screen.getByRole('link', { name: 'See 3 workshops →' }).getAttribute('href')).toBe('/workshops?q=few');
    expect(screen.getByRole('link', { name: 'See 1 workshop →' }).getAttribute('href')).toBe('/workshops?q=single');
  });
  it('count 0 is a muted note with no link: "No artists listed yet" for crafts and art, "Not offered yet" for workshops', () => {
    render(<TrendsBlock data={page([item({ kind: 'art', count: 0, href: '/shop' }), item({ kind: 'workshop', count: 0, href: '/workshops' })])} />);
    expect(screen.getByText('No artists listed yet').className).toContain('muted');
    expect(screen.getByText('Not offered yet').className).toContain('muted');
    expect(document.querySelectorAll('article a')).toHaveLength(0);
  });
  it('text is rendered as text: markup in a title or source is escaped, never run', () => {
    render(<TrendsBlock data={page([item({ title: '<script>x</script>', why: '<b>bold</b>', sources: [{ title: '<img src=x onerror=alert(1)>' }] })])} />);
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('<script>x</script>');
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('article b')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('<b>bold</b>')).toBeTruthy();
  });
  it('no card renders an image, and the decorative tile is hidden from assistive tech', () => {
    const { container } = render(<TrendsBlock data={page([item(), item({ kind: 'workshop' })])} />);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/https?:\/\/[^"]*\.(png|jpe?g|webp|gif|svg)/i);
    const tiles = container.querySelectorAll('article > [aria-hidden="true"]');
    expect(tiles).toHaveLength(2);
  });
});

describe('TrendsBlock updated line', () => {
  it('shows updatedOn as an India date, then the source line', () => {
    render(<TrendsBlock data={page([item()], { updatedOn: new Date('2026-11-24T20:00:00Z') })} />);   // 01:30 on the 25th in India
    expect(screen.getByText(/^Updated 25 November 2026/).textContent).toBe('Updated 25 November 2026. Gathered from public web sources, then picked by our team.');
  });
});

describe('preview pill', () => {
  it('is shown only while previewing', () => {
    render(<TrendsBlock data={page([item()])} />);
    expect(screen.queryByText('Previewing market trends, not public yet')).toBeNull();
    cleanup();
    render(<TrendsBlock data={page([item()], { previewing: true })} />);
    expect(screen.getByText('Previewing market trends, not public yet').closest('.festive-preview')).toBeTruthy();
  });
  it('Exit calls DELETE /api/admin/trends/preview and then reloads, even when the call fails', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    render(<TrendsPreviewBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/trends/preview', { method: 'DELETE' });
  });
});
