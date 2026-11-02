import { isStickerId, STICKERS } from '@/lib/themes/stickers';
import { placementTransform } from '@/lib/themes/transform';
import type { Placement } from '@/lib/themes/types';
import { STICKER_ART } from './art';

export function StickerLayer({ placements }: { placements: Placement[] }) {
  return (
    <>
      {placements.map((p, i) => {
        if (!isStickerId(p.id)) return null;
        const Art = STICKER_ART[p.id];
        if (!Art) return null;
        return <g key={`${p.id}-${i}`} transform={placementTransform(STICKERS[p.id].box, p)}><Art /></g>;
      })}
    </>
  );
}
