import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { getDb, type Q } from '../../db/client';
import { siteThemes } from '../../db/schema';
import { ApiError } from '../errors';
import { bad, obj, type Raw } from '../validate';
import { dateToIst, istToDate } from './ist';
import { EVERYDAY, PRESETS, isPresetKey, type PresetKey } from './presets';
import { pickLive, renderThemeOf, stateOf } from './resolve';
import type { ThemeConfig, ThemeRow, ThemeStatus } from './types';
import { validateConfig, validateWindow } from './validate';

type Rendered = { preset: PresetKey; config: ThemeConfig };
const EVERYDAY_RENDER = (): Rendered => ({ preset: 'everyday', config: EVERYDAY.config });

/**
 * Row cache for getActiveTheme: the scheduled rows and the base row are kept in module memory for 30 seconds,
 * and the live theme is resolved from them against the requested instant (so windows open and close on time).
 * Every write in this module clears it; other server instances may lag by up to 30 seconds.
 */
const TTL_MS = 30_000;
let cache: { at: number; rows: ThemeRow[]; base: ThemeRow | undefined } | null = null;
export function clearThemeCache(): void { cache = null; }

type DbRow = typeof siteThemes.$inferSelect;

/** Never trust the preset column: an unknown value is treated as Everyday. */
function toRow(r: DbRow): ThemeRow {
  let preset: PresetKey = 'everyday';
  if (isPresetKey(r.preset)) preset = r.preset;
  else console.error(`site_themes row ${r.id} has unknown preset "${r.preset}"; treating it as Everyday.`);
  return {
    id: r.id, preset, status: r.status as ThemeStatus, startsAt: r.startsAt, endsAt: r.endsAt,
    config: r.config as ThemeConfig, updatedAt: r.updatedAt, ...(r.updatedBy ? { updatedBy: r.updatedBy } : {}),
  };
}

const notFound = () => new ApiError(404, 'Theme not found.');
const conflict = (m: string) => new ApiError(409, m);

async function load(q: Q, id: number): Promise<DbRow> {
  const [r] = await q.select().from(siteThemes).where(and(eq(siteThemes.id, id), ne(siteThemes.status, 'base')));
  if (!r) throw notFound();
  return r;
}

export async function listThemes(q: Q = getDb()): Promise<ThemeRow[]> {
  const rows = await q.select().from(siteThemes).where(ne(siteThemes.status, 'base')).orderBy(desc(siteThemes.startsAt), desc(siteThemes.id));
  return rows.map(toRow);
}

export async function getTheme(id: number, q: Q = getDb()): Promise<ThemeRow | undefined> {
  const [r] = await q.select().from(siteThemes).where(and(eq(siteThemes.id, id), ne(siteThemes.status, 'base')));
  return r ? toRow(r) : undefined;
}

/** The editable Everyday row; created from the built-in wording on first use. */
export async function getBase(q: Q = getDb()): Promise<ThemeRow> {
  const find = () => q.select().from(siteThemes).where(eq(siteThemes.status, 'base'));
  let [r] = await find();
  if (!r) {
    await q.insert(siteThemes).values({ preset: 'everyday', status: 'base', config: structuredClone(EVERYDAY.config) }).onConflictDoNothing();
    [r] = await find();
  }
  return toRow(r);
}

export async function createTheme(preset: PresetKey, by: string, q: Q = getDb()): Promise<ThemeRow> {
  if (!isPresetKey(preset)) throw bad('Unknown preset.');
  const p = PRESETS[preset] as (typeof PRESETS)[PresetKey] & { sample?: { startsAt: string; endsAt: string } };
  const [r] = await q.insert(siteThemes).values({
    preset, status: 'draft', config: structuredClone(p.config), updatedBy: by,
    startsAt: p.sample ? istToDate(p.sample.startsAt) : null, endsAt: p.sample ? istToDate(p.sample.endsAt) : null,
  }).returning();
  clearThemeCache();
  return toRow(r);
}

const blank = (v: unknown) => v === null || v === '';

