import { describe, it, expect } from 'vitest';
import { readJson } from '@/lib/api';

describe('readJson size cap', () => {
  it('rejects by content-length before reading the body', async () => {
    const req = new Request('http://x/api/orders', { method: 'POST', body: '{}', headers: { 'content-length': '2000000', 'content-type': 'application/json' } });
    await expect(readJson(req)).rejects.toMatchObject({ status: 413 });
  });
  it('rejects a streamed body that exceeds the cap', async () => {
    const big = JSON.stringify({ a: 'x'.repeat(1_100_000) });
    await expect(readJson(new Request('http://x/api/orders', { method: 'POST', body: big, headers: { 'content-type': 'application/json' } }))).rejects.toMatchObject({ status: 413 });
  });
  it('parses normal bodies and empty bodies', async () => {
    expect(await readJson(new Request('http://x', { method: 'POST', body: '{"a":1}', headers: { 'content-type': 'application/json; charset=utf-8' } }))).toEqual({ a: 1 });
    expect(await readJson(new Request('http://x', { method: 'POST' }))).toEqual({});
  });
  it('415 for non-JSON content types (blocks cross-site text/plain form posts)', async () => {
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x']) {
      const req = new Request('http://x', { method: 'POST', body: '{"a":1}', headers: { 'content-type': type } });
      await expect(readJson(req)).rejects.toMatchObject({ status: 415 });
    }
    await expect(readJson(new Request('http://x', { method: 'POST', body: '{"a":1}' }))).rejects.toMatchObject({ status: 415 });
  });
});
