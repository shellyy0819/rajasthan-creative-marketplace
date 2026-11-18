'use client';
import { useEffect, useRef, useState } from 'react';
import { clearDraft, hasContent, readDraft, timeAgo, type HostDraft } from '@/lib/host-draft';

/** Sent when the person chooses Continue: the page's Host button opens the saved draft. */
export const CONTINUE_EVENT = 'craftofy:continue-host-draft';
/** Set once the person has answered, so the question is asked once per browser session. */
const ASKED = 'craftofy:draft-reminder-asked';

/**
 * A small modal in the middle of the page when an earlier visit left a host-form draft unsent: Continue, Discard or Not now.
 * It names only the event title and the saved time. It stays quiet when the link that brought the person here opens the form itself.
 */
export function HostDraftReminder() {
  const [draft, setDraft] = useState<HostDraft | null>(null);
  const continueBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try { if (sessionStorage.getItem(ASKED)) return; } catch { /* no session storage: ask anyway */ }
    const sp = new URL(window.location.href).searchParams;
    if (['in-person', 'online'].includes(sp.get('type') ?? '') || sp.has('host')) return; // the link opens the form already
    const d = readDraft();
    if (d && hasContent(d)) setDraft(d);
  }, []);

  const answer = (then?: () => void) => {
    try { sessionStorage.setItem(ASKED, '1'); } catch { /* fine */ }
    setDraft(null);
    then?.();
  };

  useEffect(() => {
    if (!draft) return;
    continueBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') answer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [draft]);

  if (!draft) return null;
  const title = draft.fields.title?.slice(0, 60);
  return (
    <div className="contact-backdrop admin-modal host-reminder-backdrop" onClick={e => { if (e.target === e.currentTarget) answer(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="host-reminder-title" className="contact-card host-reminder">
        <h2 id="host-reminder-title">Finish your listing?</h2>
        <p>You have an unfinished listing{title ? `: ${title}` : ''}. Saved {timeAgo(draft.savedAt)}.</p>
        <div className="admin-actions">
          <button type="button" className="button danger-outline" onClick={() => answer(clearDraft)}>Discard</button>
          <button type="button" className="button" onClick={() => answer()}>Not now</button>
          <button ref={continueBtn} type="button" className="button primary" onClick={() => answer(() => window.dispatchEvent(new Event(CONTINUE_EVENT)))}>Continue</button>
        </div>
      </div>
    </div>
  );
}
