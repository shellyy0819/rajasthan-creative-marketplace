import type React from 'react';
import type { StickerId } from '@/lib/themes/stickers';
import { Diya1, Diya2, Kalash, Lantern, Lights, Rangoli, Toran } from './stickers/dhanteras';
import { DDiyas, DFire, DKandil, DLights, DRangoli, DThali } from './stickers/diwali';
import { XGifts, XLights, XSanta, XSnow, XStar, XTree, XWreath } from './stickers/christmas';
import { GBowls, GFlags, GMound } from './stickers/govardhan';
import { BSweets, BThread, BTika } from './stickers/bhaidooj';
import { CCane, CSoop, CSun } from './stickers/chhath';
import { NBowl, NCandles, NHanging } from './stickers/gurunanak';
import { TGarland, TLeaves, TPumpkins, TTurkey } from './stickers/thanksgiving';

/** Sticker artwork, drawn in the 600x720 hero stall viewBox at each sticker's default location. Ids without art are skipped. */
export const STICKER_ART: Partial<Record<StickerId, () => React.ReactElement>> = {
  toran: Toran, lights: Lights, diya1: Diya1, diya2: Diya2, kalash: Kalash, rangoli: Rangoli, lantern: Lantern,
  dfire: DFire, dkandil: DKandil, dlights: DLights, ddiyas: DDiyas, dthali: DThali, drangoli: DRangoli,
  xtree: XTree, xwreath: XWreath, xlights: XLights, xgifts: XGifts, xsnow: XSnow, xstar: XStar, xsanta: XSanta,
  gflags: GFlags, gmound: GMound, gbowls: GBowls,
  bthread: BThread, btika: BTika, bsweets: BSweets,
  csun: CSun, ccane: CCane, csoop: CSoop,
  nhanging: NHanging, ncandles: NCandles, nbowl: NBowl,
  tgarland: TGarland, tpumpkins: TPumpkins, tleaves: TLeaves, tturkey: TTurkey,
};
