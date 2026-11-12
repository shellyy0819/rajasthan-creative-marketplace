import type { CraftKind } from '@/lib/fair-types';
import type { DayPhase } from './daytime';

/**
 * Sound for the fair, made in the browser with the Web Audio API (no sound files to download). Footsteps, a stamp thunk, chimes for quests,
 * a camera shutter, a pop for emotes, a sound for each craft, and a soft background that follows the time of day: a murmur that grows with the crowd,
 * birds in the morning and crickets at night. Browsers only allow sound after a click or key press, so `unlock()` is called from the first one.
 */
export type Sfx = 'step' | 'stamp' | 'add' | 'remove' | 'quest' | 'garland' | 'emote' | 'join' | 'crowd' | 'shutter' | 'note' | 'open' | 'look' | 'error';
export const MUTE_KEY = 'cf-fair-muted';
/** Overall volume, kept low: the fair should never startle anyone. The background layers are lower still. */
export const MASTER_GAIN = .28;
export const AMBIENCE_GAIN = { murmur: .011, birds: .008, crickets: .004 } as const;

export type Ambience = { murmur: number; birds: boolean; crickets: boolean };
/** How loud the background is: the murmur follows the number of people, birds sing in the morning, crickets at night. Pure, so it is easy to test. */
export function ambienceFor(phase: DayPhase, crowd: number): Ambience {
  const people = Math.max(0, Math.min(12, crowd)) / 12;
  return { murmur: Math.round(people * (phase === 'night' ? 0.4 : 1) * 100) / 100, birds: phase === 'morning', crickets: phase === 'night' };
}

export type Sound = {
  supported: boolean;
  readonly muted: boolean;
  unlock(): void;
  sfx(name: Sfx): void;
  /** Starts the sound of a craft (it runs until stopped or ten seconds), or stops it with null. */
  craft(kind: CraftKind | null): void;
  ambience(phase: DayPhase, crowd: number): void;
  setMuted(m: boolean): void;
  destroy(): void;
};

type Ctx = AudioContext;
type Opt = { type?: OscillatorType; gain?: number; glide?: number; at?: number };
const NOTE = { c5: 523.25, e5: 659.25, g5: 783.99, a5: 880, b5: 987.77, c6: 1046.5, e6: 1318.5, g6: 1568 };

