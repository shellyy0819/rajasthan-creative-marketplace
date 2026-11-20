import { beforeEach, describe, expect, it } from 'vitest';
import { setMailSenderForTests } from '@/lib/mailer';
import { createWorkshop, updateWorkshop } from '@/lib/admin';
import { listWorkshops } from '@/lib/catalog';
import { createWorkshopRequest } from '@/lib/workshop-requests';
import { resetTestDb } from './helpers/testdb';

process.env.NEXTAUTH_SECRET = 'test-secret';
beforeEach(async () => { await resetTestDb(); setMailSenderForTests(async () => {}); });

const cls = () => ({
  hostName: 'Asha Yoga', contactName: 'Asha Rao', phone: '99898 98999', email: 'asha@example.com', title: 'Morning Flow', kind: 'class', mode: 'online',
  description: 'Gentle hatha yoga.', startDate: '2027-01-05', platform: 'Zoom', schedule: { days: ['mon'], time: '07:00', durationMin: 60 },
});
const listing = { title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'Asha', description: 'Gentle yoga.', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, contactPhone: '9989898999', status: 'APPROVED' };

const publicOne = async (id: string) => (await listWorkshops()).find(x => x.id === id)!;

describe('showing the host phone number to the audience (a choice, off by default)', () => {
  it('a request keeps the choice, and it is off unless the host ticked it', async () => {
    expect((await createWorkshopRequest({ ...cls(), instagram: '@asha' })).phonePublic).toBe(false);
    expect((await createWorkshopRequest({ ...cls(), instagram: '@asha', phonePublic: false })).phonePublic).toBe(false);
    expect((await createWorkshopRequest({ ...cls(), instagram: '@asha', phonePublic: true })).phonePublic).toBe(true);
  });
  it('an online class request with the phone shown needs no other public contact; without it, it still does', async () => {
    await expect(createWorkshopRequest({ ...cls(), phonePublic: true })).resolves.toMatchObject({ phonePublic: true });
    await expect(createWorkshopRequest(cls())).rejects.toMatchObject({ status: 400 });
  });
  it('a listing with the choice on shows its phone on the public side, and nothing else leaks', async () => {
    const made = await createWorkshop({ ...listing, phonePublic: true, contactEmail: 'private@x.co' });
    const w = await publicOne(made.id);
    expect(w.publicPhone).toBe('+919989898999');
    expect(JSON.stringify(w)).not.toContain('private@x.co');
    expect('contactPhone' in w).toBe(false);
  });
  it('a listing with the choice off keeps the number out of everything public', async () => {
    const made = await createWorkshop({ ...listing, instagram: 'asha', phonePublic: false });
    const w = await publicOne(made.id);
    expect(w.publicPhone).toBeUndefined();
    expect(JSON.stringify(w)).not.toContain('9989898999');
  });
  it('the choice needs a phone number to show, and a published class can use the shown phone as its public contact', async () => {
    await expect(createWorkshop({ ...listing, contactPhone: undefined, instagram: 'asha', phonePublic: true })).rejects.toMatchObject({ status: 400 });
    await expect(createWorkshop({ ...listing, phonePublic: true })).resolves.toMatchObject({ phonePublic: true });
    await expect(createWorkshop({ ...listing })).rejects.toMatchObject({ status: 400 });
  });
  it('turning it off later hides the number again', async () => {
    const w = await createWorkshop({ ...listing, phonePublic: true });
    await updateWorkshop(w.id, { phonePublic: false, instagram: 'asha' });
    expect((await publicOne(w.id)).publicPhone).toBeUndefined();
  });
});
