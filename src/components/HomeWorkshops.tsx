import { HostWorkshopButton } from './HostWorkshopButton';
import { WorkshopList } from './WorkshopList';
import { listWorkshops } from '@/lib/catalog';
import { contactEmail } from '@/lib/site';
import { listActiveTopics } from '@/lib/topics';

/** The home page shows only a taste of the workshops; the "All workshops" link next to it opens the full, filterable list. */
export const HOME_WORKSHOP_LIMIT = 3;

/** Loads the home-page workshops by itself so the page can stream them behind a skeleton. */
export async function HomeWorkshops() {
  return <WorkshopList workshops={(await listWorkshops()).slice(0, HOME_WORKSHOP_LIMIT)} emptyMessage="No workshops are scheduled yet. Check back soon." emptyAction={<HostWorkshopButton contactEmail={contactEmail()} topics={await listActiveTopics()} prefill saveDraft />} />;
}
