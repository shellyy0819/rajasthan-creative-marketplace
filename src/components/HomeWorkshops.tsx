import { HostWorkshopButton } from './HostWorkshopButton';
import { WorkshopList } from './WorkshopList';
import { listWorkshops } from '@/lib/catalog';
import { contactEmail } from '@/lib/site';

/** Loads the home-page workshops by itself so the page can stream them behind a skeleton. */
export async function HomeWorkshops() {
  return <WorkshopList workshops={await listWorkshops()} emptyMessage="No workshops are scheduled yet. Check back soon." emptyAction={<HostWorkshopButton contactEmail={contactEmail()} />} />;
}
