// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: () => <input name="city" aria-label="City stub" /> }));
vi.mock('@/components/PlaceInput', () => ({ PlaceInput: (p: Record<string, unknown>) => <input name={String(p.name)} aria-label="Place stub" /> }));
import { ImageUploader } from '@/components/ImageUploader';
import { PostForm } from '@/components/PostForm';

const S3 = 'https://b.s3.ap-south-1.amazonaws.com/';
let fetchMock: ReturnType<typeof vi.fn>;
let counter: number;
const reply = (status: number, body: unknown = {}) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);
const file = (name: string, type: string, size = 1000, lastModified = 1) => { const f = new File([new Uint8Array(size)], name, { type, lastModified }); return f; };
const permissionCalls = () => fetchMock.mock.calls.filter(c => c[0] === '/api/uploads/product-image');
const s3Calls = () => fetchMock.mock.calls.filter(c => c[0] === S3);
const pick = (files: File[]) => fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files } });
const hidden = () => Array.from(document.querySelectorAll('input[type="hidden"][name="images"]')).map(i => (i as HTMLInputElement).value);

beforeEach(() => {
  counter = 0;
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/uploads/product-image') {
      const n = ++counter;
      return reply(200, { url: S3, fields: { key: `products/u/${n}.jpg`, 'Content-Type': JSON.parse(String(init!.body)).contentType }, publicUrl: `${S3}products/u/${n}.jpg` });
    }
    if (url === S3) return reply(204);
    return reply(500, { error: 'unexpected ' + url });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const START = ['https://x.example/products/u/a.jpg', 'https://x.example/products/u/b.jpg'];

describe('ImageUploader: showing and editing existing photos', () => {
  it('lists existing photos in order with the first marked Cover, one hidden input each, and a count', () => {
    render(<ImageUploader initial={START} />);
    expect(hidden()).toEqual(START);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Cover')).toBeTruthy();
    expect(within(items[1]).queryByText('Cover')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('2 of 6 photos');
  });
  it('"Make cover" moves a photo first and the Cover badge and hidden order follow; "Remove" deletes one', () => {
    render(<ImageUploader initial={[...START, 'https://x.example/products/u/c.jpg']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make photo 3 the cover' }));
    expect(hidden()).toEqual(['https://x.example/products/u/c.jpg', START[0], START[1]]);
    expect(within(screen.getAllByRole('listitem')[0]).getByText('Cover')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Make photo 1 the cover' })).toBeNull(); // the cover has no such button
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 2' }));
    expect(hidden()).toEqual(['https://x.example/products/u/c.jpg', START[1]]);
    expect(screen.getByRole('status').textContent).toContain('2 of 6 photos');
  });
  it('at 6 photos adding is disabled', () => {
    render(<ImageUploader initial={Array.from({ length: 6 }, (_, i) => `https://x.example/products/u/${i}.jpg`)} />);
    expect((screen.getByLabelText(/Add photos/) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('6 of 6 photos');
  });
});

describe('ImageUploader: uploading', () => {
  it('asks for permission per file, posts the signed form to S3 with the file last, then keeps the photo', async () => {
    const busy = vi.fn();
    render(<ImageUploader initial={[]} onBusyChange={busy} />);
    pick([file('a.jpg', 'image/jpeg', 1500), file('b.png', 'image/png', 2500)]);
    await waitFor(() => expect(hidden()).toHaveLength(2));
    expect(permissionCalls()).toHaveLength(2);
    const first = JSON.parse(String(permissionCalls()[0][1].body));
    expect(first).toEqual({ contentType: 'image/jpeg', size: 1500 });
    expect(permissionCalls()[0][1].headers['content-type']).toBe('application/json');
    const fd = s3Calls()[0][1].body as FormData;
    const keys = Array.from(fd.keys());
    expect(keys[keys.length - 1]).toBe('file'); expect(keys.slice(0, -1)).toEqual(['key', 'Content-Type']);
    expect(hidden().sort()).toEqual([`${S3}products/u/1.jpg`, `${S3}products/u/2.jpg`]);
    expect(busy).toHaveBeenCalledWith(true);
    await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false));
  });
  it('rejects wrong types, oversize and empty files before any request, naming the file; valid files in the same pick still upload', async () => {
    render(<ImageUploader initial={[]} />);
    pick([file('anim.gif', 'image/gif'), file('logo.svg', 'image/svg+xml'), file('huge.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1), file('empty.jpg', 'image/jpeg', 0), file('fake.jpg', 'image/gif'), file('ok.webp', 'image/webp')]);
    await waitFor(() => expect(hidden()).toHaveLength(1));
    expect(permissionCalls()).toHaveLength(1);
    const alert = screen.getByRole('alert').textContent!;
    for (const n of ['anim.gif', 'logo.svg', 'huge.jpg', 'empty.jpg', 'fake.jpg']) expect(alert).toContain(n);
    expect(alert).not.toContain('ok.webp');
  });
  it('uploads only as many files as there are free slots and says so; the same file picked twice is skipped', async () => {
    render(<ImageUploader initial={['https://x.example/1.jpg', 'https://x.example/2.jpg']} />);
    pick(Array.from({ length: 8 }, (_, i) => file(`n${i}.jpg`, 'image/jpeg', 100 + i)));
    await waitFor(() => expect(hidden()).toHaveLength(6));
    expect(permissionCalls()).toHaveLength(4);
    expect(screen.getByRole('alert').textContent).toContain('Only 4 more photos fit (limit 6).');
    cleanup(); fetchMock.mockClear(); counter = 0;
    render(<ImageUploader initial={[]} />);
    pick([file('same.jpg', 'image/jpeg', 100, 5)]); await waitFor(() => expect(hidden()).toHaveLength(1));
    pick([file('same.jpg', 'image/jpeg', 100, 5)]);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('same.jpg'));
    expect(permissionCalls()).toHaveLength(1);
  });
  it('one failed upload shows its own error and leaves the others', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/uploads/product-image') { const n = ++counter; return reply(200, { url: S3, fields: { key: `k${n}` }, publicUrl: `${S3}products/u/${n}.jpg` }); }
      if (url === S3) { const body = init!.body as FormData; return (body.get('key') === 'k1') ? reply(403) : reply(204); }
      return reply(500);
    });
    render(<ImageUploader initial={[]} />);
    pick([file('bad.jpg', 'image/jpeg'), file('good.jpg', 'image/jpeg')]);
    await waitFor(() => expect(hidden()).toHaveLength(1));
    expect(hidden()[0]).toBe(`${S3}products/u/2.jpg`);
    expect(screen.getByRole('alert').textContent).toContain('bad.jpg');
    fireEvent.click(screen.getByRole('button', { name: /Remove photo 1/ })); // the failed tile can be dismissed
    expect(hidden()).toHaveLength(1);
  });
  it('a refused permission shows its message; a 503 says uploads are not set up, disables adding, and existing photos can still be removed', async () => {
    fetchMock.mockImplementation((url: string) => url === '/api/uploads/product-image' ? reply(503, { error: 'Image uploads are not set up yet.' }) : reply(500));
    render(<ImageUploader initial={START} />);
    pick([file('a.jpg', 'image/jpeg')]);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Image uploads are not set up yet.'));
    expect((screen.getByLabelText(/Add photos/) as HTMLInputElement).disabled).toBe(true);
    expect(hidden()).toEqual(START);
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));
    expect(hidden()).toEqual([START[1]]);
  });
  it('a network error on the permission call or the S3 post is shown on that file', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    render(<ImageUploader initial={[]} />);
    pick([file('a.jpg', 'image/jpeg')]);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/a\.jpg.*(network|could not)/i));
    expect(hidden()).toEqual([]);
  });
});

