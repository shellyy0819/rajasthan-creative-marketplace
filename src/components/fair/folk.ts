/**
 * A short piece of Rajasthani folk music, made in the browser with the Web Audio API (no sound file to download): a steady drone on Sa and Pa,
 * a dholak keeping an eight-beat rhythm, and a plucked tune in the pentatonic scale of raga Bhupali. `folkScore` is the music as plain data, so it is easy to test.
 */
export type FolkKind = 'drone' | 'pluck' | 'bass' | 'slap';
export type FolkNote = { t: number; hz: number; len: number; kind: FolkKind };
export const FOLK_SECONDS = 14;
const BPM = 112, SA = 146.83;
/** Sa, Re, Ga, Pa, Dha and the high Sa of Bhupali, as ratios of Sa. */
const SCALE = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
/** The tune, a step at a time (an index into SCALE; -1 is a rest). */
const TUNE = [3, -1, 2, 3, 4, 3, 2, 0, 1, 2, -1, 2, 3, 2, 1, 0, 3, 4, 5, 4, 3, -1, 2, 3, 1, 2, 3, 2, 1, 0, 0, -1];
/** A rhythm of eight beats: bass on the heavy beats, slaps in between. */
const RHYTHM: FolkKind[] = ['bass', 'slap', 'slap', 'slap', 'slap', 'slap', 'bass', 'slap'];

export function folkScore(seconds = FOLK_SECONDS): FolkNote[] {
  const step = 60 / BPM / 2, out: FolkNote[] = [];
  for (let t = 0; t < seconds; t += 3.5) { out.push({ t, hz: SA / 2, len: 4, kind: 'drone' }, { t, hz: SA * .75, len: 4, kind: 'drone' }); }
  for (let i = 0, t = 0; t < seconds - .3; i++, t = i * step) {
    out.push({ t, hz: RHYTHM[i % 8] === 'bass' ? 92 : 0, len: .22, kind: RHYTHM[i % 8] });
    const n = TUNE[i % TUNE.length];
    if (n >= 0 && i % 2 === 0) out.push({ t, hz: SA * 2 * SCALE[n], len: .55, kind: 'pluck' });
  }
  return out.sort((a, b) => a.t - b.t);
}

type Ctor = typeof AudioContext;
/** Plays the music from the start. Returns a handle to stop it early, or null where the browser has no Web Audio. Call it from a click, as browsers require. */
export function playFolk(): { stop(): void } | null {
  if (typeof window === 'undefined') return null;
  const AC: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!AC) return null;
  let ctx: AudioContext;
  try { ctx = new AC(); } catch { return null; }
  void ctx.resume?.();
  const master = ctx.createGain(); master.gain.value = .2; master.connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate * .2, ctx.sampleRate), data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const t0 = ctx.currentTime + .05;
  for (const n of folkScore()) {
    const at = t0 + n.t, g = ctx.createGain(); g.connect(master);
    if (n.kind === 'slap') {
      const src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(); src.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 1800;
      g.gain.setValueAtTime(.28, at); g.gain.exponentialRampToValueAtTime(.001, at + n.len); src.connect(hp); hp.connect(g); src.start(at); src.stop(at + n.len);
      continue;
    }
    const o = ctx.createOscillator();
    if (n.kind === 'bass') {
      o.type = 'sine'; o.frequency.setValueAtTime(n.hz * 1.6, at); o.frequency.exponentialRampToValueAtTime(n.hz * .6, at + .12);
      g.gain.setValueAtTime(.7, at); g.gain.exponentialRampToValueAtTime(.001, at + n.len);
    } else if (n.kind === 'pluck') {
      o.type = 'triangle'; o.frequency.value = n.hz; g.gain.setValueAtTime(.001, at); g.gain.linearRampToValueAtTime(.32, at + .015); g.gain.exponentialRampToValueAtTime(.001, at + n.len);
    } else {
      o.type = 'sawtooth'; o.frequency.value = n.hz; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; o.connect(f); f.connect(g);
      g.gain.setValueAtTime(.001, at); g.gain.linearRampToValueAtTime(.07, at + .8); g.gain.linearRampToValueAtTime(.001, at + n.len);
      o.start(at); o.stop(at + n.len); continue;
    }
    o.connect(g); o.start(at); o.stop(at + n.len);
  }
  const done = setTimeout(() => { void ctx.close().catch(() => undefined); }, (FOLK_SECONDS + 2) * 1000);
  return { stop() { clearTimeout(done); try { master.gain.setTargetAtTime(0, ctx.currentTime, .08); } catch { /* already closed */ } setTimeout(() => { void ctx.close().catch(() => undefined); }, 400); } };
}