export function createSound(storage: Pick<Storage, 'getItem' | 'setItem'> | null, makeCtx?: () => Ctx | null): Sound {
  let muted = false;
  try { muted = storage?.getItem(MUTE_KEY) === '1'; } catch { /* blocked storage */ }
  const factory = makeCtx ?? (() => {
    const A = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    return A ? new A() : null;
  });
  const supported = !!makeCtx || (typeof window !== 'undefined' && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext));
  let ctx: Ctx | null = null, master: GainNode | null = null, noise: AudioBuffer | null = null, amb: { murmur: GainNode; src: AudioBufferSourceNode } | null = null;
  let ambNow: Ambience = { murmur: 0, birds: false, crickets: false }, craftTimers: ReturnType<typeof setInterval>[] = [], craftStops: Array<() => void> = [], craftEnd: ReturnType<typeof setTimeout> | undefined;
  let birdT: ReturnType<typeof setTimeout> | undefined, cricketT: ReturnType<typeof setInterval> | undefined, stepFlip = false;

  const ready = () => !!ctx && !!master && !muted && ctx.state !== 'closed';
  const now = () => ctx!.currentTime;
  /** A short pitched sound. */
  const tone = (freq: number, dur: number, o: Opt = {}) => {
    if (!ready()) return;
    const t0 = now() + (o.at ?? 0), osc = ctx!.createOscillator(), g = ctx!.createGain();
    osc.type = o.type ?? 'sine'; osc.frequency.setValueAtTime(freq, t0); if (o.glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.glide), t0 + dur);
    const peak = o.gain ?? .2; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(.012, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master!); osc.start(t0); osc.stop(t0 + dur + .02);
  };
  /** A bell: a note with a ringing overtone. */
  const bell = (freq: number, at = 0, gain = .12) => { tone(freq, .9, { gain, at }); tone(freq * 2.01, .5, { gain: gain * .35, at }); };
  /** A short burst of filtered noise: a footstep, a click, paper. */
  const hiss = (dur: number, type: BiquadFilterType, freq: number, o: { gain?: number; q?: number; at?: number } = {}) => {
    if (!ready() || !noise) return;
    const t0 = now() + (o.at ?? 0), src = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
    src.buffer = noise; src.playbackRate.value = .8 + Math.random() * .4; f.type = type; f.frequency.value = freq; f.Q.value = o.q ?? 1;
    g.gain.setValueAtTime(o.gain ?? .2, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master!); src.start(t0); src.stop(t0 + dur + .02);
  };
  /** Endless filtered noise (a wheel turning, water pouring, a crowd). */
  const loop = (type: BiquadFilterType, freq: number, gain: number, q = 1) => {
    if (!ready() || !noise) return { gain: null as GainNode | null, stop() {} };
    const src = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
    src.buffer = noise; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(gain, now() + .3);
    src.connect(f).connect(g).connect(master!); src.start();
    return { gain: g, stop() { try { g.gain.cancelScheduledValues(now()); g.gain.linearRampToValueAtTime(0.0001, now() + .25); src.stop(now() + .3); } catch { /* already stopped */ } } };
  };

  const SFX: Record<Sfx, () => void> = {
    step: () => { stepFlip = !stepFlip; hiss(.07, 'lowpass', stepFlip ? 760 : 920, { gain: .09 }); tone(stepFlip ? 95 : 110, .05, { gain: .05, glide: 60 }); },
    stamp: () => { tone(190, .12, { gain: .3, glide: 80, type: 'triangle' }); hiss(.04, 'bandpass', 1400, { gain: .15 }); tone(NOTE.g5, .25, { gain: .08, at: .08 }); },
    add: () => { tone(660, .09, { type: 'triangle', gain: .14 }); tone(880, .14, { type: 'triangle', gain: .14, at: .07 }); },
    remove: () => { tone(520, .09, { type: 'triangle', gain: .1 }); tone(390, .12, { type: 'triangle', gain: .1, at: .07 }); },
    quest: () => { [NOTE.c5, NOTE.e5, NOTE.g5, NOTE.c6].forEach((f, i) => bell(f, i * .11, .13)); },
    garland: () => { [NOTE.c5, NOTE.e5, NOTE.g5, NOTE.c6, NOTE.e6, NOTE.g6].forEach((f, i) => bell(f, i * .1, .12)); },
    emote: () => { tone(520, .12, { glide: 800, gain: .14 }); tone(1040, .08, { gain: .05, at: .06 }); },
    join: () => { bell(NOTE.a5, 0, .07); bell(NOTE.e6, .09, .05); },
    crowd: () => { [NOTE.g5, NOTE.b5, NOTE.e6].forEach((f, i) => bell(f, i * .13, .06)); },
    shutter: () => { hiss(.03, 'highpass', 2500, { gain: .35 }); hiss(.05, 'bandpass', 1800, { gain: .3, at: .06 }); tone(1200, .03, { type: 'square', gain: .05 }); },
    note: () => { hiss(.2, 'highpass', 3000, { gain: .12 }); tone(740, .1, { gain: .12, at: .12 }); },
    open: () => { hiss(.18, 'bandpass', 700, { gain: .06, q: .8 }); },
    look: () => { tone(440, .07, { type: 'triangle', gain: .1 }); tone(660, .1, { type: 'triangle', gain: .1, at: .06 }); },
    error: () => { tone(220, .14, { type: 'square', gain: .07, glide: 170 }); },
  };
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const CRAFT: Record<CraftKind, () => void> = {
    pottery: () => { const w = loop('bandpass', 240, .07, 3); craftStops.push(w.stop); craftTimers.push(setInterval(() => tone(rand(150, 190), .12, { gain: .03, type: 'triangle' }), 700)); },
    crochet: () => { craftTimers.push(setInterval(() => hiss(.02, 'highpass', 3600, { gain: .09 }), 170)); },
    resin: () => { const w = loop('bandpass', 900, .06, 1); craftStops.push(w.stop); craftTimers.push(setInterval(() => tone(rand(280, 520), .06, { gain: .04 }), 230)); },
    jewellery: () => { craftTimers.push(setInterval(() => tone(rand(2000, 2900), .05, { type: 'triangle', gain: .06 }), 480)); },
    print: () => { craftTimers.push(setInterval(() => { tone(140, .1, { gain: .2, glide: 70 }); hiss(.04, 'lowpass', 600, { gain: .1 }); }, 900)); },
    wood: () => { craftTimers.push(setInterval(() => { hiss(.035, 'bandpass', 1900, { gain: .16, q: 2 }); tone(rand(480, 560), .04, { type: 'square', gain: .04 }); }, 260)); },
    christmas: () => { craftTimers.push(setInterval(() => bell([NOTE.g5, NOTE.b5, NOTE.e6, NOTE.g6][Math.floor(Math.random() * 4)], 0, .07), 520)); },
    handmade: () => { craftTimers.push(setInterval(() => hiss(.03, 'bandpass', 1500, { gain: .07 }), 300)); },
  };
  const stopCraft = () => { craftTimers.forEach(clearInterval); craftTimers = []; craftStops.forEach(s => s()); craftStops = []; if (craftEnd) clearTimeout(craftEnd); craftEnd = undefined; };

  const stopAmbience = () => { if (amb) { amb.murmur.gain.cancelScheduledValues(0); try { amb.src.stop(); } catch { /* stopped */ } amb = null; } if (birdT) clearTimeout(birdT); birdT = undefined; if (cricketT) clearInterval(cricketT); cricketT = undefined; };
  const chirp = () => { const f = rand(2200, 3000), g = AMBIENCE_GAIN.birds; tone(f, .07, { gain: g, glide: f * 1.2 }); tone(f * 1.1, .06, { gain: g * .8, glide: f * 1.3, at: .1 }); };
  const applyAmbience = () => {
    stopAmbience();
    if (!ready() || !noise) return;
    if (ambNow.murmur > 0) {
      const src = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
      src.buffer = noise; src.loop = true; f.type = 'lowpass'; f.frequency.value = 340; f.Q.value = .4; g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(AMBIENCE_GAIN.murmur * ambNow.murmur, now() + 3);
      src.connect(f).connect(g).connect(master!); src.start(); amb = { murmur: g, src };
    }
    if (ambNow.birds) { const next = () => { chirp(); birdT = setTimeout(next, rand(5000, 11000)); }; birdT = setTimeout(next, 3000); }
    if (ambNow.crickets) cricketT = setInterval(() => { for (let i = 0; i < 3; i++) tone(3200, .04, { gain: AMBIENCE_GAIN.crickets, at: i * .09 }); }, 1800);
  };

  return {
    supported,
    get muted() { return muted; },
    unlock() {
      if (!supported || ctx) { if (ctx?.state === 'suspended') void ctx.resume(); return; }
      try {
        ctx = factory(); if (!ctx) return;
        master = ctx.createGain(); master.gain.value = MASTER_GAIN; master.connect(ctx.destination);
        const len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        noise = buf; if (ctx.state === 'suspended') void ctx.resume();
        applyAmbience();
      } catch { ctx = null; }
    },
    sfx(name) { if (ready()) SFX[name](); },
    craft(kind) { stopCraft(); if (!kind || !ready()) return; CRAFT[kind](); craftEnd = setTimeout(stopCraft, 11_000); },
    ambience(phase, crowd) { const a = ambienceFor(phase, crowd); if (a.murmur === ambNow.murmur && a.birds === ambNow.birds && a.crickets === ambNow.crickets) return; ambNow = a; applyAmbience(); },
    setMuted(m) {
      muted = m; try { storage?.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* blocked storage */ }
      if (m) { stopCraft(); stopAmbience(); } else applyAmbience();
    },
    destroy() { stopCraft(); stopAmbience(); try { void ctx?.close(); } catch { /* closed */ } ctx = null; master = null; },
  };
}
