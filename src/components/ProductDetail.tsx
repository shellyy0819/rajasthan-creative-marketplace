'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { AdminProduct } from '@/lib/types';
import { productSlug } from '@/lib/catalog-shared';
import { money } from '@/lib/money';
import { ProductImage } from './ProductImage';

const STATUS_LABEL: Record<string, string> = { APPROVED: 'Published', DRAFT: 'Draft', ARCHIVED: 'Archived' };
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : undefined);
const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  const empty = children === undefined || children === null || children === '';
  return (<><dt>{label}</dt><dd>{empty ? <span className="pd-empty">—</span> : children}</dd></>);
}

/** Read-only view of everything we know about a post. */
export function ProductDetail({ product: p, role, onEdit, onClose }: { product: AdminProduct; role: 'admin' | 'seller'; onEdit: () => void; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const card = cardRef.current;
      const items = card ? Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
      if (!card || !items.length) return;
      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !card.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const status = STATUS_LABEL[p.status] ?? p.status;
  const badge = p.status === 'APPROVED' ? 'published' : p.status === 'ARCHIVED' ? 'archived' : 'draft';
  return (
    <div className="admin-modal" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="pd-title" className="admin-form-card pd-card">
        <div className="dialog-head">
          <h2 id="pd-title">{p.name}</h2>
          <button ref={closeRef} type="button" className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="pd-top">
          <div className="admin-thumb pd-thumb">
            <ProductImage src={p.imageUrl} alt={p.name} fallback={<span aria-hidden="true">🌸</span>} />
          </div>
          <div className="pd-summary">
            <span className={`badge ${badge}`}>{status}</span>
            <p className="pd-price">{money(p.pricePaise)} <small>· {p.stock} in stock</small></p>
            {p.status === 'APPROVED' && <Link href={`/products/${productSlug(p)}`}>View public page ↗</Link>}
          </div>
        </div>
        <p className="pd-desc">{p.description}</p>

        <h3 className="pd-h">Listing</h3>
        <dl className="pd-grid">
          <Field label="Category">{p.category}</Field>
          <Field label="City">{p.city}</Field>
          <Field label="Workshop">{p.workshopTitle ? `${p.workshopTitle} (${p.workshopId})` : p.workshopId}</Field>
          <Field label="Pickup location">{p.pickupLocation}</Field>
        </dl>

        <h3 className="pd-h">Seller</h3>
        <dl className="pd-grid">
          <Field label="Public name">{p.seller}</Field>
          <Field label="Account email">{p.sellerEmail}</Field>
          <Field label="Public phone">{p.phone}</Field>
          <Field label="Public email">{p.email}</Field>
          <Field label="Instagram">{p.instagram}</Field>
          <Field label="YouTube">{p.youtube}</Field>
        </dl>

        <h3 className="pd-h">Record</h3>
        <dl className="pd-grid">
          <Field label="Id">{p.id}</Field>
          <Field label="Published">{p.publishedAt ? `${when(p.publishedAt)}${p.publishedByEmail ? ` by ${p.publishedByEmail}` : ''}` : <span className="pd-empty">Not published yet</span>}</Field>
          <Field label="Created">{when(p.createdAt)}</Field>
          <Field label="Last updated">{when(p.updatedAt)}</Field>
        </dl>

        <div className="admin-actions">
          <button type="button" className="button" onClick={onClose}>Done</button>
          <button type="button" className="button primary" onClick={onEdit}>Edit</button>
        </div>
        {role === 'seller' && <p className="form-note" style={{ marginTop: 10 }}>Only an admin can publish a post.</p>}
      </div>
    </div>
  );
}
