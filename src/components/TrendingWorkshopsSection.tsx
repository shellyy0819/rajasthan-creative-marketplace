import Link from 'next/link';
import { getHomeTrendingWorkshops } from '@/lib/home-cache';
import { WorkshopList } from './WorkshopList';

/** Home-page row of the workshops people are looking at, contacting and reserving most this week. Hidden until something actually trends. */
export async function TrendingWorkshopsSection() {
  const items = await getHomeTrendingWorkshops();
  if (!items.length) return null;
  return (
    <section className="section" id="trending-workshops" aria-labelledby="trending-ws-h">
      <div className="section-heading">
        <div><span className="eyebrow">POPULAR THIS WEEK</span><h2 id="trending-ws-h">Trending workshops</h2></div>
        <Link className="text-link" href="/trending#workshops">Show all →</Link>
      </div>
      <WorkshopList workshops={items} />
    </section>
  );
}
