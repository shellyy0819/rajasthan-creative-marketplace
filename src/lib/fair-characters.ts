/**
 * Characters for the exhibition. A visitor code always gives the same character, on any device, with no server involved:
 * the code is hashed and the hash picks the outfit, skin tone, hair and name.
 */
export const OUTFITS = ['#c66b43', '#405746', '#35506f', '#d9a441', '#b3262e', '#7a4e8f'] as const;
export const SKINS = ['#e0ac86', '#c98b62', '#8e5b3c'] as const;
export const ACCENTS = ['#d9a441', '#fbf7ef', '#c66b43', '#4fb6b8', '#e58aa6'] as const;
export const PANTS = ['#35506f', '#575a4d', '#8a5f3c', '#2b3a31'] as const;
export const NAMES = ['Tara', 'Veer', 'Meher', 'Kabir', 'Noor', 'Ishaan', 'Anika', 'Dev', 'Zoya', 'Rudra', 'Sana', 'Kian'] as const;

export type Character = { name: string; top: string; skin: string; acc: string; pants: string; long: boolean; bag: boolean };

export function hash32(str: string): number {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Small deterministic random generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed | 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function characterFor(code: string): Character {
  const r = rng(hash32(code)), pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  return { name: pick(NAMES), top: pick(OUTFITS), skin: pick(SKINS), acc: pick(ACCENTS), pants: pick(PANTS), long: r() < .5, bag: r() < .5 };
}

/** A new random visitor code. `random` is injectable for tests; the default uses the browser's secure generator. */
export function randomCode(alphabet: string, random: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  return [...random(6)].map(v => alphabet[v % alphabet.length]).join('');
}
export const formatCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;
export const normalizeCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, '');
