import { describe, expect, it } from 'vitest';
import { describeSchedule, isCurrent, lastDay, optionalWebsite, parseListingFields, priceCache, summarizePrices } from '@/lib/workshop-listing';

const yoga = {
  kind: 'class', mode: 'online', topicId: 1, platform: 'Zoom',
  schedule: { days: ['mon', 'wed', 'fri'], time: '07:00', durationMin: 60 },
  languages: [' Hindi ', 'English'], level: 'beginner', experience: '8 years', certifications: 'RYT 500', freeTrial: true,
  whatsapp: '99898 98999', instagram: '@asha.yoga', website: 'asha.yoga',
  prices: [{ label: 'Per session', amountPaise: 50000, sessions: 1 }, { label: 'Monthly', amountPaise: 150000, sessions: 12 }],
};
const msg = (raw: object) => { try { parseListingFields(raw as never); return 'ok'; } catch (e) { return (e as Error).message; } };

describe('parseListingFields', () => {
  it('accepts a full yoga payload and normalises it', () => {
    const f = parseListingFields(yoga);
    expect(f).toMatchObject({
      kind: 'class', mode: 'online', topicId: 1, platform: 'Zoom', languages: ['Hindi', 'English'], level: 'beginner',
      freeTrial: true, whatsapp: '+919989898999', instagram: '@asha.yoga', website: 'https://asha.yoga',
      schedule: { days: ['mon', 'wed', 'fri'], time: '07:00', durationMin: 60 },
    });
    expect(f.prices).toEqual([{ label: 'Per session', amountPaise: 50000, sessions: 1 }, { label: 'Monthly', amountPaise: 150000, sessions: 12 }]);
  });
  it('defaults an empty payload to an in-person workshop', () => {
    expect(parseListingFields({})).toMatchObject({ kind: 'workshop', mode: 'in_person', topicId: null, platform: null, schedule: null, endsOn: null, languages: [], level: null, freeTrial: false, prices: [] });
  });
  it('rejects bad languages', () => {
    expect(msg({ languages: ['a', 'b', 'c', 'd', 'e', 'f'] })).toMatch(/languages/);
    expect(msg({ languages: ['H'] })).toMatch(/languages/);
    expect(msg({ languages: ['x'.repeat(31)] })).toMatch(/languages/);
  });
  it('rejects an unknown level, kind or mode', () => {
    expect(msg({ level: 'expert' })).toMatch(/level/);
    expect(msg({ kind: 'party' })).toMatch(/kind/);
    expect(msg({ mode: 'tv' })).toMatch(/mode/);
  });
  it('an online listing needs a platform and a schedule', () => {
    expect(msg({ ...yoga, platform: undefined })).toMatch(/platform/);
    expect(msg({ ...yoga, schedule: undefined })).toMatch(/schedule/);
  });
  it('validates the schedule', () => {
    expect(msg({ ...yoga, schedule: { ...yoga.schedule, days: ['mon', 'xyz'] } })).toMatch(/schedule/);
    expect(msg({ ...yoga, schedule: { ...yoga.schedule, days: [] } })).toMatch(/schedule/);
    expect(msg({ ...yoga, schedule: { ...yoga.schedule, durationMin: 10 } })).toMatch(/schedule/);
    expect(msg({ ...yoga, schedule: { ...yoga.schedule, durationMin: 481 } })).toMatch(/schedule/);
    expect(msg({ ...yoga, schedule: { ...yoga.schedule, time: '7am' } })).toMatch(/schedule/);
  });
  it('a class cannot be in person', () => {
    expect(msg({ ...yoga, mode: 'in_person' })).toMatch(/class/i);
  });
  it('validates price rows', () => {
    const row = { label: 'Monthly', amountPaise: 100, sessions: null };
    expect(msg({ ...yoga, prices: Array.from({ length: 6 }, () => row) })).toMatch(/prices/);
    expect(msg({ ...yoga, prices: [{ ...row, amountPaise: -1 }] })).toMatch(/prices/);
    expect(msg({ ...yoga, prices: [{ ...row, label: '' }] })).toMatch(/prices/);
    expect(msg({ ...yoga, prices: [{ ...row, label: 'x'.repeat(31) }] })).toMatch(/prices/);
    expect(msg({ ...yoga, prices: [{ ...row, sessions: 0 }] })).toMatch(/prices/);
  });
  it('rejects a bad WhatsApp number and a bad end date', () => {
    expect(msg({ ...yoga, whatsapp: '12345' })).toMatch(/whatsapp/);
    expect(msg({ ...yoga, endsOn: '2027-02-30' })).toMatch(/date/);
  });
  it('limits the free-text fields', () => {
    expect(msg({ ...yoga, experience: 'x'.repeat(501) })).toMatch(/experience/);
    expect(msg({ ...yoga, certifications: 'x'.repeat(501) })).toMatch(/certifications/);
    expect(msg({ ...yoga, platform: 'x'.repeat(61) })).toMatch(/platform/);
  });
});

