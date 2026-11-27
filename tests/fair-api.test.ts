import { describe, it, expect, beforeEach, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { POST as PRESENCE } from '@/app/api/fair/presence/route';
import { POST as CLAIM } from '@/app/api/fair/claim/route';
import { POST as NOTES } from '@/app/api/fair/notes/route';
import { POST as EVENTS } from '@/app/api/fair/events/route';
import { POST as QUESTS } from '@/app/api/fair/quests/route';
import { POST as HISTORY } from '@/app/api/fair/quests/history/route';
import { DELETE as DELETE_NOTE } from '@/app/api/admin/fair/notes/[id]/route';
import { GET, PUT } from '@/app/api/admin/settings/fair/route';
import { getFairSettings } from '@/lib/fair-settings';
import { DEFAULT_MELA } from '@/lib/fair-mela';
import { listNotes } from '@/lib/fair-notes';
import { fairEvents } from '@/db/schema';
import { claimCode } from '@/lib/fair-codes';
import { CODE_ALPHABET } from '@/lib/fair-constants';
import { getTestDb, resetTestDb } from './helpers/testdb';

const A = 'a'.repeat(32), B = 'b'.repeat(32);
const UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36';
let ip = 0;
const post = (url: string, body: unknown, headers: Record<string, string> = {}) => new Request(`http://x${url}`, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA, 'x-forwarded-for': `203.0.113.${(ip = (ip + 1) % 250)}`, ...headers }, body: JSON.stringify(body) });
const put = (body: unknown) => new Request('http://x/api', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const as = (role: string) => authMock.mockResolvedValue({ user: { email: `${role}@x.co`, role } });
const beat = (code: string, o: Record<string, unknown> = {}) => ({ code, token: A, x: 5, y: 300, facing: 'up', ...o });
beforeEach(async () => { await resetTestDb(); authMock.mockReset(); authMock.mockResolvedValue(null); });

describe('POST /api/fair/presence', () => {
  it('needs no sign-in and answers with the others and the head count', async () => {
    await PRESENCE(post('/api/fair/presence', beat('AAAAAA')));
    const res = await PRESENCE(post('/api/fair/presence', beat('BBBBBB', { token: B, x: 9, y: 301, facing: 'left', look: 'm1' })));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.visitors).toEqual([expect.objectContaining({ code: 'AAAAAA', x: 5, y: 300, facing: 'up', look: null })]);
  });
  it('refuses a code that belongs to someone else', async () => {
    await PRESENCE(post('/api/fair/presence', beat('AAAAAA')));
    const res = await PRESENCE(post('/api/fair/presence', beat('AAAAAA', { token: B })));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Code already taken.');
  });
  it('rejects bad input with a specific message', async () => {
    const res = await PRESENCE(post('/api/fair/presence', beat('nope')));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/code/);
  });
  it('turns crawlers away', async () => {
    expect((await PRESENCE(post('/api/fair/presence', beat('CCCCCC'), { 'user-agent': 'Googlebot/2.1' }))).status).toBe(403);
  });
  it('limits how fast one code can send heartbeats', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 14; i++) codes.push((await PRESENCE(post('/api/fair/presence', beat('DDDDDD')))).status);
    expect(codes.slice(0, 12).every(s => s === 200)).toBe(true);
    expect(codes.slice(12)).toEqual([429, 429]);
  });
});

describe('POST /api/fair/claim', () => {
  it('first come, first served', async () => {
    const first = await CLAIM(post('/api/fair/claim', { code: 'KMQ234', token: A }));
    expect(first.status).toBe(200);
    expect((await CLAIM(post('/api/fair/claim', { code: 'KMQ234', token: A }))).status).toBe(200);
    const second = await CLAIM(post('/api/fair/claim', { code: 'KMQ234', token: B }));
    expect(second.status).toBe(409);
    expect((await second.json()).error).toBe('Code already taken.');
  });
  it('validates and turns crawlers away', async () => {
    expect((await CLAIM(post('/api/fair/claim', { code: 'x', token: A }))).status).toBe(400);
    expect((await CLAIM(post('/api/fair/claim', { code: 'KMQ234', token: 'x' }))).status).toBe(400);
    expect((await CLAIM(post('/api/fair/claim', { code: 'KMQ234', token: A }, { 'user-agent': 'curl/8' }))).status).toBe(403);
  });
});