export async function updateTheme(id: number, raw: { config?: unknown; startsAtIst?: unknown; endsAtIst?: unknown }, by: string, q: Q = getDb()): Promise<ThemeRow> {
  const cur = await load(q, id);
  const patch: Partial<typeof siteThemes.$inferInsert> = { updatedBy: by, updatedAt: new Date() };
  if (raw.config !== undefined) patch.config = validateConfig(raw.config);
  if (raw.startsAtIst !== undefined || raw.endsAtIst !== undefined) {
    const s = raw.startsAtIst === undefined ? (cur.startsAt ? dateToIst(cur.startsAt) : null) : blank(raw.startsAtIst) ? null : raw.startsAtIst;
    const e = raw.endsAtIst === undefined ? (cur.endsAt ? dateToIst(cur.endsAt) : null) : blank(raw.endsAtIst) ? null : raw.endsAtIst;
    if (s === null && e === null) {
      if (cur.status === 'scheduled') throw bad('A scheduled theme needs a start and an end.');
      patch.startsAt = null; patch.endsAt = null;
    } else if (s === null || e === null) {
      if (cur.status === 'scheduled') throw bad('A scheduled theme needs a start and an end.');
      const v = (s ?? e) as unknown;
      if (typeof v !== 'string') throw bad('Dates must be like 2026-11-07T06:00 (IST).');
      let d: Date;
      try { d = istToDate(v); } catch { throw bad('Dates must be like 2026-11-07T06:00 (IST).'); }
      patch.startsAt = s === null ? null : d; patch.endsAt = e === null ? null : d;
    } else {
      const w = validateWindow(s, e);
      patch.startsAt = w.startsAt; patch.endsAt = w.endsAt;
    }
  }
  const [r] = await q.update(siteThemes).set(patch).where(eq(siteThemes.id, id)).returning();
  clearThemeCache();
  return toRow(r);
}

export async function scheduleTheme(id: number, by: string, q: Q = getDb()): Promise<ThemeRow> {
  const cur = await load(q, id);
  if (!cur.startsAt || !cur.endsAt) throw bad('Set a start and an end before scheduling.');
  if (cur.endsAt.getTime() <= cur.startsAt.getTime()) throw bad('The end must be after the start.');
  const config = validateConfig(cur.config);
  const [r] = await q.update(siteThemes).set({ status: 'scheduled', config, updatedBy: by, updatedAt: new Date() }).where(eq(siteThemes.id, id)).returning();
  clearThemeCache();
  return toRow(r);
}

export async function unscheduleTheme(id: number, by: string, q: Q = getDb()): Promise<ThemeRow> {
  await load(q, id);
  const [r] = await q.update(siteThemes).set({ status: 'draft', updatedBy: by, updatedAt: new Date() }).where(eq(siteThemes.id, id)).returning();
  clearThemeCache();
  return toRow(r);
}

/** Ends a theme that is live at `now` by setting its end to `now`. */
export async function endNow(id: number, by: string, now = new Date(), q: Q = getDb()): Promise<ThemeRow> {
  const cur = toRow(await load(q, id));
  if (stateOf(cur, now) !== 'live') throw conflict('Only a live theme can be ended now.');
  if (now.getTime() <= cur.startsAt!.getTime()) throw conflict('This theme only just started; try again in a moment.');
  const [r] = await q.update(siteThemes).set({ endsAt: now, updatedBy: by, updatedAt: new Date() }).where(eq(siteThemes.id, id)).returning();
  clearThemeCache();
  return toRow(r);
}

export async function deleteTheme(id: number, q: Q = getDb()): Promise<void> {
  const gone = await q.delete(siteThemes).where(and(eq(siteThemes.id, id), ne(siteThemes.status, 'base'))).returning({ id: siteThemes.id });
  if (!gone.length) throw notFound();
  clearThemeCache();
}

export async function updateBase(raw: { config?: unknown }, by: string, q: Q = getDb()): Promise<ThemeRow> {
  const base = await getBase(q);
  obj(raw as Raw);
  if (raw.config === undefined) throw bad('config is required.');
  const config = validateConfig(raw.config);
  const [r] = await q.update(siteThemes).set({ config, updatedBy: by, updatedAt: new Date() }).where(eq(siteThemes.id, base.id)).returning();
  clearThemeCache();
  return toRow(r);
}

/** The theme to render at `now`: the live scheduled theme, else the (editable) Everyday base. Never throws. */
export async function getActiveTheme(now: Date = new Date()): Promise<Rendered> {
  try {
    if (!cache || Date.now() - cache.at >= TTL_MS) {
      const db = getDb();
      const raw = await db.select().from(siteThemes).where(inArray(siteThemes.status, ['scheduled', 'base']));
      const base = raw.find(r => r.status === 'base');
      const rows = raw.filter(r => r.status === 'scheduled').filter(r => {
        if (isPresetKey(r.preset)) return true;
        console.error(`site_themes row ${r.id} has unknown preset "${r.preset}"; ignoring it (Everyday applies).`);
        return false;
      }).map(toRow);
      cache = { at: Date.now(), rows, base: base ? toRow(base) : undefined };
    }
    return renderThemeOf(pickLive(cache.rows, now), cache.base);
  } catch (e) {
    console.error('getActiveTheme failed; falling back to Everyday.', e);
    return EVERYDAY_RENDER();
  }
}
