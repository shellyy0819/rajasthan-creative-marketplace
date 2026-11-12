import { describe, it, expect, vi } from 'vitest';
import { AMBIENCE_GAIN, MASTER_GAIN, MUTE_KEY, ambienceFor, createSound } from '@/components/fair/sound';

/** A stand-in for the browser's audio system that only counts what is made. */
function fakeAudio() {
  const made = { osc: 0, noise: 0, gain: 0 };
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
  const node = (): Record<string, unknown> => { const n: Record<string, unknown> = { connect: vi.fn(() => n), disconnect: vi.fn() }; return n; };
  const ctx = {
    state: 'running', currentTime: 0, sampleRate: 8000, destination: {}, resume: vi.fn(async () => undefined), close: vi.fn(async () => undefined),
    createGain: () => { made.gain++; return Object.assign(node(), { gain: param() }); },
    createOscillator: () => { made.osc++; return Object.assign(node(), { type: 'sine', frequency: param(), start: vi.fn(), stop: vi.fn() }); },
    createBiquadFilter: () => Object.assign(node(), { type: 'lowpass', frequency: param(), Q: param() }),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => { made.noise++; return Object.assign(node(), { buffer: null, loop: false, playbackRate: param(), start: vi.fn(), stop: vi.fn() }); },
  };
  return { ctx: ctx as unknown as AudioContext, made, master: () => 0 };
}
const memory = (init: Record<string, string> = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

describe('ambienceFor', () => {
  it('has a murmur that grows with the crowd and is softer at night', () => {
    expect(ambienceFor('afternoon', 0).murmur).toBe(0);
    expect(ambienceFor('afternoon', 12).murmur).toBe(1);
    expect(ambienceFor('afternoon', 6).murmur).toBe(.5);
    expect(ambienceFor('night', 12).murmur).toBeLessThan(ambienceFor('afternoon', 12).murmur);
    expect(ambienceFor('afternoon', 99).murmur).toBe(1);
  });
  it('has birds in the morning and crickets at night, and neither in the afternoon', () => {
    expect(ambienceFor('morning', 3)).toMatchObject({ birds: true, crickets: false });
    expect(ambienceFor('night', 3)).toMatchObject({ birds: false, crickets: true });
    expect(ambienceFor('afternoon', 3)).toMatchObject({ birds: false, crickets: false });
  });
});

describe('volume', () => {
  it('is kept low, with the background far below the effects', () => {
    expect(MASTER_GAIN).toBeLessThanOrEqual(.3);
    for (const g of Object.values(AMBIENCE_GAIN)) expect(g).toBeLessThanOrEqual(.012);
  });
});

describe('createSound', () => {
  it('does nothing, safely, where there is no audio', () => {
    const s = createSound(memory(), () => null);
    s.unlock(); s.sfx('stamp'); s.craft('wood'); s.ambience('night', 5); s.setMuted(true); s.setMuted(false); s.destroy();
    expect(s.muted).toBe(false);
  });
  it('stays silent until the first click unlocks it', () => {
    const a = fakeAudio(), s = createSound(memory(), () => a.ctx);
    s.sfx('stamp'); expect(a.made.osc).toBe(0);
    s.unlock(); s.sfx('stamp'); expect(a.made.osc).toBeGreaterThan(0);
  });
  it('makes a sound for every effect', () => {
    const a = fakeAudio(), s = createSound(memory(), () => a.ctx); s.unlock();
    for (const n of ['step', 'stamp', 'add', 'remove', 'quest', 'garland', 'emote', 'join', 'crowd', 'shutter', 'note', 'open', 'look', 'error'] as const) {
      const before = a.made.osc + a.made.noise; s.sfx(n); expect(a.made.osc + a.made.noise, n).toBeGreaterThan(before);
    }
  });
  it('plays a sound for each craft until it is stopped', () => {
    vi.useFakeTimers();
    try {
      for (const k of ['crochet', 'pottery', 'resin', 'jewellery', 'print', 'wood', 'christmas', 'handmade'] as const) {
        const a = fakeAudio(), s = createSound(memory(), () => a.ctx); s.unlock();
        s.craft(k); vi.advanceTimersByTime(1500);
        const during = a.made.osc + a.made.noise; expect(during, k).toBeGreaterThan(0);
        s.craft(null); vi.advanceTimersByTime(3000); expect(a.made.osc + a.made.noise, `${k} stopped`).toBe(during);
        s.destroy();
      }
    } finally { vi.useRealTimers(); }
  });
  it('stops a craft by itself after about ten seconds', () => {
    vi.useFakeTimers();
    try {
      const a = fakeAudio(), s = createSound(memory(), () => a.ctx); s.unlock(); s.craft('crochet');
      vi.advanceTimersByTime(11_500); const n = a.made.noise; vi.advanceTimersByTime(5000);
      expect(a.made.noise).toBe(n);
    } finally { vi.useRealTimers(); }
  });
  it('is silent when muted, remembers the choice, and comes back when unmuted', () => {
    const store = memory(), a = fakeAudio(), s = createSound(store, () => a.ctx); s.unlock();
    s.setMuted(true); expect(s.muted).toBe(true); expect(store.getItem(MUTE_KEY)).toBe('1');
    const before = a.made.osc; s.sfx('stamp'); expect(a.made.osc).toBe(before);
    s.setMuted(false); expect(store.getItem(MUTE_KEY)).toBe('0'); s.sfx('stamp'); expect(a.made.osc).toBeGreaterThan(before);
    expect(createSound(memory({ [MUTE_KEY]: '1' }), () => fakeAudio().ctx).muted).toBe(true);
  });
  it('starts the background murmur only once there are people, and stops it when muted', () => {
    const a = fakeAudio(), s = createSound(memory(), () => a.ctx); s.unlock();
    s.ambience('afternoon', 0); expect(a.made.noise).toBe(0);
    s.ambience('afternoon', 8); expect(a.made.noise).toBe(1);
    s.setMuted(true); s.ambience('afternoon', 12); expect(a.made.noise).toBe(1);
  });
});
