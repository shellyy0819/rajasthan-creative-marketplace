// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { LikeButton } from '@/components/LikeButton';
import { __resetLikeBatchForTests } from '@/components/LikeButton';

let fetchMock: ReturnType<typeof vi.fn>;
const res = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
let likes: Record<string, { count: number; liked: boolean }>;

beforeEach(() => {
  __resetLikeBatchForTests();
  likes = { p1: { count: 3, liked: false }, p2: { count: 0, liked: true } };
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.startsWith('/api/likes')) {
      const ids = new URL(url, 'http://x').searchParams.get('ids')!.split(',');
      return res(200, { counts: Object.fromEntries(ids.map(i => [i, likes[i]?.count ?? 0])), liked: ids.filter(i => likes[i]?.liked) });
    }
    const m = /\/api\/products\/(p\d+)\/like$/.exec(url)!;
    const id = m[1]; const add = init?.method === 'POST';
    likes[id] = { count: likes[id].count + (add && !likes[id].liked ? 1 : !add && likes[id].liked ? -1 : 0), liked: add };
    return res(200, { liked: add, count: likes[id].count });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const btn = (name: RegExp) => screen.getByRole('button', { name });

describe('LikeButton', () => {
  it('shows the server-rendered count at once and learns whether you liked it with one batched request for all cards on the page', async () => {
    render(<><LikeButton productId="p1" initialCount={3} productName="Bag" /><LikeButton productId="p2" initialCount={0} productName="Dish" /></>);
    expect(btn(/Like Bag/).textContent).toContain('3');
    await waitFor(() => expect(btn(/Unlike Dish/)).toBeTruthy());
    const calls = fetchMock.mock.calls.filter(c => String(c[0]).startsWith('/api/likes'));
    expect(calls).toHaveLength(1);                                    // batched, not one request per card
    expect(new URL(calls[0][0] as string, 'http://x').searchParams.get('ids')!.split(',').sort()).toEqual(['p1', 'p2']);
    expect(btn(/Unlike Dish/).getAttribute('aria-pressed')).toBe('true');
  });
  it('liking is optimistic: the count and pressed state change immediately, then settle on the server count', async () => {
    render(<LikeButton productId="p1" initialCount={3} productName="Bag" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(btn(/Like Bag/));
    expect(btn(/Unlike Bag/).textContent).toContain('4');
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(true));
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!;
    expect(post[0]).toBe('/api/products/p1/like');
    expect((post[1].headers as Record<string, string>)['content-type']).toBe('application/json');
    fireEvent.click(btn(/Unlike Bag/));
    await waitFor(() => expect(btn(/Like Bag/).textContent).toContain('3'));
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'DELETE')).toBe(true);
  });
  it('a failed request rolls the optimistic change back and does not lie about the count', async () => {
    render(<LikeButton productId="p1" initialCount={3} productName="Bag" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fetchMock.mockImplementation(() => res(429, { error: 'Too many requests.' }));
    fireEvent.click(btn(/Like Bag/));
    await waitFor(() => expect(btn(/Like Bag/).textContent).toContain('3'));
    expect(btn(/Like Bag/).getAttribute('aria-pressed')).toBe('false');
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    fireEvent.click(btn(/Like Bag/));
    await waitFor(() => expect(btn(/Like Bag/).textContent).toContain('3'));
  });
  it('ignores clicks while a request is in flight (no double like) and shows the busy state', async () => {
    render(<LikeButton productId="p1" initialCount={3} productName="Bag" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    let release!: (v: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>(r => { release = r; }));
    fireEvent.click(btn(/Like Bag/));
    fireEvent.click(btn(/Unlike Bag/));
    expect(fetchMock.mock.calls.filter(c => c[1]?.method)).toHaveLength(1);
    expect(btn(/Unlike Bag/).getAttribute('aria-busy')).toBe('true');
    await act(async () => { release({ ok: true, status: 200, json: () => Promise.resolve({ liked: true, count: 4 }) } as Response); });
    await waitFor(() => expect(btn(/Unlike Bag/).getAttribute('aria-busy')).not.toBe('true'));
  });
  it('clicking the heart inside a card never follows the card link (propagation stopped)', async () => {
    const onCard = vi.fn();
    render(<div onClick={onCard}><LikeButton productId="p1" initialCount={0} productName="Bag" /></div>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(btn(/Like Bag/));
    expect(onCard).not.toHaveBeenCalled();
  });
  it('is keyboard accessible: a real button with an accessible name that includes the count for screen readers', () => {
    render(<LikeButton productId="p1" initialCount={1} productName="Bag" />);
    const b = btn(/Like Bag/) as HTMLButtonElement;
    expect(b.type).toBe('button');
    expect(b.getAttribute('aria-label')).toBe('Like Bag (1 like)');
  });
  it('shows a singular/plural label and tolerates a missing initial count', () => {
    render(<LikeButton productId="p9" productName="Thing" />);
    expect(btn(/Like Thing/).getAttribute('aria-label')).toBe('Like Thing (0 likes)');
  });
});
