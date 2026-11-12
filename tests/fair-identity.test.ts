import { describe, it, expect, vi } from 'vitest';
import { TOKEN_KEY, TOKEN_RE, claim, claimRandom, codeFromSearch, getToken, newToken, withCode } from '@/components/fair/identity';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };
const resp = (status: number) => ({ ok: status >= 200 && status < 300, status } as Response);

describe('the browser\'s secret', () => {
  it('is random hex the server accepts', () => { expect(newToken()).toMatch(TOKEN_RE); expect(newToken()).not.toBe(newToken()); expect(newToken(() => new Uint8Array(16))).toBe('0'.repeat(32)); });
  it('is made once and kept', () => {
    const s = memory(), first = getToken(s);
    expect(s.m.get(TOKEN_KEY)).toBe(first); expect(getToken(s)).toBe(first);
  });
  it('replaces a damaged secret, and still works with storage blocked', () => {
    const s = memory(); s.m.set(TOKEN_KEY, 'not hex');
    expect(getToken(s)).toMatch(TOKEN_RE);
    expect(getToken(null)).toMatch(TOKEN_RE);
    expect(getToken({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } })).toMatch(TOKEN_RE);
  });
});

describe('claim', () => {
  it('says ok, taken or offline', async () => {
    expect(await claim('ABC234', 'a'.repeat(32), vi.fn(async () => resp(200)))).toBe('ok');
    expect(await claim('ABC234', 'a'.repeat(32), vi.fn(async () => resp(409)))).toBe('taken');
    expect(await claim('ABC234', 'a'.repeat(32), vi.fn(async () => resp(500)))).toBe('offline');
    expect(await claim('ABC234', 'a'.repeat(32), vi.fn(async () => resp(429)))).toBe('offline');
    expect(await claim('ABC234', 'a'.repeat(32), vi.fn(async () => { throw new Error('down'); }))).toBe('offline');
  });
  it('sends the code and the secret', async () => {
    const f = vi.fn(async () => resp(200));
    await claim('ABC234', 'b'.repeat(32), f);
    expect(f).toHaveBeenCalledWith('/api/fair/claim', expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: 'ABC234', token: 'b'.repeat(32) }) }));
  });
});

describe('claimRandom', () => {
  it('keeps picking until a code is free', async () => {
    const codes = ['AAAAAA', 'BBBBBB', 'CCCCCC', 'DDDDDD'], f = vi.fn(async (_u: unknown, init?: RequestInit) => resp(['AAAAAA', 'BBBBBB'].includes(JSON.parse(String(init?.body)).code) ? 409 : 200));
    let i = 0;
    const got = await claimRandom('t'.repeat(32), 6, f as unknown as typeof fetch, () => codes[i++ % codes.length]);
    expect(got).toBe('CCCCCC');
  });
  it('gives up after a few tries rather than looping forever', async () => {
    const f = vi.fn(async () => resp(409)); let n = 0;
    const got = await claimRandom('t'.repeat(32), 4, f as unknown as typeof fetch, () => `CODE${n++}`);
    expect(f).toHaveBeenCalledTimes(4); expect(got).toBe('CODE4'.replace('CODE4', got));
  });
  it('plays on when the server is unreachable', async () => {
    const got = await claimRandom('t'.repeat(32), 6, vi.fn(async () => { throw new Error('down'); }) as unknown as typeof fetch, () => 'KKKKKK');
    expect(got).toBe('KKKKKK');
  });
});

describe('the code in the address', () => {
  it('reads a valid code in any case, with or without the dash', () => {
    expect(codeFromSearch('?code=ABC-234')).toBe('ABC234'); expect(codeFromSearch('?code=abc234')).toBe('ABC234'); expect(codeFromSearch('?x=1&code=k7m-q4p')).toBe('K7MQ4P');
  });
  it('ignores a missing or invalid code', () => { for (const s of ['', '?code=', '?code=ABC', '?code=AB0O1L', '?other=ABC-234']) expect(codeFromSearch(s)).toBeNull(); });
  it('writes the code into the address and keeps everything else', () => {
    expect(withCode('/fair', 'ABC234')).toBe('/fair?code=ABC-234');
    expect(withCode('/fair?code=OLD-123&time=night#top', 'ABC234')).toBe('/fair?code=ABC-234&time=night#top');
    expect(withCode('https://craftofy.online/fair?x=1', 'ABC234')).toBe('https://craftofy.online/fair?x=1&code=ABC-234');
  });
});
