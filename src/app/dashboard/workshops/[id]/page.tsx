import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ClassDetail } from '@/components/class/ClassDetail';
import { CraftDetail } from '@/components/class/CraftDetail';
import { WorkshopPreviewBar } from '@/components/WorkshopPreviewBar';
import { requireAdminPage } from '@/lib/admin-page';
import { workshopSlug } from '@/lib/catalog-shared';
import { getWorkshopPreview } from '@/lib/catalog';
import { hostConfig } from '@/lib/hosts';
import { getWorkshopHostPhoto } from '@/lib/workshop-host';
import { isCurrent } from '@/lib/workshop-listing';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };

const NOTE: Record<string, string> = {
  DRAFT: 'Preview of a Draft. Visitors cannot see this page until it is published.',
  ARCHIVED: 'Preview of an Archived listing. It is hidden: visitors cannot see this page.',
  APPROVED: 'Preview. This is how visitors see this published page.',
};

/**
 * Admin preview of a workshop: the real public page (the same layout components), for a listing in any status. It uses the public view of the
 * listing, so it never shows more than the real page would, and the page is switched off (inert) so nothing in it can be booked or contacted.
 */
export default async function WorkshopPreviewPage({ params }: Props) {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const w = await getWorkshopPreview((await params).id);
  if (!w) notFound();
  const ended = !isCurrent(w);
  const isClass = w.kind === 'class' || w.mode === 'online';
  const origin = hostConfig().publicOrigin ?? '';
  const crumbs = [{ name: 'Home', path: origin || '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Workshops', path: '/dashboard/workshops' }, { name: w.title, path: `/dashboard/workshops/${w.id}` }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <WorkshopPreviewBar id={w.id} title={w.title} status={w.status} ended={ended} publicUrl={w.status === 'APPROVED' ? `${origin}/workshops/${workshopSlug(w)}` : undefined} bookings={w.seats != null && w.kind !== 'class' ? w.booked : undefined} />
      <p className="ws-preview-note" role="status">{NOTE[w.status] ?? 'Preview.'} The buttons on the page are switched off here.</p>
      <div className="ws-preview-page" inert>
        {isClass ? <ClassDetail w={w} ended={ended} hostPhoto={await getWorkshopHostPhoto(w.id)} /> : <CraftDetail w={w} ended={ended} />}
      </div>
    </>
  );
}
