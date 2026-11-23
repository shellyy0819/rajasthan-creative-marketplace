import Link from 'next/link';
import { HostWorkshopButton } from './HostWorkshopButton';
import { WorkshopList } from './WorkshopList';
import { listWorkshops } from '@/lib/catalog';
import { getHomeSettings } from '@/lib/home-settings';
import { contactEmail } from '@/lib/site';
import { listActiveTopics } from '@/lib/topics';

/** The home page shows only a taste of the workshops; the "All workshops" link next to it opens the full, filterable list. */
export const HOME_WORKSHOP_LIMIT = 3;

/**
 * The home page's whole workshop section (heading, intro, link and the first few workshops), loaded by itself so the page can stream it.
 * It is left out entirely while fewer workshops are on than the admin asked for (Settings > Home page; 0 = always show), so a nearly empty
 * list never sits on the home page.
 */
export async function HomeWorkshops() {
  const [workshops, { minWorkshops }] = await Promise.all([listWorkshops(), getHomeSettings()]);
  if (workshops.length < minWorkshops) return null;
  return (
    <section className="workshop-band" id="workshops" aria-labelledby="ws-h">
      <div className="workshop-intro">
        <span className="eyebrow">OUT OF THE SCROLL, INTO THE STUDIO</span>
        <h2 id="ws-h">Make time for<br /><em>making things.</em></h2>
        <p>Find friendly workshops, creative meetups and pop-up experiences hosted by local makers and venues.</p>
      </div>
      <div className="workshop-feed">
        <div className="workshop-feed-head"><Link className="text-link" href="/workshops">All workshops →</Link></div>
        <WorkshopList workshops={workshops.slice(0, HOME_WORKSHOP_LIMIT)} emptyMessage="No workshops are scheduled yet. Check back soon." emptyAction={<HostWorkshopButton contactEmail={contactEmail()} topics={await listActiveTopics()} prefill saveDraft />} />
      </div>
    </section>
  );
}
