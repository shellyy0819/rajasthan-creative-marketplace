'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { enquiryMessage } from '@/lib/enquiry-message';
import { gaContactSeller, gaContactStep } from '@/lib/ga-events';
import { instagramDmUrl, instagramHandle } from '@/lib/social';
import { sendEvent } from '@/lib/track';
import type { Product } from '@/lib/types';

/**
 * "Instagram" on the product page. Instagram cannot prefill a direct message, so the buyer edits the message here, and one click copies it
 * and opens the chat with the maker; they paste it and press Send. Nothing is sent by Craftofy.
 */
export function InstagramMessageButton({ product: p, productUrl, className, icon, children }: { product: Product; productUrl: string; className: string; icon?: React.ReactNode; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'manual'>('idle');
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const handle = p.instagram ? instagramHandle(p.instagram) : '';
  const initial = `${enquiryMessage(p)}\n\n${productUrl}`;

  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  if (!p.instagram) return null;

  const manual = () => { setCopy('manual'); box.current?.focus(); box.current?.select(); };
  // Runs inside the click on the link, so the browser still opens the chat in a new tab; the copy happens alongside.
  const onOpen = () => {
    if (p.sellerSlug) gaContactStep({ sellerSlug: p.sellerSlug, method: 'instagram', step: 'button_click', productId: p.id });
    sendEvent('contact_instagram', p.id);
    if (p.sellerSlug) gaContactSeller({ sellerSlug: p.sellerSlug, method: 'instagram', productId: p.id, category: p.category });
    const text = box.current?.value ?? initial;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => setCopy('copied'), manual);
    else manual();
  };

  return (
    <>
      <button ref={trigger} type="button" className={className} aria-haspopup="dialog" onClick={() => {
        setCopy('idle'); setOpen(true);
        if (p.sellerSlug) gaContactStep({ sellerSlug: p.sellerSlug, method: 'instagram', step: 'modal_open', productId: p.id });
      }}>{icon}{children ?? 'Instagram'}</button>
      {open && createPortal(
        <div className="contact-backdrop admin-modal" onClick={e => { if (e.target === e.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby={`ig-title-${p.id}`} className="contact-card">
            <div className="dialog-head">
              <h2 id={`ig-title-${p.id}`}>Message <span className="enquiry-maker">{p.seller}</span> on Instagram</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={close}>✕</button>
            </div>
            <div className="admin-form">
              <label className="enquiry-to"><span className="lbl">To</span><input name="to" readOnly tabIndex={-1} value={handle} /></label>
              <label><span className="lbl">Message</span><textarea ref={box} name="message" maxLength={1000} rows={6} autoFocus defaultValue={initial} /></label>
              <p className="form-note">Instagram cannot fill in a message for you. Press the button: we copy your message and open the chat, then paste it there and press Send.</p>
              {copy === 'copied' && <p role="status" className="form-note ig-copied">Message copied. Paste it in the chat and press Send.</p>}
              {copy === 'manual' && <p role="alert" className="admin-error">We could not copy it for you. The message above is selected: copy it, then paste it in the chat.</p>}
              <div className="admin-actions">
                <button type="button" className="button" onClick={close}>{copy === 'idle' ? 'Cancel' : 'Done'}</button>
                <a className="button primary" href={instagramDmUrl(p.instagram)} target="_blank" rel="noreferrer" onClick={onOpen}>Copy message &amp; open Instagram</a>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
