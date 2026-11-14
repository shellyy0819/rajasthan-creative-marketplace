'use client';
import { useEffect, useRef, useState } from 'react';
import type { AdminProduct, SourcingType } from '@/lib/types';
import { PlaceInput } from './PlaceInput';
import { CityInput } from './CityInput';
import { ImageUploader } from './ImageUploader';

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
// Blank or non-numeric → null so the server rejects it with a field-named 400 (Number('') would be a silent 0). The price is the one field where null is valid (optional).
const num = (f: FormData, k: string, scale = 1) => {
  const raw = text(f, k);
  const n = raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.round(n * scale) : null;
};

export function buildPayload(f: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: text(f, 'name'), description: text(f, 'description'),
    category: text(f, 'category'),
    pricePaise: num(f, 'price', 100),
    stock: num(f, 'stock'),
    images: f.getAll('images').map(v => String(v).trim()).filter(Boolean), workshopId: text(f, 'workshopId'), pickupLocation: text(f, 'pickupLocation'),
  };
  // The city is chosen from the place search (signed cityRef) or kept as is (cityId); typed text is never sent.
  const cityRef = text(f, 'cityRef'), cityId = num(f, 'cityId');
  if (cityRef) payload.cityRef = cityRef;
  else if (cityId != null) payload.cityId = cityId;
  // Only sent when the form shows the control: a seller editing a published post must not send a status,
  // and only admins get a seller picker.
  // Sent only when the form offers the choice; otherwise the server keeps the product's type (or the default for a new one).
  const sourcingTypeId = num(f, 'sourcingTypeId');
  if (f.has('sourcingTypeId') && sourcingTypeId != null) payload.sourcingTypeId = sourcingTypeId;
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
  categories: string[];
  /** Active sourcing types in the admin's order. Empty: the field is hidden and the server picks the default. */
  sourcingTypes?: SourcingType[];
  workshops: WorkshopOption[];
  sellers: SellerOption[];
  /** Called after a new category was created through the API so the parent can keep its list in sync. */
  onCategoryCreated?: (name: string) => void;
  /** The signed-in admin, shown on the "Me (admin)" option. */
  me?: SellerOption;
  onSubmit: (payload: Record<string, unknown>) => Promise<string | null>;
  onCancel: () => void;
};

const NEW_CATEGORY = '__new__';

export function PostForm({ initial, role, categories, sourcingTypes = [], workshops, sellers, me, onCategoryCreated, onSubmit, onCancel }: Props) {
  const [cats, setCats] = useState(categories);
  const [category, setCategory] = useState(initial?.category && categories.includes(initial.category) ? initial.category : categories[0] ?? '');
  // A product may keep a type that has since been switched off, so it stays selectable on that product.
  const kept = initial?.sourcing && !sourcingTypes.some(t => t.id === initial.sourcing!.id) ? [{ ...initial.sourcing, off: true }] : [];
  const sourcingOptions = [...sourcingTypes.map(t => ({ id: t.id, name: t.name, off: false })), ...kept.map(t => ({ id: t.id, name: t.name, off: true }))];
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [catBusy, setCatBusy] = useState(false);
  const [catError, setCatError] = useState('');
  async function addCategory() {
    const name = newName.trim();
    if (!name || catBusy) return;
    setCatBusy(true); setCatError('');
    try {
      const r = await fetch('/api/categories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
      const body = await r.json().catch(() => null);
      if (!r.ok) { setCatError(body?.error ?? 'Could not add the category.'); setCatBusy(false); return; }
      const created = (body as { name: string }).name;
      setCats(c => (c.includes(created) ? c : [...c, created]));
      onCategoryCreated?.(created);
      setCategory(created); setAdding(false); setNewName('');
    } catch { setCatError('Network error. Please try again.'); }
    setCatBusy(false);
  }
  const seller = role === 'seller';
  const lockedStatus = seller && initial?.status === 'APPROVED'; // a seller cannot choose a status for a published post
  const statusOptions = seller
    ? [{ value: 'DRAFT', label: 'Draft (admin publishes after review)' }, { value: 'ARCHIVED', label: 'Archived' }]
    : [{ value: 'APPROVED', label: 'Published' }, { value: 'DRAFT', label: 'Draft (admin only)' }, { value: 'ARCHIVED', label: 'Archived' }];
  const statusDefault = initial?.status && statusOptions.some(o => o.value === initial.status) ? initial.status : 'DRAFT';
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
          {sourcingOptions.length > 0 && (
            <label><span className="lbl">Sourcing</span>
              <select name="sourcingTypeId" required defaultValue={initial?.sourcing?.id ?? sourcingOptions[0].id}>
                {sourcingOptions.map(t => <option key={t.id} value={t.id}>{t.name}{t.off ? ' (switched off)' : ''}</option>)}
              </select>
            </label>
          )}
          <div className="admin-form-row">
            <div>
              <label><span className="lbl">Category</span>
                <select name="category" required value={category} onChange={e => { if (e.target.value === NEW_CATEGORY) { setAdding(true); setCatError(''); } else { setCategory(e.target.value); setAdding(false); } }}>
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value={NEW_CATEGORY}>＋ Add a new category…</option>
                </select>
              </label>
              {adding && (
                <div className="admin-form-row" style={{ marginTop: 6, alignItems: 'end' }}>
                  <label style={{ margin: 0 }}>New category name
                    <input value={newName} maxLength={40} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addCategory(); } }} placeholder="e.g. Wooden Toys" autoFocus />
                  </label>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="button primary" disabled={catBusy || !newName.trim()} aria-busy={catBusy} onClick={() => void addCategory()}>{catBusy ? 'Adding…' : 'Add category'}</button>
                    <button type="button" className="button" disabled={catBusy} onClick={() => { setAdding(false); setNewName(''); setCatError(''); }}>Cancel</button>
                  </span>
                </div>
              )}
              {catError && <p role="alert" className="admin-error" style={{ margin: '6px 0 0' }}>{catError}</p>}
            </div>
            <label><span className="lbl">City</span><CityInput required defaultCity={initial ? { id: initial.cityId, label: initial.city } : undefined} /></label>
          </div>
          <div className="admin-form-row">
            <label><span className="lbl">Price (₹)</span><input name="price" type="number" min="0" step="0.01" defaultValue={initial?.pricePaise != null ? initial.pricePaise / 100 : ''} /></label>
            <label><span className="lbl">Stock</span><input name="stock" type="number" min="0" step="1" required defaultValue={initial ? initial.stock : ''} /></label>
            {!lockedStatus && (
              <label><span className="lbl">Status</span>
                <select name="status" required defaultValue={statusDefault}>{statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              </label>
            )}
          </div>
          {lockedStatus && <p className="form-note">This post is published. Saving changes sends it back to Draft until an admin publishes it again.</p>}
          <ImageUploader initial={initial?.images ?? (initial?.imageUrl ? [initial.imageUrl] : [])} onBusyChange={setUploading} />
          <div className="admin-form-row">
            <label>Workshop
              <select name="workshopId" defaultValue={initial?.workshopId ?? ''}>
                <option value="">No workshop</option>
                {workshops.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
              </select>
            </label>
            <label>Pickup location<PlaceInput name="pickupLocation" maxLength={200} placeholder="Search a city or area, e.g. Udaipur" defaultValue={String(v('pickupLocation'))} /></label>
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
            <button type="submit" className="button primary" disabled={saving || uploading} aria-busy={saving || uploading}>{saving ? 'Saving…' : uploading ? 'Uploading photos…' : 'Save post'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
