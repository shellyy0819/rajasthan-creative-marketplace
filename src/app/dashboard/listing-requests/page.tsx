import { Suspense } from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ListingRequestsAdmin } from '@/components/ListingRequestsAdmin';
import { requireAdminPage } from '@/lib/admin-page';
import { SectionLoader } from '@/components/SectionLoader';
import { hostConfig } from '@/lib/hosts';
import { listListingRequests } from '@/lib/listing-requests';

export const dynamic = 'force-dynamic';

async function RequestsData() {
  return <Suspense fallback={<SectionLoader label="Loading requests…" variant="list" />}><RequestsData /></Suspense>;
}

export default async function ListingRequestsPage() {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const crumbs = [{ name: 'Home', path: hostConfig().publicOrigin ?? '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Listing requests', path: '/dashboard/listing-requests' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <h1>Listing requests</h1>
      <p className="muted">People who asked to sell on Craftofy. Phone numbers are not verified: call the owner, then press Confirm. Confirming lets them sign in with Google using their email and list products.</p>
      <ListingRequestsAdmin initial={await listListingRequests()} />
    </>
  );
}
