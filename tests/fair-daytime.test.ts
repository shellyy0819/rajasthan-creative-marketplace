import { describe, it, expect } from 'vitest';
import { MAX_CROWD, PHASE_LABEL, crowdAt, hourFromSearch, hourOf, phaseAt, skyAt } from '@/components/fair/daytime';

describe('time of day', () => {
  it('names the phase from the hour', () => {
    expect([0, 4.9, 20, 23.5].map(phaseAt)).toEqual(['night', 'night', 'night', 'night']);
    expect([5, 8, 10.9].map(phaseAt)).toEqual(['morning', 'morning', 'morning']);
    expect([11, 14, 16.9].map(phaseAt)).toEqual(['afternoon', 'afternoon', 'afternoon']);
    expect([17, 18.5, 19.9].map(phaseAt)).toEqual(['evening', 'evening', 'evening']);
    expect(PHASE_LABEL.night).toBe('Chilly night'); expect(PHASE_LABEL.morning).toBe('Sunny morning'); expect(PHASE_LABEL.afternoon).toBe('Busy afternoon');
  });
  it('is dark, chilly and lamp-lit at night', () => {
    const s = skyAt(23);
    expect(s.dark).toBeGreaterThan(.3); expect(s.lamps).toBeGreaterThan(.9); expect(s.chill).toBeGreaterThan(.8); expect(s.beams).toBe(0);
  });
  it('has sunbeams and warm light in the morning, and no darkness or lamps', () => {
    const s = skyAt(8);
    expect(s.beams).toBeGreaterThan(.8); expect(s.warm).toBeGreaterThan(.08); expect(s.dark).toBe(0); expect(s.lamps).toBe(0); expect(s.chill).toBeLessThan(.2);
  });
  it('is plain bright daylight in the afternoon', () => {
    const s = skyAt(14);
    expect(s).toMatchObject({ dark: 0, lamps: 0, chill: 0 }); expect(s.warm).toBeLessThan(.05); expect(s.beams).toBeLessThan(.1);
    expect(skyAt(15.5).beams).toBe(0);
  });
  it('turns golden and lights the lamps in the evening', () => {
    const s = skyAt(18.5);
    expect(s.warm).toBeGreaterThan(.12); expect(s.lamps).toBeGreaterThan(.4); expect(s.dark).toBeGreaterThan(0);
  });
  it('changes smoothly and wraps round midnight', () => {
    let prev = skyAt(0);
    for (let h = .25; h <= 24; h += .25) { const s = skyAt(h); for (const k of ['dark', 'warm', 'lamps', 'beams', 'chill'] as const) expect(Math.abs(s[k] - prev[k])).toBeLessThan(.2); prev = s; }
    expect(skyAt(24)).toEqual(skyAt(0)); expect(skyAt(25)).toEqual(skyAt(1)); expect(skyAt(-1)).toEqual(skyAt(23));
  });
  it('has the fewest shoppers at night and the most in the afternoon', () => {
    expect(crowdAt(2)).toBe(3);
    expect(crowdAt(13)).toBe(MAX_CROWD);
    expect(crowdAt(8)).toBeGreaterThan(crowdAt(2)); expect(crowdAt(13)).toBeGreaterThan(crowdAt(8)); expect(crowdAt(21)).toBeLessThan(crowdAt(13));
    for (let h = 0; h < 24; h += .5) { expect(crowdAt(h)).toBeGreaterThanOrEqual(0); expect(crowdAt(h)).toBeLessThanOrEqual(MAX_CROWD); }
  });
  it('reads the visitor\'s own clock', () => { expect(hourOf(new Date(2026, 10, 12, 13, 30))).toBe(13.5); });
  it('lets the address preview another time of day', () => {
    expect(hourFromSearch('?time=night')).toBe(23); expect(hourFromSearch('?time=morning')).toBe(8);
    expect(hourFromSearch('?time=afternoon')).toBe(14); expect(hourFromSearch('?time=evening')).toBe(18.5);
    expect(hourFromSearch('?hour=6.5')).toBe(6.5);
    for (const bad of ['', '?time=noon', '?hour=25', '?hour=abc', '?hour=-1']) expect(hourFromSearch(bad)).toBeNull();
  });
});
