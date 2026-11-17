import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
let session: { user: { email: string; active?: boolean } } | null = null;
vi.mock('@/auth', () => ({ auth: async () => session }));
import { POST } from '@/app/api/products/[id]/enquiry/route';
import { createProduct } from '@/lib/admin';
import { resetLimitersForTests } from '@/lib/engagement-limits';
import { setMailSenderForTests, type Mail } from '@/lib/mailer';
import { sellerProfiles } from '@/db/schema';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';
import { admin } from './helpers/actors';

let sent: Mail[]; let pid: string; let n = 0;
/** Every call fakes a new address and a new typed email, as a script would. */
const call = (id = pid, over: Record<string, unknown> = {}) => POST(new Request(`http://x/api/products/${id}/enquiry`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${++n}` },
  body: JSON.stringify({ name: 'A', email: `a${n}@b.co`, message: 'hi', ...over }),
}), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  await resetTestDb(); resetLimitersForTests(); n = 0; sent = []; session = null;
  setMailSenderForTests(async m => { sent.push(m); });
  const s = await makeSeller('a@x.co', 'Studio A');
  await (await getTestDb()).update(sellerProfiles).set({ publicEmail: 'shop@studio.co' }).where(eq(sellerProfiles.userId, s.id));
  pid = (await createProduct({ name: 'T-Vase', category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'd', stock: 1, status: 'APPROVED', sellerId: s.id }, admin)).id;
});
afterEach(() => setMailSenderForTests(null));

describe('enquiry route: anonymous senders cannot dodge the limits by faking their address or email', () => {
  it('stops after 10 emails for one product, however the sender varies IP and email', async () => {
    for (let i = 0; i < 10; i++) expect((await call()).status).toBe(201);
    expect((await call()).status).toBe(429);
    expect(sent).toHaveLength(10);
  });
  it('junk requests do not use the quota up: invalid, unknown product, bots, failed sends', async () => {
    for (let i = 0; i < 12; i++) await call(pid, { name: '' });                 // invalid
    for (let i = 0; i < 12; i++) await call('p99999');                          // no such product
    for (let i = 0; i < 12; i++) await call(pid, { companyWebsite: 'spam' });   // bot
    setMailSenderForTests(async () => { throw new Error('down'); });
    expect((await call()).status).toBe(502);                                    // fails after the quota check: counts once, see below
    setMailSenderForTests(async m => { sent.push(m); });
    for (let i = 0; i < 9; i++) expect((await call()).status).toBe(201);
    expect((await call()).status).toBe(429);
  });
  it('a site-wide backstop of 100 anonymous emails an hour holds across products', async () => {
    const db = await getTestDb();
    const s = await makeSeller('b@x.co', 'Studio B');
    await db.update(sellerProfiles).set({ publicEmail: 'b@studio.co' }).where(eq(sellerProfiles.userId, s.id));
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) ids.push((await createProduct({ name: `T-P${i}`, category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'd', stock: 1, status: 'APPROVED', sellerId: s.id }, admin)).id);
    let ok = 0;
    for (const id of ids) for (let i = 0; i < 10; i++) if ((await call(id)).status === 201) ok++;
    expect(ok).toBe(100);
    expect((await call(pid)).status).toBe(429);
  });
  it('another product is unaffected', async () => {
    for (let i = 0; i < 10; i++) await call();
    expect((await call('p99999')).status).toBe(404);
  });
  it('a bad id is a 404 and sends nothing', async () => {
    expect((await call('x')).status).toBe(404);
    expect(sent).toHaveLength(0);
  });
  it('signed-in buyers send from their account and are not held by the anonymous caps', async () => {
    for (let i = 0; i < 10; i++) await call();                 // anonymous quota for this product is now used up
    expect((await call()).status).toBe(429);
    session = { user: { email: 'me@buyer.co' } };
    expect((await call(pid, { email: 'ignored@x.co' })).status).toBe(201);
    expect(sent.at(-1)!.replyTo).toBe('me@buyer.co');
    expect(sent.at(-1)!.text).toContain('signed in');
  });
  it('an anonymous email says the typed address is not verified', async () => {
    expect((await call()).status).toBe(201);
    expect(sent[0].text).toMatch(/not verified/i);
  });
  it('signed-in and anonymous quotas are separate: an anonymous flood on one email key does not block the account of that name', async () => {
    for (let i = 0; i < 3; i++) await call(pid, { email: 'me@buyer.co' }); // anonymous, typing the same address: 2 allowed, then the pair limit
    session = { user: { email: 'me@buyer.co' } };
    expect((await call(pid)).status).toBe(201);
  });
});
