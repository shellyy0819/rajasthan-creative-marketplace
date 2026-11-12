import type { Emote, Facing } from './fair-types';

/** Plain constants shared by the fair's server code and its client code. Keep imports out of this file: the browser bundle uses it. */
/** Size of the fair floor in world units. The client draws the same floor; positions outside it are clamped. */
export const FAIR_WORLD = { w: 1050, h: 780 } as const;
/** Visitor codes: six characters, no O, I, L, 0 or 1 (they are easy to misread). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{6}$`);
export const FACINGS: readonly Facing[] = ['up', 'down', 'left', 'right'];
export const EMOTES: readonly Emote[] = ['wave', 'namaste', 'hello'];
