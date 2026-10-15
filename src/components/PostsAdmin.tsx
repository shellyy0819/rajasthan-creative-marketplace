'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Product } from '@/lib/types';
import type { AdminArtist } from '@/lib/admin-posts';
import { artistKey } from '@/lib/artist';
import { productSlug } from '@/lib/catalog-shared';
import { money } from '@/lib/money';
import { ProductImage } from './ProductImage';
import { PostForm } from './PostForm';

const SYMBOLS = ['🌷', '⛵', '🌼', '🏺', '🧶', '🌸'];
const symbolFor = (id: string) => SYMBOLS[(Number(id.replace(/\D/g, '')) || 0) % SYMBOLS.length];
const JSON_HEADERS = { 'content-type': 'application/json' };

function explain(status: number, body: { error?: string } | null): string {
  if (status === 401) return 'Your session expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to do that.';
  return body?.error || 'Something went wrong. Please try again.';
}

export function PostsAdmin({ initialProducts, initialArtists }: { initialProducts: Product[]; initialArtists: AdminArtist[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [artists, setArtists] = useState(initialArtists);
  const [artist, setArtist] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [confirming, setConfirming] = useState<Product | null>(null);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');

  async function refresh() {
    try {
      const [p, a] = await Promise.all([
        fetch('/api/admin/products', { cache: 'no-store' }),
        fetch('/api/admin/artists', { cache: 'no-store' }),
      ]);
      if (!p.ok || !a.ok) {
        const bad = p.ok ? a : p;
        setProblem(explain(bad.status, await bad.json().catch(() => null)));
        return;
      }
      setProducts(await p.json());
      setArtists(await a.json());
    } catch { setProblem('Could not refresh the list. Check your connection.'); }
  }

  async function call(url: string, method: string, body?: unknown): Promise<string | null> {
    try {
      const res = await fetch(url, { method, headers: JSON_HEADERS, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok) { await refresh(); return explain(res.status, data); }
      return null;
    } catch { return 'Network error. Please try again.'; }
  }

  const save = async (payload: Record<string, unknown>) => {
    const isNew = editing === 'new';
    const err = await call(isNew ? '/api/products' : `/api/products/${(editing as Product).id}`, isNew ? 'POST' : 'PATCH', payload);
    if (err) return err;
    setEditing(null); setProblem(''); setMessage(isNew ? 'Post created.' : 'Post saved.');
    await refresh();
    return null;
  };

  const remove = async (p: Product) => {
    setConfirming(null);
    const err = await call(`/api/products/${p.id}`, 'DELETE');
    if (err) { setProblem(err); return; }
    setProblem(''); setMessage(`Deleted “${p.name}”.`);
    await refresh();
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter(p =>
      (!artist || artistKey(p.seller) === artist) &&
      (!status || p.status === status) &&
      (!needle || `${p.name} ${p.description} ${p.seller}`.toLowerCase().includes(needle)));
  }, [products, artist, status, q]);

  const total = artists.reduce((n, a) => n + a.total, 0);

  return (
    <section className="admin-posts">
      <div className="page-head">
        <span className="eyebrow">ADMIN</span>
        <h1>Artists’ posts</h1>
        <p>Create, edit and remove each artist’s listings. Published posts appear on the site; drafts stay here.</p>
      </div>
      {message && <p role="status" className="admin-flash">{message}</p>}
      {problem && <p role="alert" className="admin-error">{problem}</p>}

      <div className="admin-grid">
        <nav aria-label="Artists" className="admin-artists">
          <button type="button" className={artist ? '' : 'selected'} onClick={() => setArtist('')}>All artists <small>{total}</small></button>
          {artists.map(a => (
            <button key={a.key} type="button" className={artist === a.key ? 'selected' : ''} onClick={() => setArtist(a.key)}>
              {a.name} <small>{a.total}{a.drafts ? ` · ${a.drafts} ${a.drafts === 1 ? 'draft' : 'drafts'}` : ''}</small>
            </button>
          ))}
        </nav>

        <div>
          <div className="admin-toolbar">
            <input aria-label="Search posts" placeholder="Search posts…" value={q} onChange={e => setQ(e.target.value)} />
            <select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">All statuses</option><option value="APPROVED">Published</option><option value="DRAFT">Drafts</option>
            </select>
            <button type="button" className="button primary" onClick={() => { setMessage(''); setEditing('new'); }}>New post</button>
          </div>

          {products.length === 0 ? <div className="empty">No posts yet. Create the first one.</div>
            : shown.length === 0 ? <div className="empty">No posts match those filters.</div>
            : shown.map(p => (
              <article key={p.id} className="admin-row" data-testid="post-row">
                <div className="admin-thumb">
                  <ProductImage src={p.imageUrl} alt={p.name} fallback={<span aria-hidden="true">{symbolFor(p.id)}</span>} />
                </div>
                <div className="admin-row-main">
                  <h3>{p.name}</h3>
                  <p>{p.seller} · {p.category} · {p.city} · {money(p.pricePaise)} · {p.stock} in stock</p>
                  <p><span className={`badge ${p.status === 'APPROVED' ? 'published' : 'draft'}`}>{p.status === 'APPROVED' ? 'Published' : 'Draft'}</span>
                    {p.status === 'APPROVED'
                      ? <Link href={`/products/${productSlug(p)}`}>View public page ↗</Link>
                      : <small> Draft — not public</small>}</p>
                </div>
                {confirming?.id === p.id ? (
                  <div className="admin-confirm" role="group" aria-label={`Confirm delete ${p.name}`}>
                    <span>Delete “{p.name}”? This can’t be undone.</span>
                    <button type="button" className="button" onClick={() => setConfirming(null)}>Cancel</button>
                    <button type="button" className="button danger" onClick={() => remove(p)}>Yes, delete</button>
                  </div>
                ) : (
                  <div className="admin-row-actions">
                    <button type="button" className="button" aria-label={`Edit ${p.name}`} onClick={() => { setMessage(''); setEditing(p); }}>Edit</button>
                    <button type="button" className="button danger-outline" aria-label={`Delete ${p.name}`} onClick={() => setConfirming(p)}>Delete</button>
                  </div>
                )}
              </article>
            ))}
        </div>
      </div>

      {editing && <PostForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? undefined : editing} artists={artists} onSubmit={save} onCancel={() => setEditing(null)} />}
    </section>
  );
}
