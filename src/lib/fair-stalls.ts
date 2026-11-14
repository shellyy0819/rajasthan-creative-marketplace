import type { FairMaker, FairStall } from './fair-types';

/** The fair has eight places: two rows of four. */
export const STALL_COUNT = 8;
/** The stalls every fair starts with, in floor order. A maker is matched to one by its category or product names. */
export const DEFAULT_STALLS = [
  { id: 'crochet', label: 'Handmade crochet', match: /crochet/i },
  { id: 'resin', label: 'Resin Art', match: /resin/i },
  { id: 'wood', label: 'Wood craft', match: /wood/i },
  { id: 'sarees', label: 'Sarees and suits', match: /saree|sari\b|suit|kurta|salwar|dupatta|lehenga/i },
  { id: 'christmas', label: 'Christmas items', match: /christmas|xmas|santa/i },
] as const;
export const OPEN_LABEL = 'Open stall';

/** Pads a list of stalls with open ones up to the eight places on the floor. */
export function fillStalls(stalls: FairStall[]): FairStall[] {
  return [...stalls.slice(0, STALL_COUNT), ...Array.from({ length: Math.max(0, STALL_COUNT - stalls.length) }, () => ({ maker: null, label: OPEN_LABEL }))];
}
export const stallsOf = (makers: FairMaker[]): FairStall[] => fillStalls(makers.map(m => ({ maker: m, label: m.category })));
/** The maker list for a floor plan. */
export const makersOf = (stalls: FairStall[]): FairMaker[] => stalls.flatMap(s => (s.maker ? [s.maker] : []));