describe('POST /api/fair/notes', () => {
  const note = (o: Record<string, unknown> = {}) => ({ code: 'NTE234', token: A, stall: 'Bandhej Boutique', text: 'Lovely fair', rating: 5, source: 'sample', ...o });
  it('saves a note for the admin', async () => {
    const res = await NOTES(post('/api/fair/notes', note()));
    expect(res.status).toBe(201);
    expect(await listNotes()).toEqual([expect.objectContaining({ code: 'NTE234', text: 'Lovely fair', rating: 5 })]);
  });
  it('refuses a note under someone else\'s code, or without words', async () => {
    await NOTES(post('/api/fair/notes', note()));
    expect((await NOTES(post('/api/fair/notes', note({ token: B })))).status).toBe(409);
    const empty = await NOTES(post('/api/fair/notes', note({ text: '  ' })));
    expect(empty.status).toBe(400);
    expect((await empty.json()).error).toMatch(/few words/);
    expect(await listNotes()).toHaveLength(1);
  });
  it('limits how many notes one code can send in an hour', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await NOTES(post('/api/fair/notes', note({ code: 'SPAM23', text: `note ${i}` })))).status);
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });
});

describe('POST /api/fair/events', () => {
  const ev = (o: Record<string, unknown> = {}) => ({ code: 'EVT234', token: A, events: [{ kind: 'stall', detail: 'dhaga' }, { kind: 'quest', detail: 'meet3' }], ...o });
  it('needs no sign-in and saves what the player did', async () => {
    const res = await EVENTS(post('/api/fair/events', ev()));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ saved: 2 });
    expect((await (await getTestDb()).select().from(fairEvents)).map(r => [r.code, r.kind])).toEqual([['EVT234', 'stall'], ['EVT234', 'quest']]);
  });
  it('refuses a code that belongs to someone else, a batch that is too big and a robot', async () => {
    await EVENTS(post('/api/fair/events', ev()));
    expect((await EVENTS(post('/api/fair/events', ev({ token: B })))).status).toBe(409);
    expect((await EVENTS(post('/api/fair/events', ev({ events: Array.from({ length: 11 }, () => ({ kind: 'stall', detail: 'x' })) })))).status).toBe(400);
    expect((await EVENTS(post('/api/fair/events', ev(), { 'user-agent': 'Googlebot/2.1' }))).status).toBe(403);
    expect(await (await getTestDb()).select().from(fairEvents)).toHaveLength(2);
  });
  it('limits how many calls one code can send in a minute', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 32; i++) statuses.push((await EVENTS(post('/api/fair/events', ev({ code: 'SPAM23', events: [{ kind: 'stall', detail: `m${i}` }] })))).status);
    expect(statuses.slice(0, 30).every(s => s === 200)).toBe(true);
    expect(statuses[31]).toBe(429);
  });
});

