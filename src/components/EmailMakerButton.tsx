'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { Toast, type ToastState } from '@/components/Toast';
import { enquiryMessage } from '@/lib/enquiry-message';
import { gaContactSeller, gaContactStep } from '@/lib/ga-events';
import { sendEvent } from '@/lib/track';
import type { Product } from '@/lib/types';

/** How long the "sent" message stays on screen. */
export const SENT_TOAST_MS = 5000;

/**
 * "Email" on the product page: a small form with the default message filled in. Craftofy sends it to the maker, the dialog closes and a
 * toast says it was sent. Signed-in buyers send from their account email; visitors type the address replies should go to (the maker is told it is
 * not verified). If sending is unavailable the buyer is offered their own mail app instead.
 */
export function EmailMakerButton({ product: p, className, children, icon }: { product: Product; className: string; children?: React.ReactNode; icon?: React.ReactNode }) {
  const { data: session } = useSession();
  const accountEmail = session?.user?.email ?? '';
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ text: string; offerMailto: boolean } | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const message = enquiryMessage(p);
  const subject = `Enquiry about ${p.name} on Craftofy`;

  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <button ref={trigger} type="button" className={className} aria-haspopup="dialog" onClick={() => {
        setError(null); setOpen(true);
        if (p.sellerSlug) gaContactStep({ sellerSlug: p.sellerSlug, method: 'email', step: 'modal_open', productId: p.id });
      }}>{icon}{children ?? 'Email'}</button>
      {open && createPortal(
        <div className="contact-backdrop admin-modal" onClick={e => { if (e.target === e.currentTarget && !sending) close(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby={`enquiry-title-${p.id}`} className="contact-card">
            <div className="dialog-head">
              <h2 id={`enquiry-title-${p.id}`}>Email to <span className="enquiry-maker">{p.seller}</span></h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={close} disabled={sending}>✕</button>
            </div>
              <form className="admin-form" onSubmit={async e => {
                e.preventDefault();
                if (sending) return;
                if (p.sellerSlug) gaContactStep({ sellerSlug: p.sellerSlug, method: 'email', step: 'button_click', productId: p.id });
                setSending(true); setError(null);
                const f = new FormData(e.currentTarget);
                const val = (k: string) => String(f.get(k) ?? '').trim();
                const body = { name: val('name'), email: val('email'), message: val('message'), companyWebsite: val('companyWebsite') };
                try {
                  const r = await fetch(`/api/products/${p.id}/enquiry`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
                  const data = await r.json().catch(() => null);
                  if (!r.ok) { setError({ text: data?.error ?? 'Something went wrong. Please try again.', offerMailto: r.status === 502 || r.status === 503 }); setSending(false); return; }
                  sendEvent('contact_email', p.id);
                  if (p.sellerSlug) gaContactSeller({ sellerSlug: p.sellerSlug, method: 'email', productId: p.id });
                  setSending(false);
                  setOpen(false);
                  setToast({ id: Date.now(), kind: 'success', text: 'Your email is successfully sent to seller' });
                } catch { setError({ text: 'Network error. Please try again.', offerMailto: true }); setSending(false); }
              }}>
                {error && (
                  <p role="alert" className="admin-error">
                    {error.text}
                    {error.offerMailto && p.email && <> <a className="text-link" href={`mailto:${p.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}>Open in your email app</a></>}
                  </p>
                )}
                <label className="enquiry-to"><span className="lbl">To</span><input name="to" readOnly tabIndex={-1} value={p.email ?? ''} /></label>
                <label><span className="lbl">Your name</span><input name="name" required maxLength={100} autoComplete="name" autoFocus defaultValue={session?.user?.name ?? ''} /></label>
                <label><span className="lbl">Your email</span>
                  <input name="email" type="email" required maxLength={254} autoComplete="email" key={accountEmail} defaultValue={accountEmail} readOnly={!!accountEmail} />
                  <small>{accountEmail ? 'Your signed-in email. Replies will go to this address.' : 'Replies will go to this address.'}</small>
                </label>
                <label><span className="lbl">Message</span><textarea name="message" required maxLength={1000} rows={5} defaultValue={message} /></label>
                <div aria-hidden="true" className="hp-field"><input name="companyWebsite" tabIndex={-1} autoComplete="off" defaultValue="" /></div>
                <div className="admin-actions">
                  <button type="button" className="button" onClick={close} disabled={sending}>Cancel</button>
                  <button type="submit" className="button primary" disabled={sending} aria-busy={sending}>{sending ? 'Sending…' : 'Send email'}</button>
                </div>
              </form>
          </div>
        </div>,
        document.body,
      )}
      <Toast toast={toast} onClose={() => setToast(null)} ms={SENT_TOAST_MS} />
    </>
  );
}
