import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/auth', () => ({ auth: async () => null }));
const send = vi.fn(async () => ({ seller: 'S', subject: 's', text: 't' }));
vi.mock('@/lib/product-enquiry', () => ({ sendProductEnquiry: (...a: unknown[]) => send(...(a as [])) }));
import { POST } from '@/app/api/products/[id]/enquiry/route';
import { resetLimitersForTests } from '@/lib/engagement-limits';

let n = 0;
/** Every call fakes a new address and a new typed email, as a script would. */
const call = (id = 'p1') => POST(new Request(`http://x/api/products/${id}/enquiry`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${++n}` },
  body: JSON.stringify({ name: 'A', email: `a${n}@b.co`, message: 'hi' }),
}), { params: Promise.resolve({ id }) });

beforeEach(() => { n = 0; send.mockClear(); resetLimitersForTests(); });

describe('enquiry route: anonymous senders cannot dodge the limits by faking their address or email', () => {
  it('stops after 10 anonymous emails for one product, however the sender varies IP and email', async () => {
    for (let i = 0; i < 10; i++) expect((await call()).status).toBe(201);
    expect((await call()).status).toBe(429);
    expect(send).toHaveBeenCalledTimes(10);
  });
  it('another product is unaffected', async () => {
    for (let i = 0; i < 10; i++) await call('p1');
    expect((await call('p2')).status).toBe(201);
  });
  it('a bad id is a 404 and sends nothing', async () => {
    expect((await call('x')).status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });
});
