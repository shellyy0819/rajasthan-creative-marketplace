import type { Emote, Facing } from './fair-types';

/** Plain constants shared by the fair's server code and its client code. Keep imports out of this file: the browser bundle uses it. */
/** Size of the fair floor in world units. The client draws the same floor; positions outside it are clamped. */
export const FAIR_WORLD = { w: 1050, h: 780 } as const;
/** Visitor codes: six characters, no O, I, L, 0 or 1 (they are easy to misread). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{6}$`);
export const FACINGS: readonly Facing[] = ['up', 'down', 'left', 'right'];
export const EMOTES: readonly Emote[] = ['wave', 'namaste', 'hello'];
/** The ten looks a visitor can pick from: five female (f1 to f5) and five male (m1 to m5). */
export const LOOK_IDS = ['f1', 'f2', 'f3', 'f4', 'f5', 'm1', 'm2', 'm3', 'm4', 'm5'] as const;
export type LookId = (typeof LOOK_IDS)[number];
export const isLookId = (v: unknown): v is LookId => typeof v === 'string' && (LOOK_IDS as readonly string[]).includes(v);
/** The daily quests a fair can offer. */
export const QUEST_IDS = ['meet3', 'gift500', 'tryon', 'selfie', 'craft', 'note', 'emote'] as const;
export type QuestId = (typeof QUEST_IDS)[number];