describe('PostForm integration', () => {
  const props = { role: 'seller' as const, categories: ['Pottery'], workshops: [], sellers: [], onSubmit: vi.fn(async () => null), onCancel: () => undefined };
  it('the old Cover image URL box is gone and the uploader is there', () => {
    render(<PostForm {...props} />);
    expect(document.querySelector('[name="imageUrl"]')).toBeNull();
    expect(screen.getByLabelText(/Add photos/)).toBeTruthy();
  });
  it('Save is disabled and busy while an upload runs, and enabled again after; the saved payload carries the photos in order', async () => {
    let release!: (r: Response) => void;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/uploads/product-image') return reply(200, { url: S3, fields: { key: 'k' }, publicUrl: `${S3}products/u/new.jpg` });
      if (url === S3) return new Promise<Response>(r => { release = r; });
      return reply(500);
    });
    const onSubmit = vi.fn(async (_p: Record<string, unknown>) => null);
    render(<PostForm {...props} onSubmit={onSubmit} initial={{ id: 'p1', name: 'N', category: 'Pottery', cityId: 1, city: 'Jaipur', citySlug: 'jaipur', pricePaise: 100, seller: 'S', description: 'D', stock: 1, status: 'DRAFT', images: START, imageUrl: START[0], sellerId: 'u', sellerEmail: 'e@x.co' } as never} />);
    pick([file('new.jpg', 'image/jpeg')]);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Uploading photos…' }) as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getByRole('button', { name: 'Uploading photos…' }).getAttribute('aria-busy')).toBe('true');
    release({ ok: true, status: 204, json: () => Promise.resolve({}) } as Response);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save post' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].images).toEqual([...START, `${S3}products/u/new.jpg`]);
  });
});
