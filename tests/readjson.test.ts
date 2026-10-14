import { describe, it, expect } from 'vitest';
import { readJson } from '@/lib/api';

describe('readJson size cap', () => {
  it('rejects by content-length before reading the body', async () => {
    const req = new Request('http://x/api/orders', { method: 'POST', body: '{}', headers: { 'content-length': '2000000' } });
    await expect(readJson(req)).rejects.toMatchObject({ status: 413 });
  });
  it('rejects a streamed body that exceeds the cap', async () => {
    const big = JSON.stringify({ a: 'x'.repeat(1_100_000) });
    await expect(readJson(new Request('http://x/api/orders', { method: 'POST', body: big }))).rejects.toMatchObject({ status: 413 });
  });
  it('parses normal bodies and empty bodies', async () => {
    expect(await readJson(new Request('http://x', { method: 'POST', body: '{"a":1}' }))).toEqual({ a: 1 });
    expect(await readJson(new Request('http://x', { method: 'POST' }))).toEqual({});
  });
});
