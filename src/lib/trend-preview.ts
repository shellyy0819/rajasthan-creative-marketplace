import { unstable_cache } from 'next/cache';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { getDigest, getPublishedDigest, type Digest } from './trend-store';
import { matchItems, type MatchedItem } from './trend-match';
import { trendSourceLine, TREND_ORIGINS, type TrendItem } from './trend-types';

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

/** The cache entry of a published digest is kept this long (seconds): the counts in it follow the shop and workshops, which change without a publish. */
const PUBLISHED_TTL = 300;

const shownOf = (d: Digest) => d.items.filter(i => i.show);

/** The block's content for a digest's shown items: matched against the shop and workshops, with the credit line. Plain data only, so it can be cached. */
async function build(shown: TrendItem[]) {
  const origins = TREND_ORIGINS.filter(o => shown.some(i => i.origin === o));
  return { items: await matchItems(shown), sourceLine: trendSourceLine([...origins]) };
}

/**
 * The matched, shown items of a published digest, kept per digest id. A published digest cannot be edited, so only the counts can go stale, and
 * the short TTL (or the `trends` tag, which publish and unpublish revalidate) refreshes them. Dates do not survive the cache (it stores JSON), so none are in here.
 */
const publishedBlock = unstable_cache(async (digestId: string) => {
  const digest = await getDigest(digestId);
  const shown = digest?.publishedAt ? shownOf(digest) : [];
  return shown.length ? await build(shown) : null;
}, ['trends-published'], { revalidate: PUBLISHED_TTL, tags: ['trends'] });

/**
 * What the public block shows for this request: the published digest, or for a signed-in admin holding the preview cookie, that draft.
 * Only the items marked `show` count; null when there are none. A previewed draft with nothing shown, or a previewed digest that is already
 * public, shows the published block as any visitor sees it (so the preview pill never claims a preview that is not happening).
 * The published path is cached; the preview path is always live.
 */
export async function getTrendsForPage(): Promise<TrendsForPage | null> {
  const preview = await previewDigest();
  if (preview && !preview.publishedAt) {
    const shown = shownOf(preview);
    if (shown.length) return { ...(await build(shown)), updatedOn: preview.createdAt, previewing: true };
  }
  const published = await getPublishedDigest();
  if (!published) return null;
  const block = await publishedBlock(published.id);
  if (!block) return null;
  return { ...block, updatedOn: published.publishedAt ?? published.createdAt, previewing: false };
}
