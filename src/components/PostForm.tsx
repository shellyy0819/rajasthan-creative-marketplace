'use client';
import { useEffect, useRef, useState } from 'react';
import type { AdminProduct } from '@/lib/types';
import { CATEGORIES, CITIES } from '@/lib/catalog-shared';

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
// Blank or non-numeric → null so the server rejects it with a field-named 400 (Number('') would be a silent 0).
const num = (f: FormData, k: string, scale = 1) => {
  const raw = text(f, k);
  const n = raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.round(n * scale) : null;
};

export function buildPayload(f: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: text(f, 'name'), description: text(f, 'description'),
    category: text(f, 'category'), city: text(f, 'city'),
    pricePaise: num(f, 'price', 100),
    stock: num(f, 'stock'),
    imageUrl: text(f, 'imageUrl'), workshopId: text(f, 'workshopId'), pickupLocation: text(f, 'pickupLocation'),
  };
  // Only sent when the form shows the control: a seller editing a published post must not send a status,
  // and only admins get a seller picker.
  if (f.has('status')) payload.status = text(f, 'status');
  if (f.has('sellerId')) payload.sellerId = text(f, 'sellerId');
  return payload;
}

export type WorkshopOption = { id: string; title: string };
export type SellerOption = { id: string; name: string; email?: string; phone?: string };
/** "Name · email · phone" so two sellers with the same public name can be told apart. */
export const sellerLabel = (s: SellerOption) => [s.name, s.email, s.phone].filter(Boolean).join(' · ');

type Props = {
  initial?: AdminProduct;
  role: 'admin' | 'seller';
  workshops: WorkshopOption[];
  sellers: SellerOption[];
  /** The signed-in admin, shown on the "Me (admin)" option. */
  me?: SellerOption;
  onSubmit: (payload: Record<string, unknown>) => Promise<string | null>;
  onCancel: () => void;
};

export function PostForm({ initial, role, workshops, sellers, me, onSubmit, onCancel }: Props) {
  const seller = role === 'seller';
  const lockedStatus = seller && initial?.status === 'APPROVED'; // a seller cannot choose a status for a published post
  const statusOptions = seller
    ? [{ value: 'DRAFT', label: 'Draft (admin publishes after review)' }, { value: 'ARCHIVED', label: 'Archived' }]
    : [{ value: 'APPROVED', label: 'Published' }, { value: 'DRAFT', label: 'Draft (admin only)' }, { value: 'ARCHIVED', label: 'Archived' }];
  const statusDefault = initial?.status && statusOptions.some(o => o.value === initial.status) ? initial.status : seller ? 'DRAFT' : 'APPROVED';
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
  const v = (k: keyof AdminProduct) => (initial?.[k] as string | number | undefined) ?? '';

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
          <label><span className="lbl">Description</span><textarea name="description" required maxLength={2000} rows={4} defaultValue={v('description')} /></label>
          <div className="admin-form-row">
            <label><span className="lbl">Category</span><select name="category" required defaultValue={v('category') || CATEGORIES[0]}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
            <label><span className="lbl">City</span><select name="city" required defaultValue={v('city') || CITIES[0]}>{CITIES.map(c => <option key={c}>{c}</option>)}</select></label>
          </div>
          <div className="admin-form-row">
            <label><span className="lbl">Price (₹)</span><input name="price" type="number" min="0" step="0.01" required defaultValue={initial ? initial.pricePaise / 100 : ''} /></label>
            <label><span className="lbl">Stock</span><input name="stock" type="number" min="0" step="1" required defaultValue={initial ? initial.stock : ''} /></label>
            {!lockedStatus && (
              <label><span className="lbl">Status</span>
                <select name="status" required defaultValue={statusDefault}>{statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              </label>
            )}
          </div>
          {lockedStatus && <p className="form-note">This post is published. Saving changes sends it back to Draft until an admin publishes it again.</p>}
          <label>Cover image URL (https)<input name="imageUrl" type="url" maxLength={500} placeholder="https://…" defaultValue={v('imageUrl')} /></label>
          <div className="admin-form-row">
            <label>Workshop
              <select name="workshopId" defaultValue={initial?.workshopId ?? ''}>
                <option value="">No workshop</option>
                {workshops.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
              </select>
            </label>
            <label>Pickup location<input name="pickupLocation" maxLength={200} placeholder="Where the product is now" defaultValue={v('pickupLocation')} /></label>
          </div>
          {!seller && (
            <label>Seller
              <select name="sellerId" defaultValue={initial?.sellerId ?? ''}>
                {!initial && <option value="">{me ? `Me (admin) · ${sellerLabel(me)}` : 'Me (admin)'}</option>}
                {initial && !sellers.some(x => x.id === initial.sellerId) && <option value={initial.sellerId}>{[initial.seller, initial.sellerEmail].filter(Boolean).join(' · ')}</option>}
                {sellers.map(x => <option key={x.id} value={x.id}>{sellerLabel(x)}</option>)}
              </select>
              <small>Their public name and contact come from the seller’s profile.</small>
            </label>
          )}
          {seller && <p className="form-note">Your public name and contact details come from <b>My profile</b>.</p>}
          <div className="admin-actions">
            <button type="button" className="button" onClick={onCancel} disabled={saving}>Cancel</button>
            <button type="submit" className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save post'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
