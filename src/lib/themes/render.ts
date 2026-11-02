import { cache } from 'react';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { themeCss } from './css';
import { EVERYDAY, isPresetKey, type PresetKey } from './presets';
import { getActiveTheme, getTheme } from './store';
import type { ThemeConfig } from './types';
import { validateConfig } from './validate';

export type RenderTheme = { preset: PresetKey; config: ThemeConfig; css: string; previewing: boolean };

export const PREVIEW_COOKIE = 'rr_theme_preview';

const everyday = (): RenderTheme => ({ preset: 'everyday', config: EVERYDAY.config, css: themeCss('everyday', EVERYDAY.config), previewing: false });

/** Stored config is untrusted: anything malformed or with an unknown preset renders as Everyday. */
function checked(preset: unknown, config: unknown, previewing: boolean): RenderTheme {
  try {
    if (!isPresetKey(preset)) throw new Error(`unknown preset "${String(preset)}"`);
    const c = validateConfig(config);
    return { preset, config: c, css: themeCss(preset, c), previewing };
  } catch (e) {
    console.error('Stored theme is not valid; rendering Everyday instead.', e instanceof Error ? e.message : e);
    return everyday();
  }
}

async function previewId(): Promise<number | undefined> {
  const raw = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (!raw || !/^[1-9]\d{0,9}$/.test(raw)) return undefined;
  const session = await auth();
  if (session?.user?.role !== 'admin' || session.user.active === false) return undefined;
  return Number(raw);
}

/** The theme for this request; never throws. A preview cookie only counts for a signed-in admin. */
export const getRenderTheme = cache(async (): Promise<RenderTheme> => {
  try {
    const id = await previewId();
    if (id !== undefined) {
      const row = await getTheme(id);
      if (row) return checked(row.preset, row.config, true);
    }
    const active = await getActiveTheme();
    return checked(active.preset, active.config, false);
  } catch (e) {
    console.error('Could not load the site theme; rendering Everyday.', e instanceof Error ? e.message : e);
    return everyday();
  }
});
