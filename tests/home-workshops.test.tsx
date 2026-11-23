// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('next/cache', async orig => ({ ...(await orig<typeof import('next/cache')>()), revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock('next/server', async orig => ({ ...(await orig<typeof import('next/server')>()), connection: async () => undefined }));
vi.mock('@/lib/request-origin', () => ({ requestOrigin: async () => 'http://localhost:3000' }));
vi.mock('next/navigation', () => ({ notFound: vi.fn(), usePathname: () => '/', useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: () => <button>add</button> }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: () => <button>like</button> }));
vi.mock('@/components/ReserveButton', () => ({ ReserveButton: ({ workshop }: any) => <button>reserve {workshop.id}</button> }));
import { HOME_WORKSHOP_LIMIT, HomeWorkshops } from '@/components/HomeWorkshops';
import { createWorkshop } from '@/lib/admin';
import { listWorkshops } from '@/lib/catalog';
import { resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });
afterEach(cleanup);

const extra = (title: string) => ({ title, kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'Yoga with Swati', description: 'Gentle yoga.', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, status: 'APPROVED' });

describe('home page workshops', () => {
  it('shows at most three, even when more are on', async () => {
    for (const t of ['Extra A', 'Extra B', 'Extra C']) await createWorkshop(extra(t));
    expect((await listWorkshops()).length).toBeGreaterThan(HOME_WORKSHOP_LIMIT);
    render(await HomeWorkshops());
    expect(HOME_WORKSHOP_LIMIT).toBe(3);
    expect(document.querySelectorAll('.workshop-card')).toHaveLength(3);
  });
  it('shows all of them when there are three or fewer', async () => {
    const n = (await listWorkshops()).length;
    render(await HomeWorkshops());
    expect(document.querySelectorAll('.workshop-card')).toHaveLength(Math.min(n, 3));
  });
  it('the home page links to the full list as "All workshops"', async () => {
    const Home = (await import('@/app/page')).default;
    // Streamed sections are async components that jsdom cannot render: leave them out, the link sits in the band itself.
    const drop = (node: any): any => Array.isArray(node) ? node.map(drop)
      : !React.isValidElement(node) ? node
      : typeof node.type === 'function' && node.type.constructor.name === 'AsyncFunction' ? null
      : (node.props as any)?.children === undefined ? node : React.cloneElement(node, { children: drop((node.props as any).children) } as any);
    const find = (node: any, name: string): any => Array.isArray(node) ? node.map(n => find(n, name)).find(Boolean)
      : !React.isValidElement(node) ? undefined
      : (node.type as { name?: string }).name === name ? node : find((node.props as any)?.children, name);
    const sections = find(await Home(), 'HomeSections');
    expect(sections, 'HomeSections in the home page tree').toBeTruthy();
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    render(<QueryClientProvider client={new QueryClient()}>{drop(await (sections.type as (p: unknown) => Promise<unknown>)(sections.props))}</QueryClientProvider>);
    const band = document.getElementById('workshops')!;
    const link = screen.getByRole('link', { name: 'All workshops →' });
    expect(link.getAttribute('href')).toBe('/workshops');
    expect(link.className).toBe('text-link'); // the same look as "All categories →"
    expect(band.contains(link)).toBe(true);
    expect(band.querySelector('.workshop-intro')!.contains(link)).toBe(false); // not in the intro text: it sits above the list
    const head = link.parentElement!;
    expect(head.className).toBe('workshop-feed-head');
    expect(head.parentElement!.className).toBe('workshop-feed'); // the list follows it inside the same column
    expect(band.textContent).not.toContain('Browse & filter all');
  });
});
