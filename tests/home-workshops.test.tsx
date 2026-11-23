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
import { saveHomeSettings } from '@/lib/home-settings';
import { resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });
afterEach(cleanup);

const extra = (title: string) => ({ title, kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'Yoga with Swati', description: 'Gentle yoga.', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, status: 'APPROVED' });

const showAlways = () => saveHomeSettings({ minWorkshops: 0 }, 'root@x.co');
const extras = async (n: number) => { for (let i = 0; i < n; i++) await createWorkshop(extra(`Extra ${i}`)); };

describe('home page workshops', () => {
  it('shows at most three, even when more are on', async () => {
    await showAlways(); await extras(3);
    expect((await listWorkshops()).length).toBeGreaterThan(HOME_WORKSHOP_LIMIT);
    render(await HomeWorkshops());
    expect(HOME_WORKSHOP_LIMIT).toBe(3);
    expect(document.querySelectorAll('.workshop-card')).toHaveLength(3);
  });
  it('shows all of them when there are three or fewer', async () => {
    await showAlways();
    const n = (await listWorkshops()).length;
    render(await HomeWorkshops());
    expect(document.querySelectorAll('.workshop-card')).toHaveLength(Math.min(n, 3));
  });
  it('links to the full list as "All workshops", above the list, in the same look as "All categories"', async () => {
    await showAlways();
    render(await HomeWorkshops());
    const band = document.getElementById('workshops')!;
    const link = screen.getByRole('link', { name: 'All workshops →' });
    expect(link.getAttribute('href')).toBe('/workshops');
    expect(link.className).toBe('text-link');
    expect(band.contains(link)).toBe(true);
    expect(band.querySelector('.workshop-intro')!.contains(link)).toBe(false); // not in the intro text: it sits above the list
    const head = link.parentElement!;
    expect(head.className).toBe('workshop-feed-head');
    expect(head.parentElement!.className).toBe('workshop-feed'); // the list follows it inside the same column
    expect(band.textContent).not.toContain('Browse & filter all');
  });
});

describe('the workshop section is hidden until enough workshops are on', () => {
  it('by default (10) the whole section is left out while fewer than ten workshops are on', async () => {
    const n = (await listWorkshops()).length;
    expect(n).toBeLessThan(10);
    expect(await HomeWorkshops()).toBeNull();
  });
  it('appears from exactly the threshold, with its heading, link and workshops', async () => {
    const n = (await listWorkshops()).length;
    await extras(10 - n - 1);
    expect(await HomeWorkshops()).toBeNull();            // nine on: still hidden
    await extras(1);
    render(await HomeWorkshops());                       // ten on: shown
    expect(screen.getByRole('heading', { level: 2, name: /make time for/i })).toBeTruthy();
    expect(document.querySelectorAll('.workshop-card')).toHaveLength(3);
  });
  it('follows the admin setting: a lower number shows it sooner, a higher one hides it, 0 always shows it', async () => {
    const n = (await listWorkshops()).length;
    await saveHomeSettings({ minWorkshops: n }, 'root@x.co');
    expect(await HomeWorkshops()).not.toBeNull();
    await saveHomeSettings({ minWorkshops: n + 1 }, 'root@x.co');
    expect(await HomeWorkshops()).toBeNull();
    await saveHomeSettings({ minWorkshops: 0 }, 'root@x.co');
    expect(await HomeWorkshops()).not.toBeNull();
  });
  it('counts only workshops that are on (published, not ended)', async () => {
    const n = (await listWorkshops()).length;
    await createWorkshop({ ...extra('Draft one'), status: 'DRAFT' });
    await saveHomeSettings({ minWorkshops: n + 1 }, 'root@x.co');
    expect(await HomeWorkshops()).toBeNull();
  });
  it('the home page puts the section behind a Suspense of its own, so hiding it never blocks the page', async () => {
    const src = (await import('node:fs')).readFileSync('src/app/page.tsx', 'utf8');
    expect(src).toContain('<Suspense fallback={null}><HomeWorkshops /></Suspense>');
    expect(src).not.toContain('className="workshop-band"');
  });
});