describe('monthly schedules', () => {
  const monthly = { ...yoga, schedule: { repeat: 'monthly', days: ['sat'], weeks: [1, 3], time: '07:00', durationMin: 60 } };
  it('accepts every month on chosen weeks and days, and keeps weekly as the default', () => {
    expect(parseListingFields(monthly).schedule).toEqual({ repeat: 'monthly', days: ['sat'], weeks: [1, 3], time: '07:00', durationMin: 60 });
    expect(parseListingFields(yoga).schedule).toEqual({ repeat: 'weekly', days: ['mon', 'wed', 'fri'], time: '07:00', durationMin: 60 });
  });
  it('monthly needs at least one week, and only 1st to 4th or last', () => {
    expect(msg({ ...yoga, schedule: { ...monthly.schedule, weeks: [] } })).toMatch(/schedule/);
    expect(msg({ ...yoga, schedule: { ...monthly.schedule, weeks: undefined } })).toMatch(/schedule/);
    expect(msg({ ...yoga, schedule: { ...monthly.schedule, weeks: [5] } })).toMatch(/schedule/);
    expect(parseListingFields({ ...yoga, schedule: { ...monthly.schedule, weeks: [4, 'last', 1, 1] } }).schedule?.weeks).toEqual([1, 4, 'last']);
  });
  it('weekly drops any weeks that were sent, and an unknown repeat is refused', () => {
    expect(parseListingFields({ ...yoga, schedule: { ...yoga.schedule, weeks: [1] } }).schedule).not.toHaveProperty('weeks');
    expect(msg({ ...yoga, schedule: { ...yoga.schedule, repeat: 'daily' } })).toMatch(/schedule/);
  });
  it('is described in words', () => {
    expect(describeSchedule({ repeat: 'monthly', days: ['sat'], weeks: [1, 3], time: '07:00', durationMin: 60 })).toBe('1st and 3rd Sat of every month at 7:00 am, 60 min');
    expect(describeSchedule({ repeat: 'monthly', days: ['sun', 'sat'], weeks: [1, 2, 'last'], time: '18:30', durationMin: 45 })).toBe('1st, 2nd and last Sat, Sun of every month at 6:30 pm, 45 min');
    expect(describeSchedule({ repeat: 'monthly', days: ['fri'], weeks: ['last'], time: '09:00', durationMin: 30 })).toBe('Last Fri of every month at 9:00 am, 30 min');
  });
});

describe('join link', () => {
  it('is an optional https link, kept as given for online listings', () => {
    expect(parseListingFields({ ...yoga, joinLink: 'https://zoom.us/j/123?pwd=abc' }).joinLink).toBe('https://zoom.us/j/123?pwd=abc');
    expect(parseListingFields(yoga).joinLink).toBeNull();
    expect(parseListingFields({ ...yoga, joinLink: '' }).joinLink).toBeNull();
  });
  it('refuses anything that is not an https link', () => {
    for (const bad of ['http://zoom.us/j/1', 'javascript:alert(1)', 'zoom.us/j/1', 'https://user:pw@zoom.us/j/1', 'https://' + 'a'.repeat(500) + '.com']) expect(msg({ ...yoga, joinLink: bad }), bad).toMatch(/joinLink/);
  });
});

describe('free trial length', () => {
  it('is optional, 1 to 365 days, and only kept when there is a free trial', () => {
    expect(parseListingFields({ ...yoga, freeTrialDays: 7 }).freeTrialDays).toBe(7);
    expect(parseListingFields(yoga).freeTrialDays).toBeNull();
    expect(parseListingFields({ ...yoga, freeTrialDays: '' }).freeTrialDays).toBeNull();
    // Days are the free trial: giving them switches it on, and without them there is none.
    expect(parseListingFields({ ...yoga, freeTrial: false, freeTrialDays: 7 })).toMatchObject({ freeTrial: true, freeTrialDays: 7 });
    expect(parseListingFields({ ...yoga, freeTrial: false })).toMatchObject({ freeTrial: false, freeTrialDays: null });
    expect(msg({ ...yoga, freeTrialDays: 0 })).toMatch(/freeTrialDays/);
    expect(msg({ ...yoga, freeTrialDays: 366 })).toMatch(/freeTrialDays/);
    expect(msg({ ...yoga, freeTrialDays: 1.5 })).toMatch(/freeTrialDays/);
  });
});

