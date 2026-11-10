'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { gaEvent } from '@/lib/analytics';
import { instagramHandle, instagramUrl, youtubeUrl } from '@/lib/social';
import { sendEvent, type MethodEvent } from '@/lib/track';
import type { Product } from '@/lib/types';

const ICONS = {
  phone: <path d="M7 3h10v18H7zM10 18h4" />,
  handset: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  ig: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="18" cy="6" r="1" /></>,
  yt: <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3V9Z" /></>,
  pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
};
const Icon = ({ name }: { name: keyof typeof ICONS }) => <svg className="detail-icon" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>;

function CopyButton({ value, label, onCopy }: { value: string; label: string; onCopy: () => void }) {
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle');
  return (
    <button type="button" className="button contact-copy" aria-label={`Copy ${label}`} onClick={async e => {
      onCopy();
      const row = e.currentTarget.closest('.contact-row');
      try { await navigator.clipboard.writeText(value); setState('copied'); }
      catch { // clipboard refused: select the text so the visitor can copy it by hand
        const el = row?.querySelector('.contact-value');
        if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); }
        setState('selected');
      }
      setTimeout(() => setState('idle'), 1500);
    }}>{state === 'copied' ? 'Copied' : state === 'selected' ? 'Selected' : 'Copy'}</button>
  );
}

/** Replaces "Add to bag": opens a sheet with everything the artist chose to share publicly. */
/** `artistLevel`: opened from the artist page, so it is about the artist, not one product (no "About" line, no "View all" link, event tagged source=artist).
 *  `iconOnly`: a round phone-handset button (labelled "Contact artist" for screen readers) for tight spots like product cards. */
export function ContactArtistButton({ product: p, artistLevel = false, iconOnly = false }: { product: Product; artistLevel?: boolean; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => { setOpen(false); trigger.current?.focus(); };
  const trackMethod = (method: 'call' | 'email' | 'instagram' | 'youtube' | 'copy') => {
    sendEvent(`contact_${method}` as MethodEvent, p.id, artistLevel ? 'artist' : undefined);
    gaEvent('contact_method_click', { item_id: p.id, method, ...(artistLevel ? { source: 'artist' } : {}) });
  };
  const shared = [p.phone, p.email, p.instagram, p.youtube].some(Boolean);

  return (
    <>
      <button ref={trigger} type="button" className={`add-btn contact-btn${iconOnly ? ' contact-icon-btn' : ''}`} aria-haspopup="dialog" {...(iconOnly ? { 'aria-label': 'Contact artist', title: 'Contact artist' } : {})} onClick={() => {
        setOpen(true);
        if (artistLevel) { sendEvent('contact', p.id, 'artist'); gaEvent('contact_click', { item_id: p.id, source: 'artist' }); }
        else { sendEvent('contact', p.id); gaEvent('contact_click', { item_id: p.id }); }
      }}>{iconOnly ? <svg className="contact-handset" viewBox="0 0 24 24" aria-hidden="true">{ICONS.handset}</svg> : 'Contact artist'}</button>
      {open && createPortal(
        <div className="contact-backdrop admin-modal" onClick={e => { if (e.target === e.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby={`contact-title-${p.id}`} className="contact-card">
            <div className="dialog-head">
              <div className="contact-who">
                <span className="contact-avatar" aria-hidden="true">{p.seller.trim().charAt(0).toUpperCase()}</span>
                <div>
                  <h2 id={`contact-title-${p.id}`}>{p.seller}</h2>
                  {p.artistCity && <small className="contact-city"><Icon name="pin" /> {p.artistCity}</small>}
                </div>
              </div>
              <button ref={closeRef} type="button" className="icon-btn" aria-label="Close" onClick={close}>✕</button>
            </div>
            {p.artistBio && <p className="contact-bio">{p.artistBio}</p>}
            {!artistLevel && <p className="contact-about">About: <b>{p.name}</b></p>}
            {shared ? (
              <div className="contact-rows">
                {p.phone && (
                  <div className="contact-row"><Icon name="phone" /><div><span className="contact-label">Phone</span><span className="contact-value">{p.phone}</span></div>
                    <a className="button" href={`tel:${p.phone.replace(/[^\d+]/g, '')}`} onClick={() => trackMethod('call')}>Call</a><CopyButton value={p.phone} label="phone" onCopy={() => trackMethod('copy')} /></div>
                )}
                {p.email && (
                  <div className="contact-row"><Icon name="mail" /><div><span className="contact-label">Email</span><span className="contact-value">{p.email}</span></div>
                    <a className="button" href={`mailto:${p.email}`} onClick={() => trackMethod('email')}>Email</a><CopyButton value={p.email} label="email" onCopy={() => trackMethod('copy')} /></div>
                )}
                {p.instagram && (
                  <div className="contact-row"><Icon name="ig" /><div><span className="contact-label">Instagram</span><a className="contact-value" href={instagramUrl(p.instagram)} target="_blank" rel="noreferrer" onClick={() => trackMethod('instagram')}>{instagramHandle(p.instagram)}</a></div>
                    <a className="button" href={instagramUrl(p.instagram)} target="_blank" rel="noreferrer" onClick={() => trackMethod('instagram')}>Open Instagram ↗</a></div>
                )}
                {p.youtube && (
                  <div className="contact-row"><Icon name="yt" /><div><span className="contact-label">YouTube</span><span className="contact-value">{p.youtube}</span></div>
                    <a className="button" href={youtubeUrl(p.youtube)} target="_blank" rel="noreferrer" onClick={() => trackMethod('youtube')}>Open YouTube ↗</a></div>
                )}
              </div>
            ) : <p className="contact-empty">This artist has not shared contact details yet.</p>}
            <div className="contact-foot">
              <span>Contact details are provided by the artist.</span>
              {!artistLevel && p.sellerSlug && <Link className="text-link" href={`/artists/${p.sellerSlug}?from=${p.id}`}>View all by {p.seller} →</Link>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
