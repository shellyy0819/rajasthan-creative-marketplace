'use client';
import { useEffect, useRef, useState } from 'react';
import { describeSchedule, summarizePrices } from '@/lib/workshop-listing';
import type { WorkshopSellerDetail } from '@/lib/workshop-detail';
import './AdminTableControls.css';

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const Row = ({ label, children }: { label: string; children?: React.ReactNode }) => (children ? <><dt>{label}</dt><dd>{children}</dd></> : null);
const STATUS: Record<string, string> = { DRAFT: 'Draft', APPROVED: 'Published', ARCHIVED: 'Archived' };
const MATCH: Record<string, string> = { account: 'Seller account named on the listing', email: 'Found by the email the listing was made with', name: 'Found by the host name' };

/** Read-only detail of a listing and its seller (profile, other workshops, products). Escape, Done, ✕ and the backdrop close it. */
export function WorkshopDetail({ workshopId, title, onClose }: { workshopId: string; title: string; onClose: () => void }) {
  const [data, setData] = useState<WorkshopSellerDetail | null>(null);
  const [error, setError] = useState('');
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/workshops/${workshopId}/detail`, { cache: 'no-store' })
      .then(async r => { const b = await r.json().catch(() => null); if (!live) return; if (r.ok) setData(b); else setError(b?.error ?? 'Could not load the details.'); })
      .catch(() => { if (live) setError('Network error. Please try again.'); });
    return () => { live = false; };
  }, [workshopId]);

  useEffect(() => {
    card.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !card.current) return;
      const f = Array.from(card.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'));
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === card.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const w = data?.workshop, s = data?.seller;
  return (
    <div className="contact-backdrop admin-modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={card} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="wd-title" className="contact-card workshop-detail">
        <div className="dialog-head">
          <h2 id="wd-title">{s?.displayName ?? w?.host ?? title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        {error && <p role="alert" className="admin-error">{error}</p>}
        {!data && !error && <p className="form-note" role="status">Loading…</p>}
        {data && w && (
          <>
            <section aria-labelledby="wd-ws">
              <h3 id="wd-ws">Workshop</h3>
              <dl>
                <Row label="Title">{w.title}</Row>
                <Row label="Status">{STATUS[w.status] ?? w.status}</Row>
                <Row label="Type">{w.kind === 'class' ? 'Online class' : w.kind}</Row>
                <Row label="Starts">{`${day(w.date)}, ${w.time}`}</Row>
                <Row label="Ends">{w.endsOn ? day(w.endsOn) : undefined}</Row>
                <Row label="Schedule">{w.schedule ? describeSchedule(w.schedule) : undefined}</Row>
                <Row label="Where">{w.mode === 'online' ? `Online${w.platform ? ` on ${w.platform}` : ''}` : [w.venue, w.city].filter(Boolean).join(', ')}</Row>
                <Row label="Meeting link (private)">{w.joinLink ? <a href={w.joinLink} target="_blank" rel="noopener noreferrer">{w.joinLink}</a> : undefined}</Row>
                <Row label="Price">{w.prices.length ? summarizePrices(w.prices).all.map(p => <div key={p}>{p}</div>) : undefined}</Row>
                <Row label="Languages">{w.languages.length ? w.languages.join(', ') : undefined}</Row>
                <Row label="Level">{w.level ?? undefined}</Row>
                <Row label="Free trial">{w.freeTrial ? (w.freeTrialDays ? `${w.freeTrialDays} days` : 'Yes') : undefined}</Row>
                <Row label="Experience">{w.experience ?? undefined}</Row>
                <Row label="Certifications">{w.certifications ?? undefined}</Row>
                <Row label="Private contact">{[w.contactName, w.contactPhone, w.contactEmail].filter(Boolean).join(' · ') || undefined}</Row>
              </dl>
            </section>
            <section aria-labelledby="wd-seller">
              <h3 id="wd-seller">Seller</h3>
              {!s ? <p className="form-note">No seller account is linked to this listing. The host name is {w.host}.</p> : (
                <>
                  {data.match && <p className="form-note">{MATCH[data.match]}.</p>}
                  <dl>
                    <Row label="Name"><a href={`/artists/${s.slug}`} target="_blank" rel="noopener noreferrer">{s.displayName} ↗<span className="sr-only"> (opens the seller's profile in a new tab)</span></a></Row>
                    <Row label="Account">{s.accountEmail}{s.roles.length ? ` (${s.roles.join(', ')})` : ''}</Row>
                    <Row label="Category">{s.category}</Row>
                    <Row label="Bio">{s.bio}</Row>
                    <Row label="City">{s.city}</Row>
                    <Row label="Phone">{s.phone}</Row>
                    <Row label="WhatsApp">{s.whatsapp}</Row>
                    <Row label="Instagram">{s.instagram}</Row>
                    <Row label="Website">{s.website}</Row>
                    <Row label="Public email">{s.publicEmail}</Row>
                  </dl>
                </>
              )}
            </section>
            {data.otherWorkshops.length > 0 && (
              <section aria-labelledby="wd-others">
                <h3 id="wd-others">More by this host</h3>
                <ul>{data.otherWorkshops.map(o => <li key={o.id}>{o.title} <span className="muted">· {STATUS[o.status] ?? o.status} · {day(o.date)}</span></li>)}</ul>
              </section>
            )}
            {data.products.length > 0 && (
              <section aria-labelledby="wd-products">
                <h3 id="wd-products">Products</h3>
                <ul>{data.products.map(p => <li key={p.id}>{p.name} <span className="muted">· {p.category} · {STATUS[p.status] ?? p.status} · {p.pricePaise == null ? 'Price on request' : `₹${p.pricePaise / 100}`} · {p.stock} in stock</span></li>)}</ul>
              </section>
            )}
          </>
        )}
        <div className="admin-actions"><button type="button" className="button primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
