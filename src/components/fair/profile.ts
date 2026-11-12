/**
 * What the fair remembers about a visitor code on this device: makers met, the shortlist, notes left, quest progress.
 * Several codes can live in one browser; `current` is the one playing.
 */
export type Note = { text: string; rating: number; t: number };
export type Profile = { met: string[]; shortlist: Record<string, number>; notes: Note[]; quests: unknown };
export type Store = { current: string; profiles: Record<string, Profile> };
export const STORE_KEY = 'cf-fair-v1';
export const MAX_NOTES = 12, MAX_QTY = 9, NOTE_MAX = 280;

export const emptyProfile = (): Profile => ({ met: [], shortlist: {}, notes: [], quests: null });
export const emptyStore = (): Store => ({ current: '', profiles: {} });

/** Keeps only what is still valid for this fair: unknown makers and items are dropped (the real stalls can change between visits). */
export function cleanProfile(raw: unknown, makerIds: ReadonlySet<string>, itemKeys: ReadonlySet<string>): Profile {
  const r = raw && typeof raw === 'object' ? raw as Partial<Profile> : {};
  const shortlist: Record<string, number> = {};
  if (r.shortlist && typeof r.shortlist === 'object') for (const [k, q] of Object.entries(r.shortlist)) if (itemKeys.has(k) && Number.isInteger(q) && q > 0) shortlist[k] = Math.min(MAX_QTY, q);
  const notes = Array.isArray(r.notes) ? r.notes.filter((n): n is Note => !!n && typeof n.text === 'string' && n.text.trim() !== '').map(n => ({ text: n.text.slice(0, NOTE_MAX), rating: Number.isInteger(n.rating) && n.rating >= 0 && n.rating <= 5 ? n.rating : 0, t: Number(n.t) || 0 })).slice(-MAX_NOTES) : [];
  return { met: Array.isArray(r.met) ? [...new Set(r.met.filter((id): id is string => typeof id === 'string' && makerIds.has(id)))] : [], shortlist, notes, quests: r.quests ?? null };
}
export function loadStore(storage: Pick<Storage, 'getItem'> | null): Store {
  try {
    const s = JSON.parse(storage?.getItem(STORE_KEY) ?? 'null');
    if (s && typeof s === 'object' && typeof s.profiles === 'object' && s.profiles) return { current: typeof s.current === 'string' ? s.current : '', profiles: s.profiles };
  } catch { /* unreadable or blocked storage: start fresh */ }
  return emptyStore();
}
export function saveStore(storage: Pick<Storage, 'setItem'> | null, store: Store): void {
  try { storage?.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* storage full or blocked: the fair still works, it just will not remember */ }
}
export const cartCount = (list: Record<string, number>) => Object.values(list).reduce((a, b) => a + b, 0);
