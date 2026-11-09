// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { LogoUpload, LOGO_MESSAGES } from '@/components/onboarding/LogoUpload';

let fetchMock: ReturnType<typeof vi.fn>;
let dims = { width: 500, height: 500 };
let presign: () => { ok: boolean; status: number; body: unknown };
let s3Ok = true;
const PUBLIC = 'https://cdn.example/logos/u1/a.png';

beforeEach(() => {
  dims = { width: 500, height: 500 };
  s3Ok = true;
  presign = () => ({ ok: true, status: 200, body: { url: 'https://s3.example/bucket', fields: { key: 'logos/u1/a.png', policy: 'p' }, publicUrl: PUBLIC } });
  fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/uploads/seller-logo') { const r = presign(); return { ok: r.ok, status: r.status, json: () => Promise.resolve(r.body) } as Response; }
    return { ok: s3Ok, status: s3Ok ? 204 : 403, json: () => Promise.resolve({}) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ ...dims, close: () => {} })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const file = (type = 'image/png', size = 1000) => {
  const f = new File(['x'], 'logo.png', { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};
const mount = () => {
  const onChange = vi.fn(); const onBusyChange = vi.fn();
  render(<LogoUpload value="" onChange={onChange} onBusyChange={onBusyChange} />);
  const input = screen.getByLabelText('Upload photo') as HTMLInputElement;
  const pick = (f: File) => fireEvent.change(input, { target: { files: [f] } });
  return { onChange, onBusyChange, pick };
};
const uploadCalls = () => fetchMock.mock.calls.filter(c => c[0] === '/api/uploads/seller-logo');

describe('LogoUpload', () => {
  it('logo under 400x400 rejected with message', async () => {
    dims = { width: 399, height: 800 };
    const { pick, onChange } = mount();
    pick(file());
    expect((await screen.findByRole('alert')).textContent).toBe(LOGO_MESSAGES.small);
    expect(LOGO_MESSAGES.small).toMatch(/400 by 400/);
    expect(uploadCalls()).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });
  it('accepts exactly 400x400', async () => {
    dims = { width: 400, height: 400 };
    const { pick, onChange } = mount();
    pick(file());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(PUBLIC));
  });
  it('rejects other file types before any request', async () => {
    const { pick } = mount();
    pick(file('image/webp'));
    expect((await screen.findByRole('alert')).textContent).toBe(LOGO_MESSAGES.type);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects files over 5 MiB before any request', async () => {
    const { pick } = mount();
    pick(file('image/png', 5 * 1024 * 1024 + 1));
    expect((await screen.findByRole('alert')).textContent).toBe(LOGO_MESSAGES.size);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('presigns, posts to S3 with the file last, and reports the public URL and busy state', async () => {
    const { pick, onChange, onBusyChange } = mount();
    pick(file());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(PUBLIC));
    const body = JSON.parse(uploadCalls()[0][1].body as string);
    expect(body).toEqual({ contentType: 'image/png', size: 1000 });
    const s3 = fetchMock.mock.calls.find(c => c[0] === 'https://s3.example/bucket')!;
    const keys = Array.from((s3[1].body as FormData).keys());
    expect(keys[keys.length - 1]).toBe('file');
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });
  it('logo upload failure shows retry', async () => {
    s3Ok = false;
    const { pick, onChange } = mount();
    pick(file());
    expect((await screen.findByRole('alert')).textContent).toBe(LOGO_MESSAGES.failed);
    s3Ok = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(PUBLIC));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(uploadCalls()).toHaveLength(2);
  });
  it('a network error shows retry', async () => {
    fetchMock.mockImplementationOnce(async () => { throw new TypeError('offline'); });
    const { pick } = mount();
    pick(file());
    expect((await screen.findByRole('alert')).textContent).toBe(LOGO_MESSAGES.network);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
  it('storage unavailable (503) shows message', async () => {
    presign = () => ({ ok: false, status: 503, body: { error: 'Image uploads are not set up yet.' } });
    const { pick, onChange } = mount();
    pick(file());
    expect((await screen.findByRole('alert')).textContent).toBe(LOGO_MESSAGES.notSetUp);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
