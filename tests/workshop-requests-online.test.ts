import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { workshopRequests, workshopTopics } from '@/db/schema';
import { setMailSenderForTests } from '@/lib/mailer';
import { signCityRef } from '@/lib/city-ref';
import { createWorkshopRequest, KIND_LABEL, listWorkshopRequests, verifyWorkshopRequestCode, type WorkshopRequest } from '@/lib/workshop-requests';
import { notificationMail } from '@/lib/workshop-notify';
import { getTestDb, resetTestDb } from './helpers/testdb';

process.env.NEXTAUTH_SECRET = 'test-secret';
let yogaId = 0;
beforeEach(async () => {
  const d = await resetTestDb();
  setMailSenderForTests(async () => {});
  yogaId = (await d.select().from(workshopTopics).where(eq(workshopTopics.slug, 'yoga')))[0].id;
});
const online = () => ({
  hostName: 'Asha Yoga', contactName: 'Asha Rao', phone: '99898 98999', email: 'asha@example.com', title: 'Morning Flow', kind: 'class', mode: 'online', topicId: yogaId,
  description: 'Gentle hatha yoga.', startDate: '2027-01-05', platform: 'Zoom', schedule: { days: ['mon', 'wed', 'fri'], time: '07:00', durationMin: 60 },
  languages: ['Hindi', 'English'], level: 'beginner', experience: '8 years', certifications: 'RYT 500', freeTrial: true, whatsapp: '99898 98999', instagram: '@asha.yoga',
  prices: [{ label: 'Per session', amountPaise: 50000, sessions: 1 }, { label: 'Monthly', amountPaise: 150000, sessions: 12 }, { label: 'Quarterly', amountPaise: 400000, sessions: 36 }],
});

