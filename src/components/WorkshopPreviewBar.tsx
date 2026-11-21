'use client';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { WorkshopDetail } from './WorkshopDetail';
import './WorkshopPreview.css';

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Draft', APPROVED: 'Published', ARCHIVED: 'Archived' };
const STATUS_CLASS: Record<string, string> = { DRAFT: 'archived', APPROVED: 'published', ARCHIVED: 'archived' };

/** The admin's bar above a workshop preview: back to the list, the listing's status, host and seller details (a dialog), Edit, and the public page when there is one. */
export function WorkshopPreviewBar({ id, title, status, ended, publicUrl, bookings }: { id: string; title: string; status: string; ended: boolean; publicUrl?: string; bookings?: number }) {
  const [details, setDetails] = useState(false);
  const closeDetails = useCallback(() => setDetails(false), []);
  return (
    <>
      <div className="ws-preview-bar">
        <Link className="ws-preview-back" href="/dashboard/workshops">← All workshops</Link>
        <div className="ws-preview-tags">
          <span className={`badge ${STATUS_CLASS[status] ?? 'archived'}`}>{STATUS_LABEL[status] ?? status}</span>
          {ended && <span className="badge published">Ended</span>}
        </div>
        <div className="ws-preview-actions">
          <button type="button" className="button" aria-haspopup="dialog" onClick={() => setDetails(true)}>Host and seller details</button>
          {bookings !== undefined && <Link className="button" href={`/dashboard/workshops/${id}/bookings`}>Bookings ({bookings})</Link>}
          <Link className="button" href={`/dashboard/workshops?edit=${id}`}>Edit</Link>
          {publicUrl && <a className="button" href={publicUrl} target="_blank" rel="noopener noreferrer">Open the public page</a>}
        </div>
      </div>
      {details && <WorkshopDetail workshopId={id} title={title} onClose={closeDetails} />}
    </>
  );
}
