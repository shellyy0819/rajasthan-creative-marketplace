import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '@/lib/themes/presets';
import { istToDate } from '@/lib/themes/ist';

const sql = fs.readFileSync('drizzle/0037_shilpgram_theme_draft.sql', 'utf8');

describe('the migration that adds a draft Shilpgram theme to the admin list', () => {
  it('is in the migration journal', () => {
    const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8')) as { entries: { tag: string }[] };
    expect(journal.entries.map(e => e.tag)).toContain('0037_shilpgram_theme_draft');
  });
  it('adds one draft, never a scheduled theme, so nothing changes on the site until an admin schedules it', () => {
    expect(sql).toMatch(/SELECT 'shilpgram', 'draft'/);
    expect(sql).not.toMatch(/'scheduled'/);
  });
  it('uses exactly the preset\'s wording and sample window (IST), so it matches a draft made from the dropdown', () => {
    const config = JSON.parse(sql.match(/'(\{.*\})'::jsonb/)![1]);
    expect(config).toEqual(PRESETS.shilpgram.config);
    const [, starts, ends] = sql.match(/'draft', '([^']+)', '([^']+)'/)!;
    const sample = PRESETS.shilpgram.sample;
    expect(new Date(starts).getTime()).toBe(istToDate(sample.startsAt).getTime());
    expect(new Date(ends).getTime()).toBe(istToDate(sample.endsAt).getTime());
  });
  it('runs once only: skipped when a Shilpgram theme already exists, so a deleted row stays deleted and an existing one is never touched', () => {
    expect(sql).toMatch(/WHERE NOT EXISTS \(SELECT 1 FROM "site_themes" WHERE "preset" = 'shilpgram'\)/);
  });
});
