import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createProduct } from '@/lib/admin';
import { setMailSenderForTests, type Mail } from '@/lib/mailer';
import { sendProductEnquiry } from '@/lib/product-enquiry';
import { sellerProfiles } from '@/db/schema';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';
import { admin } from './helpers/actors';

let sent: Mail[];
let pid: string;
const good = { name: 'Asha Buyer', email: 'asha@buyer.co', message: 'Hi Studio A, I saw T-Vase (₹1) on Craftofy and I’m interested.' };

async function setup(publicEmail: string | null) {
  const s = await makeSeller('a@x.co', 'Studio A');
  await (await getTestDb()).update(sellerProfiles).set({ publicEmail }).where(eq(sellerProfiles.userId, s.id));
  const made = await createProduct({ name: 'T-Vase', category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'd', stock: 1, status: 'APPROVED', sellerId: s.id }, admin);
  pid = made.id;
}
beforeEach(async () => { await resetTestDb(); sent = []; setMailSenderForTests(async m => { sent.push(m); }); });
afterEach(() => setMailSenderForTests(null));

describe('sendProductEnquiry', () => {
  it('emails the seller’s public address, replies go to the buyer, and returns the mail for the buyer to see', async () => {
    await setup('shop@studio.co');
    const r = await sendProductEnquiry(pid, good);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('shop@studio.co');
    expect(sent[0].replyTo).toBe('asha@buyer.co');
    expect(sent[0].subject).toBe('Enquiry about T-Vase on Craftofy');
    expect(sent[0].text).toContain(good.message);
    expect(sent[0].text).toContain('Asha Buyer <asha@buyer.co>');
    expect(sent[0].text).toMatch(/\/products\/t-vase-p\d+/i);
    expect(r).toEqual({ seller: 'Studio A', to: 'shop@studio.co', subject: sent[0].subject, text: sent[0].text });
  });
  it('never mails an address the buyer supplies: only the seller’s public one', async () => {
    await setup('shop@studio.co');
    await sendProductEnquiry(pid, { ...good, to: 'victim@x.co', cc: 'victim@x.co' } as never);
    expect(sent[0].to).toBe('shop@studio.co');
  });
  it('409s when the seller shares no email, and sends nothing', async () => {
    await setup(null);
    await expect(sendProductEnquiry(pid, good)).rejects.toMatchObject({ status: 409 });
    expect(sent).toHaveLength(0);
  });
  it('404s for an unknown or unapproved product', async () => {
    await setup('shop@studio.co');
    await expect(sendProductEnquiry('p99999', good)).rejects.toMatchObject({ status: 404 });
  });
  it.each([
    ['name', { ...good, name: '' }], ['email', { ...good, email: 'not-an-email' }], ['message', { ...good, message: '   ' }],
    ['long message', { ...good, message: 'x'.repeat(1001) }], ['long name', { ...good, name: 'x'.repeat(101) }],
  ])('400s on a bad %s', async (_l, body) => {
    await setup('shop@studio.co');
    await expect(sendProductEnquiry(pid, body)).rejects.toMatchObject({ status: 400 });
    expect(sent).toHaveLength(0);
  });
  it('a newline in the buyer’s name cannot add mail headers or lines to the subject', async () => {
    await setup('shop@studio.co');
    await sendProductEnquiry(pid, { ...good, name: 'Asha\r\nBcc: x@y.co' });
    expect(sent[0].subject).not.toMatch(/[\r\n]/);
    expect(sent[0].text).toContain('Asha Bcc: x@y.co <asha@buyer.co>');
  });
  it('the hidden website field marks a bot: pretends success, sends nothing', async () => {
    await setup('shop@studio.co');
    const r = await sendProductEnquiry(pid, { ...good, companyWebsite: 'http://spam' });
    expect(sent).toHaveLength(0);
    expect(r.seller).toBe('Studio A');
  });
  it('says in the mail that a typed-in address is not verified', async () => {
    await setup('shop@studio.co');
    await sendProductEnquiry(pid, good);
    expect(sent[0].text).toMatch(/not verified/i);
  });
  it('a signed-in buyer: the account email wins over whatever was posted, and the mail says it is verified', async () => {
    await setup('shop@studio.co');
    await sendProductEnquiry(pid, { ...good, email: 'someone-else@x.co' }, { signedInEmail: 'me@buyer.co' });
    expect(sent[0].replyTo).toBe('me@buyer.co');
    expect(sent[0].text).toContain('<me@buyer.co>');
    expect(sent[0].text).not.toContain('someone-else@x.co');
    expect(sent[0].text).toMatch(/signed in/i);
    expect(sent[0].text).not.toMatch(/not verified/i);
  });
  it('a mail failure is a 502 with a plain message, not the provider’s text', async () => {
    await setup('shop@studio.co');
    setMailSenderForTests(async () => { throw new Error('Resend refused the email (403): secret details'); });
    await expect(sendProductEnquiry(pid, good)).rejects.toMatchObject({ status: 502, message: expect.not.stringContaining('secret') });
  });
});
