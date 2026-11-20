'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gaShare } from '@/lib/ga-events';
import { INSTAGRAM_URL, facebookUrl, mailtoUrl, shareMessage, shareTitle, shareUrl, smsUrl, whatsappUrl, type ShareChannel, type ShareKind } from '@/lib/share';
import { ProductImage } from './ProductImage';
import { Toast, type ToastState } from './Toast';
import './ShareButton.css';

/** What the page shares. `path` is the page's own address on this site; the host comes from the browser when the button is pressed. `by` is the maker or host, `itemId` the product or workshop id (for GA4). */
export type ShareProps = { path: string; title: string; kind: ShareKind; by?: string; subtitle?: string; itemId?: string; image?: string; className?: string };

const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ShareIcon = ({ size = 16 }: { size?: number }) => <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...ICON}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.9l7.6-4.4M8.2 13.1l7.6 4.4" /></svg>;
const WhatsAppIcon = () => <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...ICON} strokeWidth={1.6}><path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8z" /><path d="M9.3 8.8c.2 2.5 2.9 5.2 5.4 5.4l1.1-1.3-1.9-.9-.9.8c-.8-.4-1.6-1.1-2-2l.8-.9-.9-1.9z" /></svg>;
const InstagramIcon = () => <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...ICON} strokeWidth={1.6}><rect x="4" y="4" width="16" height="16" rx="4.5" /><circle cx="12" cy="12" r="3.6" /><circle cx="16.8" cy="7.2" r="0.9" fill="currentColor" stroke="none" /></svg>;
const FacebookIcon = () => <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="currentColor"><path d="M13.6 21v-7.6h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.6V21z" /></svg>;

/** A phone or tablet with a share sheet of its own: "More" hands over to it, and Instagram, Slack, AirDrop and every other app the person has are there. */
const hasNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function' && !!window.matchMedia?.('(pointer: coarse)').matches;
const isTouch = () => !!window.matchMedia?.('(pointer: coarse)').matches;

const MessagesIcon = () => <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...ICON} strokeWidth={1.6}><path d="M4 5h16v11H9l-5 4z" /></svg>;
const EmailIcon = () => <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...ICON} strokeWidth={1.6}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></svg>;
const MoreIcon = () => <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>;
const CopyBig = () => <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...ICON} strokeWidth={1.6}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;
const CheckBig = () => <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...ICON} strokeWidth={2}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

/**
 * "Share" on a product, workshop, artist or category page. It opens a sheet like the ones phones' own shops use: WhatsApp, Messages (phones),
 * Copy, Email and More. On a phone, More opens the phone's own share sheet, where Instagram (and its list of people to send a link to) is.
 * On a computer, More shows Instagram and Facebook here: Facebook opens with the link filled in, Instagram has no share address, so the
 * message is copied and Instagram opens for the visitor to paste it. The address is built from the hostname the page is open on.
 * Nothing is sent by Craftofy and nothing is stored.
 */
export function ShareButton({ path, title, kind, by, subtitle, itemId, image, className = 'button share-btn' }: ShareProps) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState('');
  const [touch, setTouch] = useState(false);
  const [more, setMore] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const trigger = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const message = shareMessage(kind, title, by);
  const report = (method: ShareChannel) => gaShare({ method, kind, itemId });
  const say = (kindOfToast: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind: kindOfToast, text });

  const close = useCallback(() => { setOpen(false); setCopied(false); setMore(false); trigger.current?.focus(); }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    card.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const openDialog = () => { setOrigin(window.location.origin); setTouch(isTouch()); setCopied(false); setMore(false); setOpen(true); };
  const onMore = async () => {
    if (!hasNativeShare()) { setMore(m => !m); return; }
    try {
      await navigator.share({ title, text: message, url: shareUrl(window.location.origin, path, 'native') });
      report('native');
      close();
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') setMore(true);   // the visitor closing the phone's sheet is not an error; anything else shows the options here
    }
  };

  const fail = (text: string) => { say('error', text); field.current?.focus(); field.current?.select(); };
  const copy = (text: string, then: () => void, failed: string) => {
    const write = navigator.clipboard?.writeText?.(text);
    if (!write) { fail(failed); return; }
    write.then(then, () => fail(failed));
  };

  const url = (c: ShareChannel) => shareUrl(origin, path, c);
  const link = origin ? url('copy_link') : '';
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !card.current) return;
    const items = [...card.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input')];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === card.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

  return (
    <>
      <button ref={trigger} type="button" className={className} aria-label="Share" aria-haspopup="dialog" onClick={openDialog}><ShareIcon /><span className="share-label">Share</span></button>
      <Toast toast={toast} onClose={closeToast} />
      {open && createPortal(
        <div className="contact-backdrop admin-modal share-backdrop" onClick={e => { if (e.target === e.currentTarget) close(); }}>
          <div ref={card} role="dialog" aria-modal="true" aria-labelledby="share-h" tabIndex={-1} className="contact-card share-card" onKeyDown={trap}>
            <div className="dialog-head">
              <h2 id="share-h">{shareTitle(kind)}</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={close}>✕</button>
            </div>
            <div className="share-preview">
              {image && <span className="share-thumb"><ProductImage src={image} alt="" fallback={null} sizes="64px" /></span>}
              <span className="share-what"><b>{title}</b>{subtitle && <span>{subtitle}</span>}</span>
            </div>
            <div className="share-tiles">
              <a className="share-tile" href={whatsappUrl(message, url('whatsapp'))} {...ext} onClick={() => report('whatsapp')}><span className="share-ico"><WhatsAppIcon /></span>WhatsApp</a>
              {touch && <a className="share-tile" href={smsUrl(message, url('sms'))} onClick={() => report('sms')}><span className="share-ico"><MessagesIcon /></span>Messages</a>}
              <button type="button" className="share-tile" onClick={() => copy(link, () => { setCopied(true); say('success', 'Link copied'); report('copy_link'); }, "Couldn't copy. Press and hold the link to copy it.")}>
                <span className="share-ico">{copied ? <CheckBig /> : <CopyBig />}</span>{copied ? 'Copied' : 'Copy'}
              </button>
              <a className="share-tile" href={mailtoUrl(title, message, url('email'))} onClick={() => report('email')}><span className="share-ico"><EmailIcon /></span>Email</a>
              <button type="button" className="share-tile" aria-expanded={more} onClick={onMore}><span className="share-ico"><MoreIcon /></span>More</button>
            </div>
            {more && (
              <div className="share-more">
                <div className="share-tiles-more">
                  <a className="share-tile" href={INSTAGRAM_URL} {...ext}
                    onClick={() => { report('instagram'); copy(`${message} ${url('instagram')}`, () => say('success', 'Message copied. Paste it in Instagram.'), "Couldn't copy the message. Copy the link below instead."); }}><span className="share-ico"><InstagramIcon /></span>Instagram</a>
                  <a className="share-tile" href={facebookUrl(url('facebook'))} {...ext} onClick={() => report('facebook')}><span className="share-ico"><FacebookIcon /></span>Facebook</a>
                </div>
                <p className="share-note">Instagram has no share link, so we copy the message for you to paste into a chat or story.</p>
              </div>
            )}
            <label className="share-lbl" htmlFor="share-link">THE LINK</label>
            <input id="share-link" ref={field} className="share-link-input" type="text" readOnly value={link} onFocus={e => e.currentTarget.select()} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
