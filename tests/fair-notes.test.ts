import { describe, it, expect, beforeEach } from 'vitest';
import { NOTE_MAX, createNote, deleteNote, listNotes, parseNote } from '@/lib/fair-notes';
import { claimCode } from '@/lib/fair-codes';
import { resetTestDb } from './helpers/testdb';

const A = 'a'.repeat(32), B = 'b'.repeat(32);
const body = (o: Record<string, unknown> = {}) => ({ code: 'ABC234', token: A, stall: 'Bandhej Boutique', text: 'Lovely fair', rating: 4, source: 'sample', ...o });
beforeEach(async () => { await resetTestDb(); });

describe('parseNote', () => {
  it('accepts a good note and trims it', () => {
    expect(parseNote(body({ text: '  Lovely fair  ' }))).toMatchObject({ code: 'ABC234', stall: 'Bandhej Boutique', text: 'Lovely fair', rating: 4, source: 'sample' });
  });
  it('rating is optional and defaults to none', () => { expect(parseNote(body({ rating: undefined })).rating).toBe(0); });
  it('refuses empty or very long notes', () => {
    expect(() => parseNote(body({ text: '   ' }))).toThrow(/few words/);
    expect(() => parseNote(body({ text: 'x'.repeat(NOTE_MAX + 1) }))).toThrow(/280/);
    expect(parseNote(body({ text: 'x'.repeat(NOTE_MAX) })).text).toHaveLength(NOTE_MAX);
  });
  it('refuses a bad rating, source, stall, code or secret', () => {
    for (const rating of [6, -1, 2.5, '4']) expect(() => parseNote(body({ rating }))).toThrow(/rating/);
    expect(() => parseNote(body({ source: 'both' }))).toThrow(/source/);
    expect(() => parseNote(body({ stall: '' }))).toThrow(/stall/);
    expect(() => parseNote(body({ code: 'nope' }))).toThrow(/code/);
    expect(() => parseNote(body({ token: 'nope' }))).toThrow(/token/);
  });
});

describe('notes for the admin', () => {
  it('saves a note and lists the newest first', async () => {
    await createNote(parseNote(body({ text: 'First' })), new Date('2026-11-12T10:00:00Z'));
    await createNote(parseNote(body({ text: 'Second', rating: 0, source: 'real' })), new Date('2026-11-12T11:00:00Z'));
    const list = await listNotes();
    expect(list.map(n => n.text)).toEqual(['Second', 'First']);
    expect(list[1]).toMatchObject({ code: 'ABC234', stall: 'Bandhej Boutique', rating: 4, source: 'sample', createdAt: '2026-11-12T10:00:00.000Z' });
    expect(list[0].source).toBe('real');
  });
  it('only the owner of a code can leave a note under it', async () => {
    await claimCode({ code: 'ABC234', token: A });
    await expect(createNote(parseNote(body({ token: B })))).rejects.toMatchObject({ status: 409 });
    expect(await listNotes()).toEqual([]);
    await expect(createNote(parseNote(body()))).resolves.toEqual({ id: expect.any(Number) });
  });
  it('deletes a note, and says so when it is already gone', async () => {
    const { id } = await createNote(parseNote(body()));
    await deleteNote(id);
    expect(await listNotes()).toEqual([]);
    await expect(deleteNote(id)).rejects.toMatchObject({ status: 404 });
  });
});
