import { onColor, passesContrast, contrastRatio, isHex } from './contrast';
import { PRESETS, type PresetKey } from './presets';
import { STICKERS, type StickerId } from './stickers';
import type { Placement, ThemeConfig } from './types';
import type { StickerBox } from './transform';

export const MOVE_MIN = -300, MOVE_MAX = 300, SCALE_MIN = 0.4, SCALE_MAX = 3;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Keeps a placement inside the limits the server enforces (validate.ts), so a drag can never produce a rejected save. */
export function clampPlacement(p: Placement): Placement {
  return { id: p.id, x: round2(clamp(p.x, MOVE_MIN, MOVE_MAX)), y: round2(clamp(p.y, MOVE_MIN, MOVE_MAX)), s: round2(clamp(p.s, SCALE_MIN, SCALE_MAX)) };
}
export const nudge = (p: Placement, dx: number, dy: number): Placement => clampPlacement({ ...p, x: p.x + dx, y: p.y + dy });
export const resize = (p: Placement, ds: number): Placement => clampPlacement({ ...p, s: p.s + ds });

/** The sticker's drag halo after its placement is applied (the box moves by x/y and scales about its centre). */
export function haloOf(box: StickerBox, p: Placement): StickerBox {
  const w = box.w * p.s, h = box.h * p.s;
  return { x: box.x + box.w / 2 + p.x - w / 2, y: box.y + box.h / 2 + p.y - h / 2, w, h };
}

export const effectivePrimary = (preset: PresetKey, config: ThemeConfig): string =>
  isHex(config.primary) ? config.primary : PRESETS[preset].primary;

/** Live contrast of the best text colour on the primary: the editor shows it and disables Save under 4.5. */
export function primaryContrast(hex: string): { ratio: number; ok: boolean; text: string } {
  if (!isHex(hex)) return { ratio: 0, ok: false, text: '' };
  const text = onColor(hex);
  return { ratio: Math.round(contrastRatio(hex, text) * 10) / 10, ok: passesContrast(hex), text };
}

/** CSS variables for the editor's preview box (the public site scopes the same values to html[data-festival]). */
export function previewVars(preset: PresetKey, config: ThemeConfig): Record<string, string> {
  const p = PRESETS[preset];
  const vars: Record<string, string> = { ...(preset === 'everyday' ? {} : p.brand), ...(p.stall as Record<string, string>) };
  if (isHex(config.primary)) {
    vars['--green'] = config.primary;
    vars['--on-green'] = onColor(config.primary);
  }
  return vars;
}

export const addSticker = (list: Placement[], id: StickerId): Placement[] =>
  list.some((p) => p.id === id) ? list : [...list, { id, x: 0, y: 0, s: 1 }];
export const removeSticker = (list: Placement[], id: string): Placement[] => list.filter((p) => p.id !== id);

/** Sticker ids grouped by the festival they belong to, in catalogue order (for the editor's picker). */
export function stickerGroups(): { set: PresetKey; label: string; ids: StickerId[] }[] {
  const groups = new Map<PresetKey, StickerId[]>();
  for (const id of Object.keys(STICKERS) as StickerId[]) {
    const set = STICKERS[id].set;
    groups.set(set, [...(groups.get(set) ?? []), id]);
  }
  return [...groups].map(([set, ids]) => ({ set, label: PRESETS[set].label, ids }));
}
