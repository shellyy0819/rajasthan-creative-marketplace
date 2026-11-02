import type { Placement } from './types';

export type StickerBox = { x: number; y: number; w: number; h: number };

/** Moves by (x, y), then scales by s about the centre of the sticker's box. Shared by the public layer and the editor. */
export function placementTransform(box: StickerBox, p: Placement): string {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return `translate(${p.x} ${p.y}) translate(${cx} ${cy}) scale(${p.s}) translate(${-cx} ${-cy})`;
}
