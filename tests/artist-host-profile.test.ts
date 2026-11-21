import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => { process.env.NEXTAUTH_SECRET = 'test-secret'; });
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { artistMeta, hasContent, isHostOnly, listingNoun, profileEyebrow, sharedTopic } from '@/lib/artist-profile';
import { getArtist } from '@/lib/artists';
import { createProduct, createWorkshop } from '@/lib/admin';
import { getWorkshopBySlug, listProducts, listWorkshops } from '@/lib/catalog';
import { artistSlug } from '@/lib/artist-slug';
import { makeSeller, resetTestDb } from './helpers/testdb';
import { admin } from './helpers/actors';
import { cityRef } from './helpers/cities';
import type { Artist } from '@/lib/artists';
import type { Product, Workshop } from '@/lib/types';

const piece = (over: Partial<Product> = {}) => ({ id: 'p1', description: 'Hand-poured resin.', sourcing: { id: 1, name: 'Handmade', countsAsHandmade: true, showBadge: true } , ...over }) as Product;
const ws = (over: Partial<Workshop> = {}) => ({ id: 'w1', kind: 'workshop', mode: 'in_person', topic: { id: 1, name: 'Yoga', slug: 'yoga' }, ...over }) as Workshop;
const person = (products: Product[], workshops: Workshop[], over: Partial<Artist> = {}): Artist => ({ name: 'Swati', slug: 'swati-12345678', city: 'Jaipur', products, workshops, ...over });

describe('the heading above a profile', () => {
  it('anyone who sells pieces is the maker, also when they teach', () => {
    expect(profileEyebrow(person([piece()], []))).toBe('MEET THE MAKER');
    expect(profileEyebrow(person([piece()], [ws({ kind: 'class', mode: 'online' })]))).toBe('MEET THE MAKER');
  });
  it('someone who only runs classes is the instructor', () => {
    expect(profileEyebrow(person([], [ws({ kind: 'class' })]))).toBe('MEET YOUR INSTRUCTOR');
    expect(profileEyebrow(person([], [ws({ kind: 'workshop', mode: 'online' }), ws({ id: 'w2', kind: 'class', mode: 'online' })]))).toBe('MEET YOUR INSTRUCTOR');
  });
  it('someone who runs workshops, alone or with classes, is the host', () => {
    expect(profileEyebrow(person([], [ws()]))).toBe('MEET YOUR HOST');
    expect(profileEyebrow(person([], [ws({ kind: 'class', mode: 'online' }), ws({ id: 'w2' })]))).toBe('MEET YOUR HOST');
    expect(profileEyebrow(person([], []))).toBe('MEET YOUR HOST');
  });
});

describe('what a profile says about itself', () => {
  it('nouns and topic follow the listings', () => {
    expect(listingNoun([ws({ kind: 'class' })])).toBe('classes');
    expect(listingNoun([ws()])).toBe('workshops');
    expect(listingNoun([ws(), ws({ kind: 'class' })])).toBe('classes and workshops');
    expect(sharedTopic([ws(), ws({ id: 'w2' })])).toBe('Yoga');
    expect(sharedTopic([ws(), ws({ id: 'w2', topic: { id: 2, name: 'Crochet', slug: 'crochet' } })])).toBeUndefined();
  });
  it('a maker keeps the old title; classes are only added to the description', () => {
    expect(artistMeta(person([piece()], [])).title).toBe('Swati — handmade by an independent artist');
    expect(artistMeta(person([piece()], [])).description).not.toMatch(/Also hosts/);
    expect(artistMeta(person([piece()], [ws(), ws({ id: 'w2' })])).description).toMatch(/Also hosts 2 workshops\.$/);
    expect(artistMeta(person([piece({ sourcing: undefined })], [])).title).toBe('Swati — an independent artist');
  });
  it('a host with no pieces is named by what they teach and where, and never called an artist or handmade', () => {
    const m = artistMeta(person([], [ws({ kind: 'class' })]));
    expect(m.title).toBe('Swati — Yoga classes in Jaipur');
    expect(m.description).toMatch(/^Swati hosts Yoga classes in Jaipur\./);
    expect(artistMeta(person([], [ws({ kind: 'class', mode: 'online' })])).title).toBe('Swati — Yoga classes online');
    expect(artistMeta(person([], [ws()], { city: undefined })).title).toBe('Swati — Yoga workshops');
    for (const t of [m.title, m.description]) expect(t).not.toMatch(/artist|handmade/i);
  });
  it('is indexable only with a piece for sale or a class or workshop still on', () => {
    expect(isHostOnly(person([], []))).toBe(true);
    expect(hasContent(person([piece()], []))).toBe(true);
    expect(hasContent(person([], [ws()]))).toBe(true);
    expect(hasContent(person([], []))).toBe(false);
  });
});

