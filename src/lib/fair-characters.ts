import { LOOK_IDS, type LookId } from './fair-constants';

/**
 * The visitors' characters. There are ten looks to choose from, five female and five male. A visitor code gives a starting look
 * (the same on any device, with no server involved) and the visitor can change it any time from "My look".
 */
export type Gender = 'female' | 'male';
export type HairStyle = 'short' | 'long' | 'bun' | 'braid' | 'bob';
export type Headwear = { kind: 'pagdi' | 'cap'; color: string } | null;
export type Character = {
  id: LookId; gender: Gender; name: string;
  top: string; skin: string; acc: string; pants: string;
  hairStyle: HairStyle; headwear: Headwear; beard: boolean; bindi: boolean; bag: boolean;
};

/** `acc` is the dupatta or stole worn across the shoulder. */
export const LOOKS: Record<LookId, Character> = {
  f1: { id: 'f1', gender: 'female', name: 'Tara', top: '#c66b43', skin: '#e0ac86', acc: '#d9a441', pants: '#35506f', hairStyle: 'long', headwear: null, beard: false, bindi: true, bag: false },
  f2: { id: 'f2', gender: 'female', name: 'Meher', top: '#35506f', skin: '#c98b62', acc: '#fbf7ef', pants: '#575a4d', hairStyle: 'bun', headwear: null, beard: false, bindi: true, bag: true },
  f3: { id: 'f3', gender: 'female', name: 'Noor', top: '#405746', skin: '#8e5b3c', acc: '#e58aa6', pants: '#2b3a31', hairStyle: 'braid', headwear: null, beard: false, bindi: false, bag: false },
  f4: { id: 'f4', gender: 'female', name: 'Anika', top: '#d9a441', skin: '#e0ac86', acc: '#4fb6b8', pants: '#35506f', hairStyle: 'bob', headwear: null, beard: false, bindi: false, bag: true },
  f5: { id: 'f5', gender: 'female', name: 'Zoya', top: '#7a4e8f', skin: '#c98b62', acc: '#d9a441', pants: '#8a5f3c', hairStyle: 'long', headwear: null, beard: false, bindi: false, bag: false },
  m1: { id: 'm1', gender: 'male', name: 'Veer', top: '#fbf7ef', skin: '#c98b62', acc: '#d9a441', pants: '#35506f', hairStyle: 'short', headwear: { kind: 'pagdi', color: '#b3262e' }, beard: true, bindi: false, bag: false },
  m2: { id: 'm2', gender: 'male', name: 'Kabir', top: '#405746', skin: '#8e5b3c', acc: '#fbf7ef', pants: '#575a4d', hairStyle: 'short', headwear: null, beard: true, bindi: false, bag: false },
  m3: { id: 'm3', gender: 'male', name: 'Dev', top: '#35506f', skin: '#e0ac86', acc: '#c66b43', pants: '#8a5f3c', hairStyle: 'short', headwear: { kind: 'cap', color: '#d9a441' }, beard: false, bindi: false, bag: true },
  m4: { id: 'm4', gender: 'male', name: 'Rudra', top: '#7a4e8f', skin: '#8e5b3c', acc: '#4fb6b8', pants: '#2b3a31', hairStyle: 'short', headwear: { kind: 'pagdi', color: '#d9a441' }, beard: true, bindi: false, bag: false },
  m5: { id: 'm5', gender: 'male', name: 'Ishaan', top: '#c66b43', skin: '#c98b62', acc: '#fbf7ef', pants: '#35506f', hairStyle: 'short', headwear: null, beard: false, bindi: false, bag: true },
};
export const FEMALE_LOOKS = LOOK_IDS.filter(id => LOOKS[id].gender === 'female');
export const MALE_LOOKS = LOOK_IDS.filter(id => LOOKS[id].gender === 'male');

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
/** The look a code starts with. */
export const lookFor = (code: string): LookId => LOOK_IDS[hash32(code) % LOOK_IDS.length];
export const characterOf = (id: LookId): Character => LOOKS[id];
/** A visitor's character: the look they picked, or the one their code starts with. */
export const characterFor = (code: string, look?: LookId | null): Character => LOOKS[look ?? lookFor(code)];

/** A new random visitor code. `random` is injectable for tests; the default uses the browser's secure generator. */
export function randomCode(alphabet: string, random: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  return [...random(6)].map(v => alphabet[v % alphabet.length]).join('');
}
export const formatCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;
export const normalizeCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, '');