describe('an online class request', () => {
  it('is stored with no city or venue, the schedule, price plans and details', async () => {
    const r = await createWorkshopRequest(online());
    expect(r).toMatchObject({ mode: 'online', kind: 'class', city: '', venue: '', platform: 'Zoom', level: 'beginner', freeTrial: true, whatsapp: '+919989898999', priceType: 'PAID', pricePaise: 50000, topicId: yogaId, startTime: '07:00', endDate: '2027-01-05' });
    expect(r.languages).toEqual(['Hindi', 'English']);
    expect(r.prices).toHaveLength(3);
    const [row] = await (await getTestDb()).select().from(workshopRequests).where(eq(workshopRequests.id, r.id));
    expect(row).toMatchObject({ city: null, venue: null, seats: null, mode: 'online', kind: 'class', endsOn: '2027-01-05' }); // no end date means it ends on the start date
  });
  it('ignores a venue and city sent with an online request', async () => {
    const r = await createWorkshopRequest({ ...online(), venue: 'Somewhere', seats: 10 });
    const [row] = await (await getTestDb()).select().from(workshopRequests).where(eq(workshopRequests.id, r.id));
    expect(row).toMatchObject({ city: null, venue: null, seats: null });
  });
  it('keeps an optional city for an online class, from the city search, to see where instructors are from', async () => {
    const cityRef = signCityRef({ osmType: 'R', osmId: 2, name: 'Udaipur', state: 'Rajasthan', lat: 24.58, lng: 73.68 });
    const r = await createWorkshopRequest({ ...online(), cityRef });
    expect(r.city).toBe('Udaipur, Rajasthan');
    const [row] = await (await getTestDb()).select().from(workshopRequests).where(eq(workshopRequests.id, r.id));
    expect(row).toMatchObject({ city: 'Udaipur, Rajasthan', venue: null, seats: null });
  });
  it('an online class may leave the city out (empty or missing), but a made-up one is refused', async () => {
    for (const cityRef of [undefined, null, '']) {
      const r = await createWorkshopRequest({ ...online(), cityRef });
      expect(r.city).toBe('');
    }
    await expect(createWorkshopRequest({ ...online(), cityRef: 'Udaipur' })).rejects.toMatchObject({ status: 400, message: 'Invalid city selection.' });
  });
  it('with no end date the classes end on the start date', async () => {
    const r = await createWorkshopRequest(online());
    expect(r).toMatchObject({ startDate: '2027-01-05', endDate: '2027-01-05', endsOn: '2027-01-05' });
  });
  it('an end date for a class is kept as endsOn and cannot precede the start', async () => {
    const r = await createWorkshopRequest({ ...online(), endsOn: '2027-03-31' });
    expect(r).toMatchObject({ endsOn: '2027-03-31', endDate: '2027-03-31' });
    await expect(createWorkshopRequest({ ...online(), endsOn: '2027-01-01' })).rejects.toMatchObject({ status: 400 });
  });
  it('rejects a missing schedule or platform, a hybrid mode and an unknown topic', async () => {
    await expect(createWorkshopRequest({ ...online(), schedule: undefined })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/schedule/) });
    await expect(createWorkshopRequest({ ...online(), platform: '' })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/platform/) });
    await expect(createWorkshopRequest({ ...online(), mode: 'hybrid' })).rejects.toMatchObject({ status: 400 });
    await expect(createWorkshopRequest({ ...online(), topicId: 9999 })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/topic/) });
  });
  it('keeps the private meeting link', async () => {
    const r = await createWorkshopRequest({ ...online(), joinLink: 'https://meet.google.com/abc-defg-hij' });
    expect(r.joinLink).toBe('https://meet.google.com/abc-defg-hij');
    expect(notificationMail(r, KIND_LABEL.class).text).toContain('Meeting link: https://meet.google.com/abc-defg-hij');
  });
  it('keeps how many days the free trial lasts', async () => {
    const r = await createWorkshopRequest({ ...online(), freeTrialDays: 7 });
    expect(r).toMatchObject({ freeTrial: true, freeTrialDays: 7 });
    expect(await createWorkshopRequest({ ...online() })).not.toHaveProperty('freeTrialDays');
  });
  it('a free class (no price plans) is FREE', async () => {
    expect(await createWorkshopRequest({ ...online(), prices: [], priceType: undefined })).toMatchObject({ priceType: 'FREE' });
  });
  it('an in-person request still needs a city and venue and cannot be a class', async () => {
    const inPerson = { ...online(), mode: 'in_person', kind: 'workshop', platform: undefined, schedule: undefined };
    await expect(createWorkshopRequest({ ...inPerson, venue: 'x', priceType: 'FREE' })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/city/) });
    await expect(createWorkshopRequest({ ...inPerson, kind: 'class', venue: 'x', priceType: 'FREE' })).rejects.toMatchObject({ status: 400 });
  });
  it('shows up in the admin list once verified, with the topic', async () => {
    const r = await createWorkshopRequest(online());
    const d = await getTestDb();
    await d.update(workshopRequests).set({ status: 'received' }).where(eq(workshopRequests.id, r.id));
    const [listed] = await listWorkshopRequests();
    expect(listed).toMatchObject({ id: r.id, topic: 'Yoga', mode: 'online' });
    void verifyWorkshopRequestCode;
  });
});

describe('the team email for an online class', () => {
  it('lists mode, topic, platform, schedule, plans, languages, level, experience, certifications, trial and WhatsApp', () => {
    const r = { id: 'x', hostName: 'Asha Yoga', contactName: 'Asha', phone: '+919989898999', email: 'a@b.co', city: '', venue: '', title: 'Morning Flow', kind: 'class', mode: 'online', topic: 'Yoga',
      description: 'd', startDate: '2027-01-05', endDate: '2027-01-05', status: 'received', emailVerified: true, images: [], priceType: 'PAID', pricePaise: 50000, createdAt: '',
      platform: 'Zoom', schedule: { days: ['mon', 'wed', 'fri'], time: '07:00', durationMin: 60 }, languages: ['Hindi'], level: 'beginner', experience: '8 years', certifications: 'RYT 500',
      freeTrial: true, whatsapp: '+919989898999', prices: [{ label: 'Per session', amountPaise: 50000, sessions: 1 }], endsOn: '2027-01-05' } as unknown as WorkshopRequest;
    const m = notificationMail(r, KIND_LABEL.class);
    for (const s of ['Online', 'Yoga', 'Zoom', 'Mon, Wed, Fri at 7:00 am, 60 min', 'Per session', 'Hindi', 'beginner', '8 years', 'RYT 500', 'Free trial: yes', '+919989898999']) expect(m.text).toContain(s);
    expect(m.text).not.toContain(', ,');
    expect(m.subject).toContain('Online class');
  });
});
