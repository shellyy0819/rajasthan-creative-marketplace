import { desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { fairNotes } from '../db/schema';
import { ApiError } from './errors';
import { CODE_TAKEN, claimCode, parseClaim } from './fair-codes';
import type { FairSource } from './fair-types';
import { bad, obj, oneOf } from './validate';

export const NOTE_MAX = 280;
export type NoteInput = { code: string; token: string; stall: string; text: string; rating: number; source: FairSource };
export type FairNote = { id: number; code: string; stall: string; text: string; rating: number; source: FairSource; createdAt: string };

export function parseNote(input: unknown): NoteInput {
  const b = obj(input), claim = parseClaim(b);
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (!text) throw bad('Write a few words first, then send your note.');
  if (text.length > NOTE_MAX) throw bad(`Keep your note to ${NOTE_MAX} characters.`);
  const rating = b.rating === undefined ? 0 : b.rating;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 0 || rating > 5) throw bad('rating must be a whole number from 0 to 5.');
  const stall = typeof b.stall === 'string' ? b.stall.trim().slice(0, 120) : '';
  if (!stall) throw bad('stall is required.');
  return { ...claim, stall, text, rating, source: oneOf(b.source, 'source', ['real', 'sample'] as const) };
}

/** Saves a note for admins. Only the owner of the code can leave one, so a note can be traced to a visitor code but never to a person. */
export async function createNote(n: NoteInput, now = new Date()): Promise<{ id: number }> {
  if (await claimCode({ code: n.code, token: n.token }, now) === 'taken') throw new ApiError(409, CODE_TAKEN);
  const [row] = await getDb().insert(fairNotes).values({ code: n.code, stall: n.stall, text: n.text, rating: n.rating, source: n.source, createdAt: now }).returning({ id: fairNotes.id });
  return { id: row.id };
}

const toNote = (r: typeof fairNotes.$inferSelect): FairNote => ({ id: r.id, code: r.code, stall: r.stall, text: r.text, rating: r.rating, source: r.source as FairSource, createdAt: r.createdAt.toISOString() });
export async function listNotes(limit = 300): Promise<FairNote[]> {
  return (await getDb().select().from(fairNotes).orderBy(desc(fairNotes.createdAt), desc(fairNotes.id)).limit(limit)).map(toNote);
}
export async function deleteNote(id: number): Promise<void> {
  const rows = await getDb().delete(fairNotes).where(eq(fairNotes.id, id)).returning({ id: fairNotes.id });
  if (!rows.length) throw new ApiError(404, 'Note not found.');
}
