import { describe, expect, it } from 'vitest';
import { contactChannels, describeNext, nextSession, startsIn, upcomingSessions, weekStrip } from '@/lib/class-page';

const cls = (over: Record<string, unknown> = {}) => ({
  kind: 'class', date: '2026-11-02', endsOn: '2027-02-28', schedule: { repeat: 'weekly', days: ['mon', 'tue', 'wed', 'thu', 'fri'], time: '06:30', durationMin: 60 },
  whatsapp: null, instagram: null, website: null, ...over,
}) as never;
// 18 Nov 2026 is a Wednesday. 00:30 UTC is 06:00 in India.
const wed6am = new Date('2026-11-18T00:30:00Z');

describe('nextSession', () => {
  it('is today when the class is later today, and says how long until it starts', () => {
    const n = nextSession(cls(), wed6am)!;
    expect(n).toMatchObject({ date: '2026-11-18', time: '06:30', live: false });
    expect(describeNext(n, wed6am)).toBe('Today, 6:30 am IST · starts in 30 min');
  });
  it('is live while the class runs, then the next class day once it is over', () => {
    const during = new Date('2026-11-18T01:10:00Z'); // 06:40 IST
    expect(nextSession(cls(), during)).toMatchObject({ date: '2026-11-18', live: true });
    expect(describeNext(nextSession(cls(), during)!, during)).toBe('Today, 6:30 am IST · live now');
    const after = new Date('2026-11-18T03:00:00Z'); // 08:30 IST
    expect(nextSession(cls(), after)).toMatchObject({ date: '2026-11-19' });
    expect(describeNext(nextSession(cls(), after)!, after)).toBe('Tomorrow, 6:30 am IST');
  });
  it('skips the weekend, names the weekday and date, and starts no earlier than the first day', () => {
    const fri = new Date('2026-11-20T04:00:00Z'); // Friday 09:30 IST, class done
    expect(describeNext(nextSession(cls(), fri)!, fri)).toBe('Monday 23 Nov, 6:30 am IST');
    const early = new Date('2026-10-20T04:00:00Z');
    expect(nextSession(cls({ date: '2026-11-02' }), early)).toMatchObject({ date: '2026-11-02' });
  });
  it('is null after the last day, and for a listing with no schedule', () => {
    expect(nextSession(cls({ endsOn: '2026-11-10' }), wed6am)).toBeNull();
    expect(nextSession(cls({ schedule: null }), wed6am)).toBeNull();
  });
  it('a monthly class only counts the chosen weeks (the 1st and 3rd Saturday)', () => {
    const monthly = cls({ schedule: { repeat: 'monthly', days: ['sat'], weeks: [1, 3], time: '10:00', durationMin: 90 }, date: '2026-11-01' });
    expect(nextSession(monthly, wed6am)).toMatchObject({ date: '2026-11-21' }); // 3rd Saturday of November
  });
});

describe('startsIn', () => {
  it('says today, tomorrow or how many days (India date), and nothing once the day has passed', () => {
    expect(startsIn('2026-11-18', wed6am)).toBe('Today');
    expect(startsIn('2026-11-19', wed6am)).toBe('Tomorrow');
    expect(startsIn('2026-11-21', wed6am)).toBe('Starts in 3 days');
    expect(startsIn('2026-11-17', wed6am)).toBeNull();
    expect(startsIn('2026-11-18', new Date('2026-11-17T19:00:00Z'))).toBe('Today'); // 00:30 IST on the 18th
  });
});

