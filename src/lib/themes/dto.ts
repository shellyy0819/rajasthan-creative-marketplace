import { dateToIst } from './ist';
import { PRESETS, type PresetKey } from './presets';
import { stateOf } from './resolve';
import type { ThemeConfig, ThemeRow, ThemeState } from './types';

export type ThemeDto = {
  id: number; preset: PresetKey; label: string; state: ThemeState;
  startsAtIst: string | null; endsAtIst: string | null;
  config: ThemeConfig; effectivePrimary: string; updatedAt: string; updatedBy?: string;
};

export function toDto(row: ThemeRow, now: Date = new Date()): ThemeDto {
  const p = PRESETS[row.preset];
  return {
    id: row.id, preset: row.preset, label: p.label, state: stateOf(row, now),
    startsAtIst: row.startsAt ? dateToIst(row.startsAt) : null,
    endsAtIst: row.endsAt ? dateToIst(row.endsAt) : null,
    config: row.config, effectivePrimary: row.config.primary ?? p.primary,
    updatedAt: row.updatedAt.toISOString(), ...(row.updatedBy ? { updatedBy: row.updatedBy } : {}),
  };
}
