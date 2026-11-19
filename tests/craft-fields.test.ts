import { beforeEach, describe, expect, it } from 'vitest';
import { setMailSenderForTests } from '@/lib/mailer';
import { createWorkshop, updateWorkshop } from '@/lib/admin';
import { listWorkshops } from '@/lib/catalog';
import { parseListingFields } from '@/lib/workshop-listing';
import { createWorkshopRequest } from '@/lib/workshop-requests';
import { cityRef } from './helpers/cities';
import { resetTestDb } from './helpers/testdb';

process.env.NEXTAUTH_SECRET = 'test-secret';
beforeEach(async () => { await resetTestDb(); setMailSenderForTests(async () => {}); });

const ok = { kind: 'workshop', mode: 'in_person' };
const craft = {
  makes: [{ title: 'A cotton tote bag', text: 'Printed with a border.' }, { title: 'Two swatches', text: '' }],
  included: ['Blocks and dyes', 'Masala chai'], bring: ['Old clothes'], minAge: 14,
};
const event = { title: 'Block printing', kind: 'workshop', mode: 'in_person', cityRef: cityRef('Jaipur'), venue: 'Rang Studio', date: '2099-02-05', time: '16:00', seats: 12, host: 'Rang Studio', description: 'Print on cotton.', type: 'PAID', pricePaise: 120000 };

describe('craft workshop fields (all optional)', () => {
  it('are empty by default', () => {
    expect(parseListingFields(ok)).toMatchObject({ makes: [], included: [], bring: [], minAge: null });
  });
  it('keep what was given, trimmed, with blank lines dropped; a newline-separated string works for the lists', () => {
    const f = parseListingFields({ ...ok, ...craft, included: ' Blocks and dyes \n\n Masala chai ' });
    expect(f.makes).toEqual([{ title: 'A cotton tote bag', text: 'Printed with a border.' }, { title: 'Two swatches', text: '' }]);
    expect(f.included).toEqual(['Blocks and dyes', 'Masala chai']);
    expect(f.minAge).toBe(14);
  });
  it('are refused when too many, too long, empty-titled, or not a list', () => {
    const bad = (x: object) => expect(() => parseListingFields({ ...ok, ...x })).toThrowError(/makes|included|bring|minAge/);
    bad({ makes: [1, 2, 3, 4].map(n => ({ title: `T${n}`, text: '' })) });
    bad({ makes: [{ title: '', text: 'x' }] });
    bad({ makes: [{ title: 'x'.repeat(61), text: '' }] });
    bad({ makes: [{ title: 'ok', text: 'x'.repeat(121) }] });
    bad({ makes: 'a tote bag' });
    bad({ included: Array.from({ length: 7 }, (_, i) => `item ${i}`) });
    bad({ bring: ['x'.repeat(81)] });
    bad({ minAge: 0 });
    bad({ minAge: 100 });
  });
  it('a public request keeps them, and an admin listing stores and publishes them', async () => {
    const r = await createWorkshopRequest({ hostName: 'Rang Studio', contactName: 'Ravi', phone: '99898 98999', email: 'ravi@example.com', title: 'Block printing', kind: 'workshop', mode: 'in_person', cityRef: cityRef('Jaipur'), venue: 'Rang Studio', description: 'Print.', startDate: '2099-02-05', startTime: '16:00', seats: 12, priceType: 'FREE', ...craft });
    expect(r).toMatchObject({ included: ['Blocks and dyes', 'Masala chai'], bring: ['Old clothes'], minAge: 14 });
    expect(r.makes).toHaveLength(2);
    const w = await createWorkshop({ ...event, status: 'APPROVED', ...craft });
    const pub = (await listWorkshops()).find(x => x.id === w.id)!;
    expect(pub).toMatchObject({ included: ['Blocks and dyes', 'Masala chai'], bring: ['Old clothes'], minAge: 14 });
    expect(pub.makes[0]).toEqual({ title: 'A cotton tote bag', text: 'Printed with a border.' });
  });
  it('an edit can change and clear them', async () => {
    const w = await createWorkshop({ ...event, ...craft });
    const u = await updateWorkshop(w.id, { makes: [], bring: [], minAge: null });
    expect(u).toMatchObject({ makes: [], bring: [], minAge: null, included: ['Blocks and dyes', 'Masala chai'] });
  });
});
