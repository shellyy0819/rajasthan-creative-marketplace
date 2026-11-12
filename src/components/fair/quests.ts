import { hash32, rng } from '@/lib/fair-characters';
import type { QuestId } from '@/lib/fair-constants';
import type { FairData } from '@/lib/fair-types';
import { isWearable } from './wear';

/**
 * Daily quests. Three a day, chosen from the ones this fair can actually offer (a quest about the mirror only appears when a stall has one).
 * Progress is kept per visitor code per day. Rewards are cosmetic: a lit diya for each quest, and a marigold garland for all three.
 */
export type { QuestId };
export type Quest = { id: QuestId; title: string; hint: string; target: number };
export type GameEvent =
  | { type: 'visit'; makerId: string } | { type: 'shortlist'; itemKey: string; pricePaise: number } | { type: 'tryon'; itemKey: string }
  | { type: 'selfie' } | { type: 'craft'; makerId: string } | { type: 'note' } | { type: 'emote' };
/** Distinct things done so far, per quest. */
export type QuestState = { day: string; progress: Partial<Record<QuestId, string[]>> };

export const GIFT_LIMIT_PAISE = 50_000;
export const DAILY_COUNT = 3;
/** Today's date in India (the fair's home), so every visitor's day turns over at the same moment. */
export const dayKey = (now = new Date()) => new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

/** The quests this fair can offer, given its makers. */
export function availableQuests(data: FairData): Quest[] {
  const makers = data.makers, mirror = makers.find(m => m.mirror);
  const hasGift = makers.some(m => m.items.some(i => i.pricePaise <= GIFT_LIMIT_PAISE));
  const hasWearable = !!mirror && mirror.items.some(isWearable);
  const out: Quest[] = [];
  if (makers.length >= 1) out.push({ id: 'meet3', title: `Meet ${Math.min(3, makers.length)} ${Math.min(3, makers.length) === 1 ? 'maker' : 'makers'}`, hint: 'Walk up to a counter to get a stamp.', target: Math.min(3, makers.length) });
  if (hasGift) out.push({ id: 'gift500', title: 'Find a gift under ₹500', hint: 'Add something that costs ₹500 or less to your shortlist.', target: 1 });
  if (hasWearable) out.push({ id: 'tryon', title: 'Try something on', hint: 'Use the mirror to try on a saree, a suit or earrings.', target: 1 });
  if (mirror) out.push({ id: 'selfie', title: 'Take a mirror selfie', hint: 'Tap the camera icon by the mirror.', target: 1 });
  if (makers.length >= 1) out.push({ id: 'craft', title: 'Watch a maker at work', hint: 'Tap a maker to see their craft.', target: 1 });
  if (mirror) out.push({ id: 'note', title: 'Leave a note on the mirror wall', hint: 'Tap the note icon by the mirror.', target: 1 });
  out.push({ id: 'emote', title: 'Say hello', hint: 'Wave or say namaste.', target: 1 });
  return out;
}
/** Three quests for the day: the same for everyone on the same day, different from day to day. */
export function questsFor(data: FairData, day: string): Quest[] {
  const pool = availableQuests(data), r = rng(hash32(`quests:${day}`));
  const picked: Quest[] = [];
  while (picked.length < Math.min(DAILY_COUNT, pool.length)) picked.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return picked;
}
export const emptyState = (day: string): QuestState => ({ day, progress: {} });
export const countOf = (s: QuestState, q: Quest) => Math.min(q.target, s.progress[q.id]?.length ?? 0);
export const isDone = (s: QuestState, q: Quest) => countOf(s, q) >= q.target;

/** The token an event adds to a quest, or null when the event does not count for it. */
function token(q: Quest, e: GameEvent): string | null {
  switch (q.id) {
    case 'meet3': return e.type === 'visit' ? e.makerId : null;
    case 'gift500': return e.type === 'shortlist' && e.pricePaise <= GIFT_LIMIT_PAISE ? e.itemKey : null;
    case 'tryon': return e.type === 'tryon' ? e.itemKey : null;
    case 'selfie': return e.type === 'selfie' ? 'selfie' : null;
    case 'craft': return e.type === 'craft' ? e.makerId : null;
    case 'note': return e.type === 'note' ? 'note' : null;
    case 'emote': return e.type === 'emote' ? 'emote' : null;
  }
}
/** Applies an event. Returns the new state and the quests this event just completed. */
export function applyEvent(state: QuestState, quests: Quest[], e: GameEvent): { state: QuestState; completed: Quest[] } {
  const progress = { ...state.progress }, completed: Quest[] = [];
  for (const q of quests) {
    const t = token(q, e);
    if (!t) continue;
    const had = progress[q.id] ?? [];
    if (had.includes(t) || had.length >= q.target) continue;
    progress[q.id] = [...had, t];
    if (had.length + 1 >= q.target) completed.push(q);
  }
  return { state: { ...state, progress }, completed };
}
/** Reads saved progress and drops anything from another day or that is not a known quest. */
export function restoreState(raw: unknown, day: string): QuestState {
  const r = raw && typeof raw === 'object' ? raw as Partial<QuestState> : {};
  if (r.day !== day || !r.progress || typeof r.progress !== 'object') return emptyState(day);
  const progress: QuestState['progress'] = {};
  for (const [k, v] of Object.entries(r.progress)) if (Array.isArray(v)) progress[k as QuestId] = v.filter((x): x is string => typeof x === 'string').slice(0, 12);
  return { day, progress };
}
/** Adds what the server remembers for today to what this browser has, so nothing done on either side is lost. */
export function mergeProgress(state: QuestState, saved: Record<string, string[]> | undefined): QuestState {
  if (!saved) return state;
  const progress = { ...state.progress };
  for (const [k, v] of Object.entries(saved)) if (Array.isArray(v)) progress[k as QuestId] = [...new Set([...(progress[k as QuestId] ?? []), ...v.filter((x): x is string => typeof x === 'string')])].slice(0, 12);
  return { ...state, progress };
}
