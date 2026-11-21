import { eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { toWorkshop, withPrices, workshopsQuery } from '../db/mappers';
import { workshops } from '../db/schema';
import { istParts } from './ist';
import { MIN_VIEWS, pickDiverse, WINDOW_DAYS } from './trending';
import type { Workshop } from './types';
import { isCurrent } from './workshop-listing';

/** Views and contact clicks come from workshop_events; reservations are the saved bookings (the strongest sign of interest, so no extra tracking is needed for them). */
export const WORKSHOP_WEIGHTS = { views: 0.4, contact: 0.3, reservations: 0.3 } as const;
export const HOME_WORKSHOPS = 3;
export const PAGE_WORKSHOPS = 12;

export type WorkshopSignals = { workshopId: string; hostKey: string; views: number; contact: number; reservations: number };
const idNum = (id: string) => Number(id.replace(/\D/g, '')) || 0;

/** True when the signals show real interest: enough distinct viewers, or at least one contact click or reservation. One view alone (often the host checking a new listing) is not enough. */
export const workshopQualifies = (r: Pick<WorkshopSignals, 'views' | 'contact' | 'reservations'>) => r.views >= MIN_VIEWS || r.contact > 0 || r.reservations > 0;

/** Max-normalise each signal to 0..1, apply the weights, drop listings that do not qualify, best first (ties go to more reservations, then the newer listing). */
export function scoreWorkshopSignals(rows: WorkshopSignals[]): (WorkshopSignals & { score: number })[] {
  const keys = Object.keys(WORKSHOP_WEIGHTS) as (keyof typeof WORKSHOP_WEIGHTS)[];
  const max = Object.fromEntries(keys.map(k => [k, Math.max(0, ...rows.map(r => r[k]))])) as Record<keyof typeof WORKSHOP_WEIGHTS, number>;
  return rows
    .filter(workshopQualifies)
    .map(r => ({ ...r, score: keys.reduce((s, k) => s + (max[k] ? (r[k] / max[k]) * WORKSHOP_WEIGHTS[k] : 0), 0) }))
    .sort((a, b) => b.score - a.score || b.reservations - a.reservations || idNum(b.workshopId) - idNum(a.workshopId));
}

async function loadSignals(now: Date) {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const firstDay = new Date(now.getTime() - (WINDOW_DAYS - 1) * 86_400_000).toISOString().slice(0, 10); // the last 7 UTC days, today included
  const distinct = (type: string) => sql<number>`(select count(distinct e.actor) from workshop_events e where e.workshop_id = workshops.id and e.type = ${type} and e.day >= ${firstDay})`.mapWith(Number);
  const rows = await getDb().select({
    workshopId: workshops.id, title: workshops.title, startsAt: workshops.startsAt, endsOn: workshops.endsOn, kind: workshops.kind,
    hostId: workshops.hostId, hostName: workshops.hostName,
    views: distinct('view'), contact: distinct('contact'),
    reservations: sql<number>`(select count(*) from bookings b where b.workshop_id = workshops.id and b.created_at >= ${since.toISOString()}::timestamptz)`.mapWith(Number),
  }).from(workshops).where(eq(workshops.status, 'APPROVED'));
  // Only listings that have not ended can trend (a class with no end date never ends). One favourite per host, as the products row shows one per artist.
  return rows
    .filter(r => isCurrent({ date: istParts(r.startsAt).date, endsOn: r.endsOn, kind: r.kind }, now))
    .map(r => ({ workshopId: r.workshopId, title: r.title, hostKey: r.hostId ?? `name:${r.hostName.trim().toLowerCase()}`, views: r.views, contact: r.contact, reservations: r.reservations }));
}

/** The workshops people are looking at, contacting and reserving most this week, best first, one per host. Empty until something qualifies. */
export async function trendingWorkshops({ limit = HOME_WORKSHOPS, now = new Date() }: { limit?: number; now?: Date } = {}): Promise<Workshop[]> {
  const n = Number.isFinite(limit) ? Math.min(PAGE_WORKSHOPS, Math.max(1, Math.floor(limit))) : HOME_WORKSHOPS;
  const picked = pickDiverse(scoreWorkshopSignals(await loadSignals(now)).map(r => ({ ...r, sellerId: r.hostKey })), n);
  if (!picked.length) return [];
  const db = getDb();
  const rows = await workshopsQuery(db).where(inArray(workshops.id, picked.map(p => p.workshopId)));
  const byId = new Map((await withPrices(db, rows.map(toWorkshop))).map(w => [w.id, w]));
  return picked.map(p => byId.get(p.workshopId)!).filter(Boolean);
}

export type WorkshopBreakdownStatus = 'shown' | 'not-shown' | 'host-duplicate' | 'below-threshold';
export type WorkshopBreakdownRow = WorkshopSignals & {
  title: string; score: number; status: WorkshopBreakdownStatus; rank: number | null;
  /** Each signal's share of the score: (value / max) x weight. */
  parts: Record<keyof typeof WORKSHOP_WEIGHTS, number>;
};
export type WorkshopBreakdown = { rows: WorkshopBreakdownRow[]; max: Record<keyof typeof WORKSHOP_WEIGHTS, number>; weights: typeof WORKSHOP_WEIGHTS; windowDays: number; minViews: number; homeLimit: number; pageLimit: number };

/** Admin view: every published workshop that has not ended, with its raw signals, the maths and why it is (not) in the Trending workshops row. */
export async function trendingWorkshopsBreakdown({ now = new Date() }: { now?: Date } = {}): Promise<WorkshopBreakdown> {
  const raw = await loadSignals(now);
  const titles = new Map(raw.map(r => [r.workshopId, r.title]));
  const keys = Object.keys(WORKSHOP_WEIGHTS) as (keyof typeof WORKSHOP_WEIGHTS)[];
  const max = Object.fromEntries(keys.map(k => [k, Math.max(0, ...raw.map(r => r[k]))])) as Record<keyof typeof WORKSHOP_WEIGHTS, number>;
  const partsOf = (r: WorkshopSignals) => Object.fromEntries(keys.map(k => [k, max[k] ? (r[k] / max[k]) * WORKSHOP_WEIGHTS[k] : 0])) as Record<keyof typeof WORKSHOP_WEIGHTS, number>;
  const ranked = scoreWorkshopSignals(raw);
  const asHost = (r: WorkshopSignals) => ({ ...r, sellerId: r.hostKey });
  const shown = new Set(pickDiverse(ranked.map(asHost), HOME_WORKSHOPS).map(r => r.workshopId));
  const onPage = new Set(pickDiverse(ranked.map(asHost), PAGE_WORKSHOPS).map(r => r.workshopId));
  const rankedIds = new Set(ranked.map(r => r.workshopId));
  const rows: WorkshopBreakdownRow[] = [
    ...ranked.map((r, i) => ({
      workshopId: r.workshopId, hostKey: r.hostKey, views: r.views, contact: r.contact, reservations: r.reservations, score: r.score,
      title: titles.get(r.workshopId) ?? r.workshopId, parts: partsOf(r), rank: i + 1,
      status: (shown.has(r.workshopId) ? 'shown' : onPage.has(r.workshopId) ? 'not-shown' : 'host-duplicate') as WorkshopBreakdownStatus,
    })),
    ...raw.filter(r => !rankedIds.has(r.workshopId)).map(r => ({ workshopId: r.workshopId, hostKey: r.hostKey, views: r.views, contact: r.contact, reservations: r.reservations, title: r.title, score: 0, parts: partsOf(r), rank: null, status: 'below-threshold' as const })),
  ];
  return { rows, max, weights: WORKSHOP_WEIGHTS, windowDays: WINDOW_DAYS, minViews: MIN_VIEWS, homeLimit: HOME_WORKSHOPS, pageLimit: PAGE_WORKSHOPS };
}
