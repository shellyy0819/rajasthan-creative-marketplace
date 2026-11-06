import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { getTestDb, resetTestDb } from './helpers/testdb';
import { setDb } from '@/db/client';
import { siteThemes } from '@/db/schema';
import { PRESETS } from '@/lib/themes/presets';
import { istToDate } from '@/lib/themes/ist';
import {
  clearThemeCache, createTheme, deleteTheme, endNow, getActiveTheme, getBase, getTheme, listThemes,
  scheduleTheme, unscheduleTheme, updateBase, updateTheme,
} from '@/lib/themes/store';

beforeAll(async () => { await getTestDb(); }, 30_000);
beforeEach(async () => { await resetTestDb(); clearThemeCache(); });
afterEach(() => { vi.restoreAllMocks(); setDbBack(); });
const setDbBack = () => { void getTestDb(); };

const ist = (s: string) => istToDate(s);
const status = (e: unknown) => (e as { status?: number }).status;

describe('site_themes table', () => {
  it('rejects a second base row and a scheduled row without dates', async () => {
    const db = await getTestDb();
    const cfg = JSON.stringify(PRESETS.everyday.config);
    await db.execute(sql`insert into site_themes (preset, status, config) values ('everyday', 'base', ${cfg}::jsonb)`);
    await expect(db.execute(sql`insert into site_themes (preset, status, config) values ('everyday', 'base', ${cfg}::jsonb)`)).rejects.toThrow();
    await expect(db.execute(sql`insert into site_themes (preset, status, config) values ('diwali', 'scheduled', ${cfg}::jsonb)`)).rejects.toThrow();
    await expect(db.execute(sql`insert into site_themes (preset, status, starts_at, ends_at, config) values ('diwali', 'draft', now(), now() - interval '1 day', ${cfg}::jsonb)`)).rejects.toThrow();
  });
});