describe('optionalWebsite', () => {
  it('adds https and refuses things that are not web addresses', () => {
    expect(optionalWebsite('example.com')).toBe('https://example.com');
    expect(optionalWebsite('')).toBeUndefined();
    expect(() => optionalWebsite('javascript:alert(1)')).toThrow(/website/);
    expect(() => optionalWebsite('nodots')).toThrow(/website/);
  });
});

describe('priceCache', () => {
  it('no rows or all-zero rows are FREE at 0', () => {
    expect(priceCache([])).toEqual({ type: 'FREE', pricePaise: 0 });
    expect(priceCache([{ label: 'Trial', amountPaise: 0, sessions: 1 }])).toEqual({ type: 'FREE', pricePaise: 0 });
  });
  it('paid rows give PAID at the lowest amount above zero', () => {
    expect(priceCache([{ label: 'A', amountPaise: 150000, sessions: null }, { label: 'B', amountPaise: 50000, sessions: null }])).toEqual({ type: 'PAID', pricePaise: 50000 });
    expect(priceCache([{ label: 'Trial', amountPaise: 0, sessions: 1 }, { label: 'B', amountPaise: 50000, sessions: null }])).toEqual({ type: 'PAID', pricePaise: 50000 });
  });
});

describe('lastDay and isCurrent', () => {
  const NOW = new Date('2026-11-18T10:00:00+05:30');
  const ev = (date: string, over: object = {}) => ({ date, kind: 'workshop', endsOn: null, ...over });
  it('a one-day event ends on its own date', () => { expect(lastDay(ev('2026-11-18'))).toBe('2026-11-18'); });
  it('endsOn wins when set', () => { expect(lastDay(ev('2026-11-18', { endsOn: '2026-11-20' }))).toBe('2026-11-20'); });
  it('a class without endsOn never ends', () => {
    expect(lastDay(ev('2026-01-01', { kind: 'class' }))).toBeNull();
    expect(isCurrent(ev('2026-01-01', { kind: 'class' }), NOW)).toBe(true);
  });
  it('is current through the whole last day in India time and ended the next day', () => {
    expect(isCurrent(ev('2026-11-18'), new Date('2026-11-18T23:59:00+05:30'))).toBe(true);
    expect(isCurrent(ev('2026-11-18'), new Date('2026-11-19T00:01:00+05:30'))).toBe(false);
    expect(isCurrent(ev('2026-11-17'), NOW)).toBe(false);
  });
  it('a multi-day event is current until its endsOn', () => {
    expect(isCurrent(ev('2026-11-16', { endsOn: '2026-11-19' }), NOW)).toBe(true);
    expect(isCurrent(ev('2026-11-16', { endsOn: '2026-11-17' }), NOW)).toBe(false);
  });
  it('a class with an end date ends after it', () => {
    expect(isCurrent(ev('2026-01-01', { kind: 'class', endsOn: '2026-11-17' }), NOW)).toBe(false);
    expect(isCurrent(ev('2026-01-01', { kind: 'class', endsOn: '2026-11-18' }), NOW)).toBe(true);
  });
});

describe('describeSchedule and summarizePrices', () => {
  it('writes days, the time and the duration in words', () => {
    expect(describeSchedule({ days: ['fri', 'mon', 'wed'], time: '07:00', durationMin: 60 })).toBe('Mon, Wed, Fri at 7:00 am, 60 min');
    expect(describeSchedule({ days: ['sat'], time: '19:30', durationMin: 90 })).toBe('Sat at 7:30 pm, 90 min');
    expect(describeSchedule({ days: ['sun'], time: '12:00', durationMin: 45 })).toBe('Sun at 12:00 pm, 45 min');
    expect(describeSchedule({ days: ['sun'], time: '00:30', durationMin: 45 })).toBe('Sun at 12:30 am, 45 min');
  });
  it('shows the lowest price and every plan', () => {
    const s = summarizePrices([{ label: 'Monthly', amountPaise: 150000, sessions: 12 }, { label: 'Per session', amountPaise: 50000, sessions: 1 }, { label: 'Trial', amountPaise: 0, sessions: 1 }]);
    expect(s.from).toBe('From ₹500');
    expect(s.all).toEqual(['Monthly: ₹1,500 (12 sessions)', 'Per session: ₹500 (1 session)', 'Trial: Free (1 session)']);
  });
  it('says Free when there are no paid plans', () => {
    expect(summarizePrices([]).from).toBe('Free');
  });
});
