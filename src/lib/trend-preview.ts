import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { getDigest, getPublishedDigest } from './trend-store';
import { matchItems, type MatchedItem } from './trend-match';
import { trendSourceLine, TREND_ORIGINS } from './trend-types';

export const TREND_PREVIEW_COOKIE = 'rr_trend_preview';

export type TrendsForPage = { items: MatchedItem[]; sourceLine: string; updatedOn: Date; previewing: boolean };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The digest an admin asked to preview. Anyone else, and any cookie that is not a uuid, gets undefined (and a visitor without the cookie never reaches auth). */
async function previewDigest() {
  const raw = (await cookies()).get(TREND_PREVIEW_COOKIE)?.value;
  if (!raw || !UUID_RE.test(raw)) return undefined;
  const session = await auth();
  if (session?.user?.role !== 'admin' || session.user.active === false) return undefined;
  return (await getDigest(raw)) ?? undefined;
}

/**
 * What the public block shows for this request: the published digest, or for a signed-in admin holding the preview cookie, that draft.
 * Only the items marked `show` count; null when there are none.
 */
export async function getTrendsForPage(): Promise<TrendsForPage | null> {
  const previewing = await previewDigest();
  const digest = previewing ?? (await getPublishedDigest());
  if (!digest) return null;
  const shown = digest.items.filter(i => i.show);
  if (!shown.length) return null;
  const origins = TREND_ORIGINS.filter(o => shown.some(i => i.origin === o));
  return {
    items: await matchItems(shown),
    sourceLine: trendSourceLine([...origins]),
    updatedOn: digest.publishedAt ?? digest.createdAt,
    previewing: previewing !== undefined,
  };
}
