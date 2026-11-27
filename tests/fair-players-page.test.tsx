import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const gate = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/lib/admin-page', () => ({ requireAdminPage: gate }));

import FairPlayersPage from '@/app/dashboard/fair-players/page';
import { fairEvents, fairPlayDays, fairQuestDays } from '@/db/schema';
import { getTestDb, resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); gate.mockClear(); });
const render = async (sp: Record<string, string> = {}) => renderToStaticMarkup(await FairPlayersPage({ searchParams: Promise.resolve(sp) }));

describe('the Fair players page, rendered', () => {
  it('shows an empty state when nobody has played', async () => {
    const html = await render();
    expect(html).toContain('No players yet');
    expect(gate).toHaveBeenCalledTimes(1);
  });
  it('shows a player\'s row with the code split, minutes and quests done out of offered, and the filter link', async () => {
    const db = await getTestDb(), t = new Date('2026-11-12T06:00:00Z');
    await db.insert(fairPlayDays).values({ code: 'ABC234', day: '2026-11-12', seconds: 190, firstAt: t, lastAt: t });
    await db.insert(fairEvents).values({ code: 'ABC234', kind: 'stall', detail: 'dhaga', at: t });
    await db.insert(fairQuestDays).values({ code: 'ABC234', day: '2026-11-12', quests: [{ id: 'meet3', title: 'Meet 3', target: 3 }, { id: 'craft', title: 'Watch', target: 1 }], progress: { meet3: ['a', 'b', 'c'] } });
    const html = await render();
    expect(html).toContain('<code>ABC-234</code>');
    expect(html).toContain('<td>3</td>');          // minutes: 190 seconds
    expect(html).toContain('1 of 2');
    expect(html).toContain('/dashboard/fair-players?done=all');
  });
  it('with ?done=all hides players who did not finish, and offers a link back', async () => {
    const db = await getTestDb(), t = new Date('2026-11-12T06:00:00Z');
    await db.insert(fairPlayDays).values({ code: 'ABC234', day: '2026-11-12', seconds: 60, firstAt: t, lastAt: t });
    const html = await render({ done: 'all' });
    expect(html).not.toContain('ABC-234');
    expect(html).toContain('Show everyone');
  });
});