describe('weekStrip', () => {
  it('lists Monday to Sunday of the current week with done, today, upcoming and rest days', () => {
    const w = weekStrip(cls(), wed6am);
    expect(w.map(d => d.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(w.map(d => d.dom)).toEqual([16, 17, 18, 19, 20, 21, 22]);
    expect(w.map(d => d.state)).toEqual(['done', 'done', 'today', 'upcoming', 'upcoming', 'rest', 'rest']);
    expect(w[2].time).toBe('6:30 am');
    expect(w[5].time).toBeUndefined();
  });
  it('days before the class starts or after it ends are rest days', () => {
    const w = weekStrip(cls({ date: '2026-11-19', endsOn: '2026-11-20' }), wed6am);
    expect(w.map(d => d.state)).toEqual(['rest', 'rest', 'rest', 'upcoming', 'upcoming', 'rest', 'rest']);
  });
});

describe('contactChannels', () => {
  it('WhatsApp is the main button, and every available channel is an icon', () => {
    const c = contactChannels(cls({ whatsapp: '+919989898999', instagram: 'asha', website: 'https://asha.in', publicPhone: '+919989898999' }));
    expect(c.primary).toMatchObject({ kind: 'whatsapp', href: 'https://wa.me/919989898999' });
    expect(c.secondary).toEqual([]);
    expect(c.icons.map(i => i.kind)).toEqual(['instagram', 'whatsapp', 'call', 'website']);
  });
  it('without WhatsApp the shown phone is the main button', () => {
    const c = contactChannels(cls({ publicPhone: '+919989898999', instagram: 'asha' }));
    expect(c.primary).toMatchObject({ kind: 'call', href: 'tel:+919989898999' });
  });
  it('with no phone at all, the other channels are offered: Instagram first, then the website', () => {
    const c = contactChannels(cls({ instagram: 'asha', website: 'https://asha.in' }));
    expect(c.primary?.kind).toBe('instagram');
    expect(c.secondary.map(s => s.kind)).toEqual(['website']);
    expect(contactChannels(cls({ website: 'https://asha.in' })).primary?.kind).toBe('website');
  });
  it('ignores a website that is not https, and has no main button when nothing is public', () => {
    expect(contactChannels(cls({ website: 'javascript:alert(1)' })).primary).toBeNull();
    expect(contactChannels(cls()).icons).toEqual([]);
  });
});

describe('upcomingSessions', () => {
  it('lists the next four classes, nearest first, with the pieces the page prints and a tag for how far away each is', () => {
    const w = cls({ schedule: { repeat: 'weekly', days: ['mon', 'wed', 'fri'], time: '07:00', durationMin: 60 } });
    const list = upcomingSessions(w, new Date('2026-11-19T00:00:00Z')); // Thursday 05:30 in India
    expect(list.map(s => s.date)).toEqual(['2026-11-20', '2026-11-23', '2026-11-25', '2026-11-27']);
    expect(list[0]).toMatchObject({ dow: 'FRI', dayName: 'Friday', dom: 20, month: 'Nov', time: '7:00 am', tag: 'Tomorrow', first: true, live: false });
    expect(list.map(s => s.tag)).toEqual(['Tomorrow', 'In 4 days', 'In 6 days', 'In 8 days']);
    expect(list.slice(1).every(s => !s.first)).toBe(true);
  });
  it('counts the class that is on now, and says Today for one later today', () => {
    const w = cls({ schedule: { repeat: 'weekly', days: ['wed'], time: '06:30', durationMin: 60 } });
    expect(upcomingSessions(w, new Date('2026-11-18T01:10:00Z'))[0]).toMatchObject({ tag: 'Live now', live: true, date: '2026-11-18' }); // 06:40 IST
    expect(upcomingSessions(w, wed6am)[0]).toMatchObject({ tag: 'Today', live: false });
  });
  it('stops at the end date, skips dates before the start, and is empty without a schedule or after the end', () => {
    const w = cls({ date: '2026-11-23', endsOn: '2026-11-25', schedule: { repeat: 'weekly', days: ['mon', 'wed', 'fri'], time: '07:00', durationMin: 60 } });
    expect(upcomingSessions(w, wed6am).map(s => s.date)).toEqual(['2026-11-23', '2026-11-25']);
    expect(upcomingSessions(cls({ schedule: null }), wed6am)).toEqual([]);
    expect(upcomingSessions(cls({ endsOn: '2026-11-10' }), wed6am)).toEqual([]);
  });
  it('follows a monthly schedule (the 1st and 3rd Saturday)', () => {
    const w = cls({ schedule: { repeat: 'monthly', days: ['sat'], weeks: [1, 3], time: '10:00', durationMin: 90 } });
    expect(upcomingSessions(w, wed6am, 3).map(s => s.date)).toEqual(['2026-11-21', '2026-12-05', '2026-12-19']);
  });
});
