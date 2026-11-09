import type { PresetKey } from './presets';

type Box = { x: number; y: number; w: number; h: number };
const s = (label: string, set: PresetKey, x: number, y: number, w: number, h: number) => ({ label, set, box: { x, y, w, h } as Box });

/** `box` is the sticker's drag halo in the 600x720 hero stall viewBox. */
export const STICKERS = {
  toran: s('Marigold toran', 'dhanteras', 62, 196, 464, 76),
  lights: s('String lights', 'dhanteras', 0, 0, 600, 70),
  diya1: s('Diya on counter', 'dhanteras', 72, 440, 40, 44),
  diya2: s('Diya on shelf', 'dhanteras', 460, 374, 40, 44),
  kalash: s('Kalash', 'dhanteras', 4, 600, 52, 66),
  rangoli: s('Rangoli', 'dhanteras', 30, 668, 124, 44),
  lantern: s('Lantern', 'dhanteras', 22, 18, 48, 92),
  dfire: s('Fireworks', 'diwali', 40, 10, 452, 120),
  dkandil: s('Akash kandil', 'diwali', 404, 0, 72, 126),
  dlights: s('Light curtain', 'diwali', 62, 230, 464, 100),
  ddiyas: s('Row of diyas', 'diwali', 52, 656, 440, 40),
  dthali: s('Mithai thali', 'diwali', 62, 456, 52, 28),
  drangoli: s('Lotus rangoli', 'diwali', 528, 672, 68, 36),
  xtree: s('Christmas tree', 'christmas', 0, 468, 70, 130),
  xwreath: s('Wreath', 'christmas', 102, 204, 56, 62),
  xlights: s('Festive lights', 'christmas', 0, 0, 600, 70),
  xgifts: s('Gift boxes', 'christmas', 64, 446, 62, 34),
  xsnow: s('Snowflakes', 'christmas', 14, 80, 572, 290),
  xstar: s('Hanging star', 'christmas', 274, 8, 52, 56),
  xsanta: s('Big Santa Claus', 'christmas', 396, 0, 100, 118),
  gflags: s('Pennant garland', 'govardhan', 0, 0, 600, 70),
  gmound: s('Hill of grain', 'govardhan', 62, 418, 60, 68),
  gbowls: s('Bowls of food', 'govardhan', 56, 648, 294, 46),
  bthread: s('Marigold strands', 'bhaidooj', 0, 0, 600, 70),
  btika: s('Tika plate', 'bhaidooj', 60, 462, 56, 22),
  bsweets: s('Box of laddus', 'bhaidooj', 452, 380, 60, 42),
  csun: s('Rising sun', 'chhath', 408, 12, 104, 104),
  ccane: s('Sugarcane', 'chhath', 6, 508, 70, 162),
  csoop: s('Fruit basket', 'chhath', 60, 452, 64, 32),
  nhanging: s('Hanging lamps', 'guru-nanak', 138, 0, 64, 112),
  ncandles: s('Row of candles', 'guru-nanak', 62, 426, 100, 60),
  nbowl: s('Bowl of prasad', 'guru-nanak', 66, 462, 44, 28),
  tgarland: s('Leaf garland', 'thanksgiving', 0, 0, 600, 70),
  tpumpkins: s('Pumpkins', 'thanksgiving', 40, 646, 160, 46),
  tleaves: s('Falling leaves', 'thanksgiving', 14, 80, 572, 290),
  tturkey: s('Turkey', 'thanksgiving', 514, 438, 56, 60),
} as const;

export type StickerId = keyof typeof STICKERS;
export const isStickerId = (v: unknown): v is StickerId => typeof v === 'string' && Object.hasOwn(STICKERS, v);
