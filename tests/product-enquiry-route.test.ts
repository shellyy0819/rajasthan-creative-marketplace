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

let sent: Mail[]; let pid: string; let pid2: string;
const call = (id = pid, over: Record<string, unknown> = {}) => POST(new Request(`http://x/api/products/${id}/enquiry`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'A', email: 'typed@b.co', message: 'hi', ...over }),
}), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  await resetTestDb(); resetLimitersForTests(); sent = []; session = null;
  setMailSenderForTests(async m => { sent.push(m); });
  const s = await makeSeller('a@x.co', 'Studio A');
  await (await getTestDb()).update(sellerProfiles).set({ publicEmail: 'shop@studio.co' }).where(eq(sellerProfiles.userId, s.id));
  const mk = async (name: string) => (await createProduct({ name, category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'd', stock: 1, status: 'APPROVED', sellerId: s.id }, admin)).id;
  pid = await mk('T-Vase'); pid2 = await mk('T-Bowl');
});
afterEach(() => setMailSenderForTests(null));

describe('enquiry route: only a signed-in buyer has Craftofy send the email', () => {
  it('a visitor who is not signed in gets a 401 and nothing is sent', async () => {
    const r = await call();
    expect(r.status).toBe(401);
    expect(sent).toHaveLength(0);
  });
  it('a signed-in buyer sends from the account email, whatever address was posted', async () => {
    session = { user: { email: 'me@buyer.co' } };
    const r = await call();
    expect(r.status).toBe(201);
    expect(sent[0].replyTo).toBe('me@buyer.co');
  });
  it('an inactive account is treated as signed out', async () => {
    session = { user: { email: 'me@buyer.co', active: false } };
    expect((await call()).status).toBe(401);
  });
  it('allows 2 emails a day to one maker about one product, then 429; another product is unaffected', async () => {
    session = { user: { email: 'me@buyer.co' } };
    expect((await call()).status).toBe(201);
    expect((await call()).status).toBe(201);
    expect((await call()).status).toBe(429);
    expect((await call(pid2)).status).toBe(201);
  });
  it('a bad id is a 404 and sends nothing', async () => {
    session = { user: { email: 'me@buyer.co' } };
    expect((await call('x')).status).toBe(404);
    expect(sent).toHaveLength(0);
  });
});
