'use client';
import { useEffect, useRef, useState } from 'react';
import { PHONE_HINT, PHONE_PATTERN } from '@/lib/phone';
import type { Product } from '@/lib/types';
import type { AdminArtist } from '@/lib/admin-posts';
import { CATEGORIES, CITIES } from '@/lib/catalog-shared';

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
// Blank or non-numeric → null so the server rejects it with a field-named 400 (Number('') would be a silent 0).
const num = (f: FormData, k: string, scale = 1) => {
  const raw = text(f, k);
  const n = raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.round(n * scale) : null;
};

export function buildPayload(f: FormData): Record<string, unknown> {
  return {
    name: text(f, 'name'), seller: text(f, 'seller'), description: text(f, 'description'),
    category: text(f, 'category'), city: text(f, 'city'),
    pricePaise: num(f, 'price', 100),
    stock: num(f, 'stock'),
    status: text(f, 'status'),
    imageUrl: text(f, 'imageUrl'), artistName: text(f, 'artistName'), instagram: text(f, 'instagram'),
    youtube: text(f, 'youtube'), phone: text(f, 'phone'), email: text(f, 'email'),
  };
}

type Props = {
  initial?: Product;
  artists: AdminArtist[];
  onSubmit: (payload: Record<string, unknown>) => Promise<string | null>;
  onCancel: () => void;
};

export function PostForm({ initial, artists, onSubmit, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  // Remember what had focus when the dialog opened (captured during first render, before autoFocus moves it).
  const [opener] = useState(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)));

  useEffect(() => () => { opener?.focus?.(); }, [opener]);

  // Escape works wherever focus is (not just inside the overlay), but never while a save is in flight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saving, onCancel]);

  // Keep Tab inside the dialog (aria-modal): wrap at the ends and pull stray focus back in.
  useEffect(() => {
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const items = Array.from(card.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !card.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onTab);
    return () => document.removeEventListener('keydown', onTab);
  }, []);
  const v = (k: keyof Product) => (initial?.[k] as string | number | undefined) ?? '';

  return (
    <div className="admin-modal">
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="post-form-title" className="admin-form-card">
        <div className="dialog-head">
          <h2 id="post-form-title">{initial ? 'Edit post' : 'New post'}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onCancel} disabled={saving}>✕</button>
        </div>
        <form className="admin-form" onSubmit={async e => {
          e.preventDefault();
          if (saving) return;
          setSaving(true); setError('');
          const message = await onSubmit(buildPayload(new FormData(e.currentTarget)));
          if (message) { setError(message); setSaving(false); }
        }}>
          <p className="form-note"><b>*</b> Required</p>
          {error && <p role="alert" className="admin-error">{error}</p>}
          <label><span className="lbl">Title</span><input name="name" required maxLength={200} defaultValue={v('name')} autoFocus /></label>
          <label><span className="lbl">Artist (seller name)</span><input name="seller" required maxLength={200} defaultValue={v('seller')} list="artist-names" />
            <datalist id="artist-names">{artists.map(a => <option key={a.key} value={a.name} />)}</datalist>
            <small>Posts with the same artist name are grouped together. Changing it moves this post to another artist.</small>
          </label>
          <label><span className="lbl">Description</span><textarea name="description" required maxLength={2000} rows={4} defaultValue={v('description')} /></label>
          <div className="admin-form-row">
            <label><span className="lbl">Category</span><select name="category" required defaultValue={v('category') || CATEGORIES[0]}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
            <label><span className="lbl">City</span><select name="city" required defaultValue={v('city') || CITIES[0]}>{CITIES.map(c => <option key={c}>{c}</option>)}</select></label>
          </div>
          <div className="admin-form-row">
            <label><span className="lbl">Price (₹)</span><input name="price" type="number" min="0" step="0.01" required defaultValue={initial ? initial.pricePaise / 100 : ''} /></label>
            <label><span className="lbl">Stock</span><input name="stock" type="number" min="0" step="1" required defaultValue={initial ? initial.stock : ''} /></label>
            <label><span className="lbl">Status</span><select name="status" required defaultValue={initial?.status ?? 'APPROVED'}><option value="APPROVED">Published</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option></select></label>
          </div>
          <label>Cover image URL (https)<input name="imageUrl" type="url" maxLength={500} placeholder="https://…" defaultValue={v('imageUrl')} /></label>
          <fieldset>
            <legend>Artist contact (shown on this post’s page)</legend>
            <div className="admin-form-row">
              <label>Display name<input name="artistName" maxLength={200} defaultValue={v('artistName')} /></label>
              <label>Phone<input name="phone" type="tel" inputMode="tel" maxLength={40} pattern={PHONE_PATTERN} title={PHONE_HINT} placeholder="9989898999" defaultValue={v('phone')} /></label>
            </div>
            <div className="admin-form-row">
              <label>Instagram<input name="instagram" maxLength={200} defaultValue={v('instagram')} /></label>
              <label>YouTube<input name="youtube" maxLength={200} defaultValue={v('youtube')} /></label>
              <label>Email<input name="email" type="email" maxLength={200} defaultValue={v('email')} /></label>
            </div>
          </fieldset>
          <div className="admin-actions">
            <button type="button" className="button" onClick={onCancel} disabled={saving}>Cancel</button>
            <button type="submit" className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save post'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
