import { EVERYDAY, type PresetKey } from './presets';
import type { ThemeConfig, ThemeRow, ThemeState } from './types';

export function stateOf(row: ThemeRow, now: Date): ThemeState {
  if (row.status === 'draft') return 'draft';
  if (row.status === 'base') return 'base';
  if (!row.startsAt || !row.endsAt) return 'draft';
  const t = now.getTime();
  if (t < row.startsAt.getTime()) return 'scheduled';
  if (t < row.endsAt.getTime()) return 'live';
  return 'ended';
}

export function pickLive(rows: ThemeRow[], now: Date): ThemeRow | undefined {
  let best: ThemeRow | undefined;
  for (const r of rows) {
    if (r.status !== 'scheduled' || stateOf(r, now) !== 'live') continue;
    if (!best) { best = r; continue; }
    const a = r.startsAt!.getTime(), b = best.startsAt!.getTime();
    if (a > b || (a === b && r.id > best.id)) best = r;
  }
  return best;
}

export function renderThemeOf(live: ThemeRow | undefined, base: ThemeRow | undefined): { preset: PresetKey; config: ThemeConfig } {
  if (live) return { preset: live.preset, config: live.config };
  if (base) return { preset: 'everyday', config: base.config };
  return { preset: 'everyday', config: EVERYDAY.config };
}