describe('theme store', () => {
  it('createTheme makes a draft with sample dates and the preset config', async () => {
    const t = await createTheme('dhanteras', 'a@x.com');
    expect(t.status).toBe('draft');
    expect(t.preset).toBe('dhanteras');
    expect(t.startsAt).toEqual(ist('2026-11-05T06:00'));
    expect(t.endsAt).toEqual(ist('2026-11-06T23:59'));
    expect(t.config).toEqual(PRESETS.dhanteras.config);
    expect(t.updatedBy).toBe('a@x.com');
    expect(await listThemes()).toHaveLength(1);
    expect((await getTheme(t.id))?.id).toBe(t.id);
    expect(await getTheme(9999)).toBeUndefined();
  });

  it('updateTheme stores a valid config and rejects an invalid one without changing the row', async () => {
    const t = await createTheme('dhanteras', 'a');
    const next = { ...t.config, banner: 'Happy Dhanteras' };
    expect((await updateTheme(t.id, { config: next }, 'b')).config.banner).toBe('Happy Dhanteras');
    const err = await updateTheme(t.id, { config: { ...next, banner: '' } }, 'b').catch(e => e);
    expect(status(err)).toBe(400);
    expect((await getTheme(t.id))!.config.banner).toBe('Happy Dhanteras');
    expect(status(await updateTheme(9999, { config: next }, 'b').catch(e => e))).toBe(404);
  });

  it('updateTheme changes the window and rejects an end before the start', async () => {
    const t = await createTheme('dhanteras', 'a');
    const u = await updateTheme(t.id, { startsAtIst: '2026-11-04T06:00', endsAtIst: '2026-11-04T20:00' }, 'a');
    expect(u.startsAt).toEqual(ist('2026-11-04T06:00'));
    expect(status(await updateTheme(t.id, { endsAtIst: '2026-11-03T06:00' }, 'a').catch(e => e))).toBe(400);
    expect((await getTheme(t.id))!.endsAt).toEqual(ist('2026-11-04T20:00'));
  });

  it('scheduleTheme goes live only inside the window', async () => {
    const t = await createTheme('dhanteras', 'a');
    expect((await scheduleTheme(t.id, 'a')).status).toBe('scheduled');
    expect((await getActiveTheme(ist('2026-11-05T05:59'))).preset).toBe('everyday');
    expect(await getActiveTheme(ist('2026-11-05T06:00'))).toEqual({ preset: 'dhanteras', config: PRESETS.dhanteras.config });
    expect((await getActiveTheme(ist('2026-11-06T23:58'))).preset).toBe('dhanteras');
    clearThemeCache();
    expect((await getActiveTheme(ist('2026-11-06T23:59'))).preset).toBe('everyday');
  });

  it('later start wins on overlap', async () => {
    const a = await createTheme('dhanteras', 'a');
    const b = await createTheme('diwali', 'a');
    await updateTheme(a.id, { startsAtIst: '2026-11-05T06:00', endsAtIst: '2026-11-09T06:00' }, 'a');
    await updateTheme(b.id, { startsAtIst: '2026-11-07T06:00', endsAtIst: '2026-11-08T06:00' }, 'a');
    await scheduleTheme(a.id, 'a'); await scheduleTheme(b.id, 'a');
    expect((await getActiveTheme(ist('2026-11-07T12:00'))).preset).toBe('diwali');
    expect((await getActiveTheme(ist('2026-11-06T12:00'))).preset).toBe('dhanteras');
  });

  it('unscheduleTheme returns to draft and stops applying', async () => {
    const t = await createTheme('dhanteras', 'a');
    await scheduleTheme(t.id, 'a');
    expect((await unscheduleTheme(t.id, 'a')).status).toBe('draft');
    expect((await getActiveTheme(ist('2026-11-05T12:00'))).preset).toBe('everyday');
  });

  it('endNow ends a live theme; 409 for a future theme', async () => {
    const t = await createTheme('dhanteras', 'a');
    await scheduleTheme(t.id, 'a');
    const early = ist('2026-11-05T05:00');
    expect(status(await endNow(t.id, 'a', early).catch(e => e))).toBe(409);
    const now = ist('2026-11-05T12:00');
    expect((await endNow(t.id, 'a', now)).endsAt).toEqual(now);
    expect((await getActiveTheme(now)).preset).toBe('everyday');
  });

  it('deleteTheme of the live theme falls back to Everyday', async () => {
    const t = await createTheme('dhanteras', 'a');
    await scheduleTheme(t.id, 'a');
    const now = ist('2026-11-05T12:00');
    expect((await getActiveTheme(now)).preset).toBe('dhanteras');
    await deleteTheme(t.id);
    expect((await getActiveTheme(now)).preset).toBe('everyday');
    expect(status(await deleteTheme(t.id).catch(e => e))).toBe(404);
  });

  it('scheduleTheme needs dates', async () => {
    const t = await createTheme('everyday', 'a'); // everyday has no sample window
    expect(status(await scheduleTheme(t.id, 'a').catch(e => e))).toBe(400);
  });

  it('getBase creates exactly one row; updateBase changes the Everyday wording', async () => {
    const a = await getBase(); const b = await getBase();
    expect(a.id).toBe(b.id);
    expect(a.status).toBe('base');
    const db = await getTestDb();
    expect(await db.select().from(siteThemes)).toHaveLength(1);
    expect(await listThemes()).toHaveLength(0);
    await updateBase({ config: { ...a.config, banner: 'Welcome all' } }, 'a');
    expect(await getActiveTheme(ist('2026-11-01T12:00'))).toMatchObject({ preset: 'everyday', config: { banner: 'Welcome all' } });
  });

  it('treats an unknown stored preset as Everyday and logs', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t = await createTheme('dhanteras', 'a');
    await scheduleTheme(t.id, 'a');
    const db = await getTestDb();
    await db.execute(sql`update site_themes set preset = 'bogus' where id = ${t.id}`);
    clearThemeCache();
    expect((await getActiveTheme(ist('2026-11-05T12:00'))).preset).toBe('everyday');
    expect(err).toHaveBeenCalled();
  });

  it('returns Everyday, logging, when the query fails', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    setDb({ select() { throw new Error('db down'); } } as never);
    expect(await getActiveTheme(new Date())).toEqual({ preset: 'everyday', config: PRESETS.everyday.config });
    expect(err).toHaveBeenCalled();
  });

  it('caches rows for 30 seconds until a write clears it', async () => {
    const t = await createTheme('dhanteras', 'a');
    await scheduleTheme(t.id, 'a');
    const now = ist('2026-11-05T12:00');
    expect((await getActiveTheme(now)).preset).toBe('dhanteras');
    const db = await getTestDb();
    await db.execute(sql`delete from site_themes`); // behind the store's back
    expect((await getActiveTheme(now)).preset).toBe('dhanteras');
    clearThemeCache();
    expect((await getActiveTheme(now)).preset).toBe('everyday');
  });
});
