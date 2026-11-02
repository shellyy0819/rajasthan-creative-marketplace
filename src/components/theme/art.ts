import type React from 'react';
import type { StickerId } from '@/lib/themes/stickers';

/** Sticker artwork, drawn in the 600x720 hero stall viewBox. Filled in as each sticker is drawn; ids without art are skipped. */
export const STICKER_ART: Partial<Record<StickerId, () => React.ReactElement>> = {};