describe('POST /api/fair/events: a caller cannot pick the address it is limited by', () => {
  const fresh = (code: string, o: Record<string, unknown> = {}) => ({ code, token: A, events: [{ kind: 'stall', detail: 'dhaga' }], ...o });
  // The address our own proxy saw is the last X-Forwarded-For entry; the entries before it are whatever the caller typed.
  const behindProxy = (i: number) => ({ 'x-forwarded-for': `10.${i % 250}.${Math.floor(i / 250)}.7, 198.51.100.77` });
  const codeNo = (i: number) => [...Array(6)].map((_, k) => CODE_ALPHABET[Math.floor(i / CODE_ALPHABET.length ** k) % CODE_ALPHABET.length]).join('');

  it('keeps counting one proxy address however the earlier entries change, so new codes stop at 20 an hour', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) statuses.push((await EVENTS(post('/api/fair/events', fresh(codeNo(i)), behindProxy(i)))).status);
    expect(statuses.slice(0, 20).every(s => s === 200)).toBe(true);
    expect(statuses.slice(20)).toEqual([429, 429]);
    expect(await (await getTestDb()).select().from(fairEvents)).toHaveLength(20);
  });

  it('does not charge a code that already exists against the new-code limit', async () => {
    await claimCode({ code: codeNo(900), token: A });
    for (let i = 0; i < 25; i++) expect((await EVENTS(post('/api/fair/events', fresh(codeNo(900), { events: [{ kind: 'stall', detail: `s${i}` }] }), { 'x-forwarded-for': '198.51.100.88' }))).status).toBe(200);
  });

  it('limits calls per proxy address (120 a minute) even when the earlier entries differ', async () => {
    for (let i = 0; i < 125; i++) await claimCode({ code: codeNo(1000 + i), token: A });
    const statuses: number[] = [];
    for (let i = 0; i < 125; i++) statuses.push((await EVENTS(post('/api/fair/events', fresh(codeNo(1000 + i)), { 'x-forwarded-for': `10.9.${i}.1, 198.51.100.66` }))).status);
    expect(statuses.filter(s => s === 200)).toHaveLength(120);
    expect(statuses.slice(120).every(s => s === 429)).toBe(true);
  });
});

describe('quest progress', () => {
  const day = (o: Record<string, unknown> = {}) => ({ code: 'QST234', token: A, day: '2026-11-12', quests: [{ id: 'meet3', title: 'Meet 3 makers', target: 3 }], progress: { meet3: ['dhaga'] }, ...o });
  it('is saved under a code and read back, for its owner only', async () => {
    expect((await QUESTS(post('/api/fair/quests', day()))).status).toBe(204);
    const res = await HISTORY(post('/api/fair/quests/history', { code: 'QST234', token: A }));
    expect(res.status).toBe(200);
    expect((await res.json()).days).toEqual([expect.objectContaining({ day: '2026-11-12', progress: { meet3: ['dhaga'] } })]);
    expect((await HISTORY(post('/api/fair/quests/history', { code: 'QST234', token: B }))).status).toBe(409);
    expect((await QUESTS(post('/api/fair/quests', day({ token: B })))).status).toBe(409);
  });
  it('rejects bad input', async () => { expect((await QUESTS(post('/api/fair/quests', day({ day: 'today' })))).status).toBe(400); });
});

