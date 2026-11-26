'use client';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { PageLoader } from './PageLoader';
import { Toast, type ToastState } from './Toast';
import { istParts } from '@/lib/ist';
import type { MatchedItem } from '@/lib/trend-match';
import { TREND_KINDS, type TrendItem, type TrendKind, type TrendSource } from '@/lib/trend-types';
import './MarketTrendsAdmin.css';

/** A digest as the browser has it: the dates arrive as text (from the server page or from the API). */
export type DigestDto = {
  id: string; createdAt: string; createdBy: string; model: string; status: 'ok' | 'empty' | 'failed'; error: string | null;
  items: TrendItem[]; publishedAt: string | null; publishedBy: string | null;
};
export type SummaryDto = Omit<DigestDto, 'items'> & { itemCount: number; shownCount: number };

const HEADERS = { 'content-type': 'application/json' };
const KIND_LABEL: Record<TrendKind, string> = { craft: 'Craft', art: 'Art', workshop: 'Workshop' };
const MAX_SOURCES = 4;
const GENERIC_ERROR = 'Something went wrong. Please try again.';

const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
const dateTime = (iso: string) => `${longDate(iso)}, ${istParts(new Date(iso)).time}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const summaryOf = (d: DigestDto): SummaryDto => {
  const { items, ...rest } = d;
  return { ...rest, itemCount: items.length, shownCount: items.filter(i => i.show).length };
};
const isHttps = (url: string | undefined): url is string => {
  if (!url) return false;
  try { return new URL(url).protocol === 'https:'; } catch { return false; }
};

type Result<T> = { error: string | null; data: T | null };
async function call<T>(url: string, method: string, body?: unknown): Promise<Result<T>> {
  try {
    const r = await fetch(url, { method, headers: HEADERS, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await r.json().catch(() => null);
    return r.ok ? { error: null, data: data as T } : { error: (data as { error?: string } | null)?.error ?? GENERIC_ERROR, data: null };
  } catch { return { error: 'Network error. Please try again.', data: null }; }
}

/** How much of what the trend names we already have on the site. */
function reach(m: MatchedItem | undefined): string | null {
  if (!m) return null;
  if (m.count === 0) return 'Not listed yet';
  return `We have ${m.kind === 'workshop' ? plural(m.count, 'workshop', 'workshops') : plural(m.count, 'piece', 'pieces')}`;
}

type Draft = { title: string; why: string; category: string; tags: string; kind: TrendKind; origin: 'pinterest' | 'manual'; sources: { title: string; url: string }[] };
type Body = { title: string; why: string; category?: string; tags: string[]; kind: TrendKind; sources: TrendSource[]; origin?: 'pinterest' | 'manual' };

/**
 * A dialog in the middle of the screen to add an item by hand or to edit one. `onSave` returns null when it worked or the reason when it did not
 * (shown inside the dialog, because a toast behind it would be hidden). Escape, Cancel and the cross close it without saving (a click outside does not: the dialog has padding of its own and a drag that ends there would throw away a long form), and focus goes back to the button that opened it.
 * (The native dialog traps Tab by itself; where `showModal` does not exist the attribute is the fallback.)
 */
function ItemDialog({ item, onSave, onClose }: { item: TrendItem | null; onSave: (body: Body) => Promise<string | null>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const uid = useId();
  const adding = item === null;
  const [d, setD] = useState<Draft>(() => ({
    title: item?.title ?? '', why: item?.why ?? '', category: item?.category ?? '', tags: item?.tags.join(', ') ?? '', kind: item?.kind ?? 'craft', origin: 'manual',
    sources: item ? item.sources.map(s => ({ title: s.title, url: s.url ?? '' })) : [{ title: '', url: '' }],
  }));
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const set = (patch: Partial<Draft>) => { setD(cur => ({ ...cur, ...patch })); setError(''); };
  const setSource = (i: number, patch: Partial<{ title: string; url: string }>) => set({ sources: d.sources.map((s, n) => (n === i ? { ...s, ...patch } : s)) });

  useEffect(() => {
    const el = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (el && !el.open) { if (typeof el.showModal === 'function') el.showModal(); else el.setAttribute('open', ''); }
    first.current?.focus();
    return () => {
      if (el?.open) { if (typeof el.close === 'function') el.close(); else el.removeAttribute('open'); }
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const close = () => { if (!pending) onClose(); };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true); setError('');
    try {
      const category = d.category.trim();
      const body: Body = {
        title: d.title.trim(), why: d.why.trim(), ...(category ? { category } : adding ? {} : { category: '' }),
        tags: d.tags.split(',').map(t => t.trim()).filter(Boolean), kind: d.kind,
        sources: d.sources.map(s => (s.url.trim() ? { title: s.title.trim(), url: s.url.trim() } : { title: s.title.trim() })),
        ...(adding ? { origin: d.origin } : {}),
      };
      const err = await onSave(body);
      if (err) setError(err);
    } finally { setPending(false); }
  }

  return (
    <dialog ref={ref} aria-labelledby={`${uid}-h`} className="trend-dialog"
      onCancel={e => { e.preventDefault(); close(); }}
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); close(); } }}>
      <div className="dialog-head">
        <h2 id={`${uid}-h`}>{adding ? 'Add an item by hand' : 'Edit item'}</h2>
        <button type="button" className="icon-btn" onClick={close} aria-label="Close">✕</button>
      </div>
      <form className="admin-form" onSubmit={submit}>
        <p className="form-note"><b>*</b> Required</p>
        {error && <p role="alert" className="admin-error">{error}</p>}
        <label><span className="lbl">Title</span>
          <input ref={first} required minLength={3} maxLength={120} value={d.title} onChange={e => set({ title: e.target.value })} /></label>
        <label><span className="lbl">Why it is rising</span>
          <textarea required minLength={10} maxLength={400} rows={3} value={d.why} onChange={e => set({ why: e.target.value })} /></label>
        <div className="admin-form-row">
          <label><span className="lbl">Category</span>
            <input maxLength={60} value={d.category} onChange={e => set({ category: e.target.value })} /></label>
          <label><span className="lbl">Tags</span>
            <input maxLength={200} value={d.tags} onChange={e => set({ tags: e.target.value })} /><small>Up to 6, separated by commas.</small></label>
        </div>
        <div className="admin-form-row">
          <label><span className="lbl">Kind</span>
            <select required value={d.kind} onChange={e => set({ kind: e.target.value as TrendKind })}>
              {TREND_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select></label>
          {adding && (
            <label><span className="lbl">Where it came from</span>
              <select required value={d.origin} onChange={e => set({ origin: e.target.value as Draft['origin'] })}>
                <option value="pinterest">Pinterest</option>
                <option value="manual">Manual research</option>
              </select></label>
          )}
        </div>
        <fieldset>
          <legend>SOURCES</legend>
          {d.sources.map((s, i) => (
            <div key={i} className="trend-source">
              <div className="admin-form-row">
                <label><span className="lbl">{`Source ${i + 1} name`}</span>
                  <input required minLength={2} maxLength={80} value={s.title} onChange={e => setSource(i, { title: e.target.value })} /></label>
                <label><span className="lbl">{`Source ${i + 1} link (https, optional)`}</span>
                  <input type="url" inputMode="url" maxLength={300} pattern="https://.+" title="An https link, for example https://example.com/page" value={s.url} onChange={e => setSource(i, { url: e.target.value })} /></label>
              </div>
              <div className="admin-row-actions">
                <button type="button" className="button" aria-label={`Remove source ${i + 1}`} disabled={d.sources.length <= 1} onClick={() => set({ sources: d.sources.filter((_, n) => n !== i) })}>Remove</button>
              </div>
            </div>
          ))}
          <div className="admin-row-actions">
            <button type="button" className="button" disabled={d.sources.length >= MAX_SOURCES} onClick={() => set({ sources: [...d.sources, { title: '', url: '' }] })}>Add a source</button>
          </div>
        </fieldset>
        <div className="admin-actions">
          <button type="submit" className="button primary" disabled={pending} aria-busy={pending}>{adding ? 'Add item' : 'Save'}</button>
          <button type="button" className="button" onClick={close}>Cancel</button>
        </div>
      </form>
    </dialog>
  );
}

export function MarketTrendsAdmin({ digests: initialDigests, selected, matched: initialMatched, keySet, publicOrigin = '' }: {
  digests: SummaryDto[]; selected: DigestDto | null; matched: MatchedItem[]; keySet: boolean; publicOrigin?: string;
}) {
  const [digests, setDigests] = useState(initialDigests);
  const [digest, setDigest] = useState(selected);
  const [matched, setMatched] = useState(initialMatched);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ itemId: string | null } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const openId = useRef(selected?.id ?? null);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const closeToast = useCallback(() => setToast(null), []);

  /** Runs one action at a time; the busy key says which button shows its spinner. */
  async function run<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
    if (busy) return null;
    setBusy(key);
    try { return await fn(); } finally { setBusy(null); }
  }
  /** Takes a digest the API sent back into the list and, when it is the open one, into the items below. A published digest makes every other one a draft. */
  function adopt(d: DigestDto) {
    const s = summaryOf(d);
    setDigests(list => {
      const next = list.some(x => x.id === d.id) ? list.map(x => (x.id === d.id ? s : x)) : [s, ...list];
      return d.publishedAt ? next.map(x => (x.id === d.id ? x : { ...x, publishedAt: null, publishedBy: null })) : next;
    });
    setDigest(cur => (!cur ? cur : cur.id === d.id ? d : d.publishedAt ? { ...cur, publishedAt: null, publishedBy: null } : cur)); // publishing another digest unpublishes the open one, so it unlocks
  }
  function open(d: DigestDto, m: MatchedItem[]) {
    openId.current = d.id;
    setDigest(d); setMatched(m);
    window.history.replaceState(null, '', `?d=${d.id}`);
  }
  /** What we have on the site for each item, read again after a change that could alter it. */
  async function refreshMatched(id: string) {
    const r = await call<{ digest: DigestDto; matched: MatchedItem[] }>(`/api/admin/trends/${id}`, 'GET');
    if (r.data && openId.current === id) setMatched(r.data.matched);
  }
  async function refreshList() {
    const r = await call<{ digests: SummaryDto[] }>('/api/admin/trends', 'GET');
    if (r.data) setDigests(r.data.digests);
  }

  async function fetchTrends() {
    await run('fetch', async () => {
      const r = await call<DigestDto>('/api/admin/trends', 'POST');
      if (r.error || !r.data) { notify('error', r.error ?? GENERIC_ERROR); await refreshList(); return; } // a failed fetch leaves a failed digest behind
      adopt(r.data);
      const m = await call<{ digest: DigestDto; matched: MatchedItem[] }>(`/api/admin/trends/${r.data.id}`, 'GET');
      open(r.data, m.data?.matched ?? []);
      if (r.data.status === 'ok') notify('success', `Fetched ${plural(r.data.items.length, 'item', 'items')}.`);
      else notify('error', 'Nothing usable came back.');
    });
  }
  async function switchTo(id: string) {
    await run('open', async () => {
      const r = await call<{ digest: DigestDto; matched: MatchedItem[] }>(`/api/admin/trends/${id}`, 'GET');
      if (r.error || !r.data) return notify('error', r.error ?? GENERIC_ERROR);
      open(r.data.digest, r.data.matched);
    });
  }
  async function preview(s: SummaryDto) {
    await run(`preview-${s.id}`, async () => {
      const r = await call('/api/admin/trends/preview', 'POST', { id: s.id });
      if (r.error) return notify('error', r.error);
      setPreviewing(true);
      notify('success', `Previewing the ${longDate(s.createdAt)} digest. Open /trending while signed in.`);
    });
  }
  async function stopPreviewing() {
    await run('stop', async () => {
      const r = await call('/api/admin/trends/preview', 'DELETE');
      if (r.error) return notify('error', r.error);
      setPreviewing(false);
      notify('success', 'Preview is off.');
    });
  }
  async function publish(s: SummaryDto, on: boolean) {
    await run(`${on ? 'publish' : 'unpublish'}-${s.id}`, async () => {
      const r = await call<DigestDto>(`/api/admin/trends/${s.id}/publish`, on ? 'POST' : 'DELETE');
      if (r.error || !r.data) return notify('error', r.error ?? GENERIC_ERROR);
      adopt(r.data);
      notify('success', `${on ? 'Published' : 'Unpublished'} the ${longDate(s.createdAt)} digest.`);
    });
  }
  async function patch(it: TrendItem, change: { show: boolean } | { kind: TrendKind }) {
    if (!digest) return;
    const id = digest.id;
    await run(`item-${it.id}`, async () => {
      const r = await call<DigestDto>(`/api/admin/trends/${id}/items/${it.id}`, 'PATCH', change);
      if (r.error || !r.data) return notify('error', r.error ?? GENERIC_ERROR);
      adopt(r.data);
      if ('kind' in change) await refreshMatched(id); // the kind decides what we look for on the site
    });
  }
  /** Saves the dialog. Returns null when it worked, otherwise the reason, which the dialog shows. */
  async function saveItem(body: Body): Promise<string | null> {
    if (!digest || !dialog) return GENERIC_ERROR;
    const id = digest.id;
    const itemId = dialog.itemId;
    const r = itemId === null ? await call<DigestDto>(`/api/admin/trends/${id}/items`, 'POST', body) : await call<DigestDto>(`/api/admin/trends/${id}/items/${itemId}`, 'PATCH', body);
    if (r.error || !r.data) return r.error ?? GENERIC_ERROR;
    adopt(r.data);
    setDialog(null);
    notify('success', itemId === null ? 'Item added. It is hidden until you tick Shown.' : 'Item saved.');
    void refreshMatched(id);
    return null;
  }

  const editing = dialog?.itemId ? digest?.items.find(i => i.id === dialog.itemId) ?? null : null;
  const locked = !!digest?.publishedAt;

  return (
    <section className="admin-posts">
      <div className="page-head">
        <h1>Market trends</h1>
        <p>Fetch what is rising in arts and crafts, check it, preview it on the site, then publish it to /trending for everyone. Nothing is public until you publish.</p>
      </div>
      <Toast toast={toast} onClose={closeToast} />
      <PageLoader show={busy === 'open' || (busy?.startsWith('item-') ?? false)} label="Working…" blocking={false} />

      <div className="admin-grid admin-grid-solo">
        <div className="trend-admin">
          {!keySet && <p className="trend-note">No Gemini key is saved, so trends cannot be fetched. Add one in <Link href="/dashboard/settings" className="text-link">Settings</Link>.</p>}
          <div className="admin-toolbar trend-bar">
            <button type="button" className="button primary" disabled={!keySet || !!busy} aria-busy={busy === 'fetch'} onClick={() => void fetchTrends()}>Fetch trends</button>
            {digests.length > 0 && (
              <select aria-label="Digest" value={digest?.id ?? ''} disabled={!!busy} onChange={e => void switchTo(e.target.value)}>
                {digests.map(s => <option key={s.id} value={s.id}>{`${dateTime(s.createdAt)} · ${s.publishedAt ? 'Published' : 'Draft'}`}</option>)}
              </select>
            )}
            <button type="button" className="button" disabled={!!busy} aria-busy={busy === 'stop'} onClick={() => void stopPreviewing()}>Stop previewing</button>
            {previewing && <a className="text-link" href={`${publicOrigin}/trending`}>Open /trending</a>}
          </div>

          {digests.length === 0 && <div className="empty">No digests yet. Fetch trends to make the first one.</div>}
          {digests.map(s => {
            const date = longDate(s.createdAt);
            const none = s.status === 'ok' && s.shownCount === 0;
            const hint = `trend-hint-${s.id}`;
            return (
              <article key={s.id} className="admin-row trend-card" aria-label={`Digest of ${date}`} aria-current={digest?.id === s.id ? 'true' : undefined}>
                <div className="admin-row-main">
                  <h3>{dateTime(s.createdAt)}</h3>
                  <p className="admin-status-line"><span className={`badge ${s.publishedAt ? 'published' : 'draft'}`}>{s.publishedAt ? 'Published' : 'Draft'}</span></p>
                  {s.status === 'ok' && <p>{`${plural(s.itemCount, 'item', 'items')}, ${s.shownCount} shown.`}{s.publishedAt ? ` Live on /trending since ${longDate(s.publishedAt)}.` : ' Only admins can see a draft.'}</p>}
                  {s.status === 'failed' && <p className="admin-error">{s.error ?? 'The research failed.'}</p>}
                  {s.status === 'empty' && <p>Nothing usable came back.</p>}
                  {none && <p id={hint}>Switch on at least one item to preview or publish.</p>}
                </div>
                <div className="admin-row-actions">
                  <button type="button" className="button" aria-label={`Preview on site: ${date} digest`} aria-describedby={none ? hint : undefined} aria-busy={busy === `preview-${s.id}`}
                    disabled={!!busy || s.shownCount === 0} onClick={() => void preview(s)}>Preview on site</button>
                  {s.publishedAt ? (
                    <button type="button" className="button danger-outline" aria-label={`Unpublish: ${date} digest`} aria-busy={busy === `unpublish-${s.id}`}
                      disabled={!!busy} onClick={() => void publish(s, false)}>Unpublish</button>
                  ) : (
                    <button type="button" className="button primary" aria-label={`Publish for everyone: ${date} digest`} aria-describedby={none ? hint : undefined} aria-busy={busy === `publish-${s.id}`}
                      disabled={!!busy || s.status !== 'ok' || s.shownCount === 0} onClick={() => void publish(s, true)}>Publish for everyone</button>
                  )}
                </div>
              </article>
            );
          })}

          {digest && digest.status === 'ok' && (
            <section className="trend-items" aria-labelledby="trend-items-h">
              <h2 id="trend-items-h">Check the items</h2>
              <p className="muted">{`Digest of ${dateTime(digest.createdAt)}. Switch off what should not be public. Fix the kind if it is wrong, since the heading on /trending follows it. Add your own research or Pinterest findings by hand.`}</p>
              {locked && <p className="muted">Unpublish to edit</p>}
              <div className="trend-list">
                {digest.items.map(it => {
                  const off = locked || !!busy;
                  const line = reach(matched.find(m => m.id === it.id));
                  return (
                    <article key={it.id} className="admin-row trend-item" data-testid="trend-item">
                      <label className="trend-show">
                        <input type="checkbox" aria-label={`Show ${it.title} on /trending`} checked={it.show} disabled={off} onChange={e => void patch(it, { show: e.target.checked })} />
                        <span>{it.show ? 'Shown' : 'Hidden'}</span>
                      </label>
                      <div className="admin-row-main">
                        <h3>{it.title}</h3>
                        <p>{it.why}</p>
                        <p>
                          {'Source: '}
                          {it.sources.map((src, i) => (
                            <span key={i}>{i > 0 && ', '}{isHttps(src.url) ? <a href={src.url} target="_blank" rel="noopener noreferrer">{src.title}</a> : src.title}</span>
                          ))}
                        </p>
                        {line && <p>{line}</p>}
                      </div>
                      <div className="admin-row-actions">
                        <select className="admin-status-select" aria-label={`Kind of ${it.title}`} value={it.kind} disabled={off} onChange={e => void patch(it, { kind: e.target.value as TrendKind })}>
                          {TREND_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                        </select>
                        <button type="button" className="button" aria-label={`Edit ${it.title}`} disabled={off} onClick={() => setDialog({ itemId: it.id })}>Edit</button>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="trend-add">
                <button type="button" className="button" disabled={locked || !!busy} onClick={() => setDialog({ itemId: null })}>+ Add an item by hand</button>
              </div>
            </section>
          )}

          {dialog && (dialog.itemId === null || editing) && (
            <ItemDialog key={dialog.itemId ?? 'new'} item={editing} onSave={saveItem} onClose={() => setDialog(null)} />
          )}
        </div>
      </div>
    </section>
  );
}
