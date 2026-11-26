import { Breadcrumbs } from '@/components/Breadcrumbs';
import { MarketTrendsAdmin, type DigestDto, type SummaryDto } from '@/components/MarketTrendsAdmin';
import { requireAdminPage } from '@/lib/admin-page';
import { hostConfig } from '@/lib/hosts';
import { matchItems } from '@/lib/trend-match';
import { getTrendSettings } from '@/lib/trend-settings';
import { getDigest, listDigests, type Digest } from '@/lib/trend-store';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// The browser gets dates as text: the same shape the admin API sends.
const toSummary = ({ createdAt, publishedAt, ...rest }: Awaited<ReturnType<typeof listDigests>>[number]): SummaryDto => ({ ...rest, createdAt: createdAt.toISOString(), publishedAt: publishedAt?.toISOString() ?? null });
const toDto = ({ createdAt, publishedAt, ...rest }: Digest): DigestDto => ({ ...rest, createdAt: createdAt.toISOString(), publishedAt: publishedAt?.toISOString() ?? null });

export default async function AdminMarketTrendsPage({ searchParams }: Props) {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const sp = await searchParams;
  const [list, settings] = await Promise.all([listDigests(), getTrendSettings()]);
  const asked = typeof sp.d === 'string' ? sp.d : '';
  const id = list.find(d => d.id === asked)?.id ?? list[0]?.id; // ?d=<id> picks a digest, otherwise the newest
  const open = id ? await getDigest(id) : null;
  const matched = open ? await matchItems(open.items) : [];
  const publicOrigin = hostConfig().publicOrigin ?? '';
  const crumbs = [{ name: 'Home', path: publicOrigin || '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Market trends', path: '/dashboard/market-trends' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <MarketTrendsAdmin digests={list.map(toSummary)} selected={open ? toDto(open) : null} matched={matched} keySet={settings.keySet} publicOrigin={publicOrigin} />
    </>
  );
}