describe('admin: notes and settings', () => {
  it('only an admin can delete a note', async () => {
    await NOTES(post('/api/fair/notes', { code: 'DEK234', token: A, stall: 'x', text: 'hello', source: 'real' }));
    const [{ id }] = await listNotes();
    const ctx = { params: Promise.resolve({ id: String(id) }) };
    expect((await DELETE_NOTE(new Request('http://x'), ctx)).status).toBe(401);
    as('seller'); expect((await DELETE_NOTE(new Request('http://x'), ctx)).status).toBe(403);
    as('admin');
    expect((await DELETE_NOTE(new Request('http://x'), { params: Promise.resolve({ id: 'abc' }) })).status).toBe(404);
    expect((await DELETE_NOTE(new Request('http://x'), ctx)).status).toBe(204);
    expect(await listNotes()).toEqual([]);
    expect((await DELETE_NOTE(new Request('http://x'), ctx)).status).toBe(404);
  });
  it('the fair settings default to sample makers and are admin only', async () => {
    expect(await getFairSettings()).toEqual({ enabled: true, source: 'sample', mela: DEFAULT_MELA });
    expect((await GET()).status).toBe(401);
    for (const role of ['customer', 'seller']) { as(role); expect((await GET()).status).toBe(403); expect((await PUT(put({ source: 'real' }))).status).toBe(403); }
  });
  it('saves the switch, reads it back and rejects anything else', async () => {
    as('admin');
    expect((await PUT(put({ source: 'real' }))).status).toBe(200);
    expect(await (await GET()).json()).toEqual({ enabled: true, source: 'real', mela: DEFAULT_MELA });
    expect(await getFairSettings()).toEqual({ enabled: true, source: 'real', mela: DEFAULT_MELA });
    expect((await PUT(put({ source: 'sample' }))).status).toBe(200);
    expect(await getFairSettings()).toEqual({ enabled: true, source: 'sample', mela: DEFAULT_MELA });
    expect((await PUT(put({ source: 'both' }))).status).toBe(400);
    expect((await PUT(put({ enabled: 'no' }))).status).toBe(400);
    expect((await PUT(put({}))).status).toBe(400);
  });
  it('keeps the Pushkar dates an admin sets, switches the week off with null, and refuses dates that do not hold together', async () => {
    as('admin');
    const next = { trade: ['2027-11-06', '2027-11-09'], culture: ['2027-11-10', '2027-11-12'], purnima: '2027-11-13' };
    expect((await PUT(put({ mela: next }))).status).toBe(200);
    expect((await getFairSettings()).mela).toEqual(next);
    expect((await PUT(put({ enabled: false }))).status).toBe(200); // other fields leave the dates alone
    expect((await getFairSettings()).mela).toEqual(next);
    expect((await PUT(put({ mela: { ...next, purnima: '2027-11-08' } }))).status).toBe(400); // out of order
    expect((await PUT(put({ mela: { ...next, purnima: '2027-13-40' } }))).status).toBe(400); // not a date
    expect((await getFairSettings()).mela).toEqual(next);
    expect((await PUT(put({ mela: null }))).status).toBe(200);
    expect((await getFairSettings()).mela).toBeNull();
  });
});

describe('closing the whole fair', () => {
  it('saves the switch without touching the makers choice, and back', async () => {
    as('admin');
    await PUT(put({ source: 'real' }));
    expect((await PUT(put({ enabled: false }))).status).toBe(200);
    expect(await getFairSettings()).toEqual({ enabled: false, source: 'real', mela: DEFAULT_MELA });
    expect((await PUT(put({ enabled: true }))).status).toBe(200);
    expect(await getFairSettings()).toEqual({ enabled: true, source: 'real', mela: DEFAULT_MELA });
  });
  it('an older saved value without the switch counts as open', async () => {
    const { getDb } = await import('@/db/client');
    const { appSettings } = await import('@/db/schema');
    await getDb().insert(appSettings).values({ key: 'fair', value: { source: 'real' }, updatedBy: 'x@x.co' });
    expect(await getFairSettings()).toEqual({ enabled: true, source: 'real', mela: DEFAULT_MELA });
  });
  it('every visitor endpoint answers 404 and stores nothing while it is closed', async () => {
    as('admin'); await PUT(put({ enabled: false })); authMock.mockResolvedValue(null);
    expect((await PRESENCE(post('/api/fair/presence', beat('AAAAAA')))).status).toBe(404);
    expect((await CLAIM(post('/api/fair/claim', { code: 'AAAAAA', token: A }))).status).toBe(404);
    expect((await NOTES(post('/api/fair/notes', { code: 'AAAAAA', token: A, text: 'hello there' }))).status).toBe(404);
    expect((await QUESTS(post('/api/fair/quests', { code: 'AAAAAA', token: A }))).status).toBe(404);
    expect((await EVENTS(post('/api/fair/events', { code: 'AAAAAA', token: A, events: [{ kind: 'stall', detail: 'x' }] }))).status).toBe(404);
    expect((await HISTORY(post('/api/fair/quests/history', { code: 'AAAAAA', token: A }))).status).toBe(404);
    expect(await listNotes()).toEqual([]);
    as('admin'); await PUT(put({ enabled: true })); authMock.mockResolvedValue(null);
    expect((await PRESENCE(post('/api/fair/presence', beat('AAAAAA')))).status).toBe(200);
  });
});