describe('profiles of people who only host', () => {
  beforeEach(async () => { await resetTestDb(); });
  const online = { title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'Yoga with Swati', description: 'Gentle yoga.', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, status: 'APPROVED' };

  it('a host with an account and a published class has a page, without any product', async () => {
    const swati = await makeSeller('swati@x.co', 'Swati Rao');
    await createWorkshop({ ...online, hostId: swati.id });
    const slug = artistSlug('Swati Rao', swati.id);
    const a = (await getArtist(slug))!;
    expect(a.name).toBe('Swati Rao');
    expect(a.products).toEqual([]);
    expect(a.workshops!.map(w => w.title)).toEqual(['Morning Flow']);
    expect(JSON.stringify(a)).not.toContain(swati.id);
  });
  it('their listing links to the profile; a listing with no account, or not published, does not', async () => {
    const swati = await makeSeller('swati@x.co', 'Swati Rao');
    const live = await createWorkshop({ ...online, hostId: swati.id });
    await createWorkshop({ ...online, title: 'No account' });
    await createWorkshop({ ...online, title: 'Draft one', hostId: swati.id, status: 'DRAFT' });
    const all = await listWorkshops();
    expect(all.find(w => w.id === live.id)!.hostSlug).toBe(artistSlug('Swati Rao', swati.id));
    expect(all.find(w => w.title === 'No account')).not.toHaveProperty('hostSlug');
    expect(await getWorkshopBySlug(`morning-flow-${live.id}`)).toHaveProperty('hostSlug');
  });
  it('a host with only a draft has no page; the wrong name part is not found either', async () => {
    const swati = await makeSeller('swati@x.co', 'Swati Rao');
    await createWorkshop({ ...online, hostId: swati.id, status: 'DRAFT' });
    expect(await getArtist(artistSlug('Swati Rao', swati.id))).toBeUndefined();
    await createWorkshop({ ...online, title: 'Live one', hostId: swati.id });
    expect(await getArtist(artistSlug('Someone Else', swati.id))).toBeUndefined();
    expect(await getArtist(artistSlug('Swati Rao', swati.id))).toBeDefined();
  });
  it('a maker who also hosts keeps products and gets the classes too; an ended workshop is not listed but the page stays', async () => {
    const s = await makeSeller('both@x.co', 'Both Studio');
    await createProduct({ name: 'Bowl', category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId: s.id }, admin);
    await createWorkshop({ ...online, hostId: s.id });
    await createWorkshop({ title: 'Old', kind: 'workshop', mode: 'in_person', cityRef: cityRef('Jaipur'), venue: 'V', date: '2000-01-01', time: '10:00', seats: 5, host: 'Both', hostId: s.id, description: 'D', status: 'APPROVED', type: 'FREE', pricePaise: 0 });
    const slug = (await listProducts()).find(p => p.name === 'Bowl')!.sellerSlug!;
    const a = (await getArtist(slug))!;
    expect(a.products.map(p => p.name)).toEqual(['Bowl']);
    expect(a.workshops!.map(w => w.title)).toEqual(['Morning Flow']);
    expect(profileEyebrow(a)).toBe('MEET THE MAKER');
  });
});
