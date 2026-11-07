'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

/** Tells the maker that new products start as drafts until an admin reviews them. Confirm continues; cancel, Escape and the backdrop go back. */
export function DraftNoticeDialog({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    document.body.classList.add('modal-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCancel(); return; }
      if (e.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !card.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); };
  }, [open, onCancel]);

  if (!open) return null;
  return createPortal(
    <div className="contact-backdrop admin-modal" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="draft-notice-title" aria-describedby="draft-notice-body" className="contact-card">
        <div className="dialog-head"><h2 id="draft-notice-title">Before you add your products</h2></div>
        <p id="draft-notice-body">Every product you add starts as a draft. Once an admin reviews it, it is published automatically.</p>
        <div className="admin-actions">
          <button type="button" className="button" onClick={onCancel}>Go back</button>
          <button ref={confirmRef} type="button" className="button primary" onClick={onConfirm}>Got it, finish</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
