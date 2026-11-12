import { describe, it, expect, beforeEach } from 'vitest';
import { KEEP_DAYS, listQuestDays, parseQuestSave, saveQuestDay } from '@/lib/fair-quest-days';
import { resetTestDb } from './helpers/testdb';

const A = 'a'.repeat(32), B = 'b'.repeat(32), NOW = new Date('2026-11-12T10:00:00Z');
const quests = [{ id: 'meet3', title: 'Meet 3 makers', target: 3 }, { id: 'craft', title: 'Watch a maker at work', target: 1 }];
const save = (o: Record<string, unknown> = {}) => parseQuestSave({ code: 'ABC234', token: A, day: '2026-11-12', quests, progress: { meet3: ['dhaga'] }, ...o });
beforeEach(async () => { await resetTestDb(); });

describe('parseQuestSave', () => {
  it('accepts a day of quests with progress', () => { expect(save()).toMatchObject({ code: 'ABC234', day: '2026-11-12', progress: { meet3: ['dhaga'] } }); });
  it('rejects a bad day, quest list, quest or progress', () => {
    for (const day of ['12-11-2026', '2026-13-01', 'today', 5]) expect(() => save({ day })).toThrow(/day/);
    expect(() => save({ quests: [] })).toThrow(/quests/);
    expect(() => save({ quests: [{ id: 'fly', title: 'x', target: 1 }] })).toThrow(/quest/i);
    expect(() => save({ quests: [{ id: 'craft', title: '', target: 1 }] })).toThrow(/title/);
    expect(() => save({ quests: [{ id: 'craft', title: 'x', target: 9 }] })).toThrow(/target/);
    expect(() => save({ progress: { fly: ['x'] } })).toThrow(/quest/i);
    expect(() => save({ progress: { meet3: Array(13).fill('x') } })).toThrow(/Progress/);
    expect(() => save({ progress: { meet3: [5] } })).toThrow(/Progress/);
  });
});

describe('quest history', () => {
  it('keeps each day under the code and lists newest first', async () => {
    await saveQuestDay(save({ day: '2026-11-10', progress: { meet3: ['a', 'b', 'c'], craft: ['dhaga'] } }), NOW);
    await saveQuestDay(save({ day: '2026-11-12' }), NOW);
    const days = await listQuestDays({ code: 'ABC234', token: A }, NOW);
    expect(days.map(d => d.day)).toEqual(['2026-11-12', '2026-11-10']);
    expect(days[1]).toMatchObject({ quests, progress: { meet3: ['a', 'b', 'c'], craft: ['dhaga'] } });
  });
  it('saving the same day again replaces it', async () => {
    await saveQuestDay(save(), NOW);
    await saveQuestDay(save({ progress: { meet3: ['dhaga', 'kaath'], craft: ['x'] } }), NOW);
    const days = await listQuestDays({ code: 'ABC234', token: A }, NOW);
    expect(days).toHaveLength(1);
    expect(days[0].progress).toEqual({ meet3: ['dhaga', 'kaath'], craft: ['x'] });
  });
  it('one code never sees another code\'s days', async () => {
    await saveQuestDay(save(), NOW);
    await saveQuestDay(save({ code: 'XYZ234', token: B }), NOW);
    expect((await listQuestDays({ code: 'XYZ234', token: B }, NOW))).toHaveLength(1);
    expect((await listQuestDays({ code: 'ABC234', token: A }, NOW))).toHaveLength(1);
  });
  it('only the owner of the code can save or read', async () => {
    await saveQuestDay(save(), NOW);
    await expect(saveQuestDay(save({ token: B }), NOW)).rejects.toMatchObject({ status: 409 });
    await expect(listQuestDays({ code: 'ABC234', token: B }, NOW)).rejects.toMatchObject({ status: 409 });
  });
  it('forgets days older than the history limit', async () => {
    await saveQuestDay(save({ day: '2026-08-01' }), new Date('2026-08-01T10:00:00Z'));
    await saveQuestDay(save({ day: '2026-11-12' }), NOW);
    expect((await listQuestDays({ code: 'ABC234', token: A }, NOW)).map(d => d.day)).toEqual(['2026-11-12']);
    expect(KEEP_DAYS).toBe(60);
  });
});
