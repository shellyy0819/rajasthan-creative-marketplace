'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './AdminTableControls.css';

type Choice = 'published' | 'on_hold' | 'archived';
type Req = { id: string; title: string; status: string; listedWorkshopId?: string; listedStatus?: string };

/** What the dropdown shows: the listing's status once the request became a listing, otherwise the review status of the request. */
function shown(r: Req): Choice | 'new' {
  if (r.status === 'listed') return r.listedStatus === 'ARCHIVED' ? 'archived' : r.listedStatus === 'DRAFT' ? 'on_hold' : 'published';
  return r.status === 'on_hold' ? 'on_hold' : r.status === 'archived' ? 'archived' : 'new';
}
const LISTING_STATUS: Record<Choice, string> = { published: 'APPROVED', on_hold: 'DRAFT', archived: 'ARCHIVED' };

/**
 * The admin's decision on a request: Published, On hold or Archived. Before it has a listing, On hold and Archived are saved on the request, and Published
 * opens the listing form (a listing needs its city and details) with Published preselected. Once it has a listing the choice changes that listing.
 */
export function RequestStatusSelect({ request }: { request: Req }) {
  const router = useRouter();
  const [value, setValue] = useState<Choice | 'new'>(shown(request));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function choose(next: Choice) {
    if (busy || next === value) return;
    setError('');
    if (request.status !== 'listed' && next === 'published') { window.location.assign(`/dashboard/workshops?from=${request.id}&status=APPROVED`); return; }
    setBusy(true);
    try {
      const listed = request.status === 'listed' && request.listedWorkshopId;
      const r = await fetch(listed ? `/api/workshops/${request.listedWorkshopId}/status` : `/api/workshop-requests/${request.id}/status`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: listed ? LISTING_STATUS[next] : next }),
      });
      if (!r.ok) { setError(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not change the status.'); }
      else { setValue(next); router.refresh(); }
    } catch { setError('Network error. Please try again.'); }
    setBusy(false);
  }

  return (
    <div className="request-status">
      <select className="admin-status-select" aria-label={`Status of ${request.title}`} value={value} disabled={busy} onChange={e => void choose(e.target.value as Choice)}>
        <option value="new" disabled>New</option>
        <option value="published">Published</option>
        <option value="on_hold">On hold</option>
        <option value="archived">Archived</option>
      </select>
      {error && <small className="field-error" role="alert">{error}</small>}
    </div>
  );
}
