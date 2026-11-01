'use client';
import { useEffect, useRef, useState } from 'react';
import { IMAGE_TYPES, MAX_IMAGES, MAX_IMAGE_BYTES } from '@/lib/image-limits';

type Item = { id: number; name: string; url?: string; preview?: string; status: 'uploading' | 'done' | 'error'; error?: string };

const NOT_SET_UP = 'Image uploads are not set up yet.';
/** A failure we describe ourselves; anything else thrown by fetch is a network problem. */
class UploadError extends Error {}
const signature = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;
const canPreview = () => typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

/**
 * Photos of a product: thumbnails with a Cover badge, "Make cover" and "Remove", and an "Add photos" picker that sends
 * each file straight to S3 with a signed form. The kept photos travel with the form as hidden `images` inputs, in order.
 */
export function ImageUploader({ initial, onBusyChange }: { initial: string[]; onBusyChange?: (busy: boolean) => void }) {
  const next = useRef(0);
  const [items, setItems] = useState<Item[]>(() => initial.map(url => ({ id: next.current++, name: url, url, status: 'done' as const })));
  const [messages, setMessages] = useState<string[]>([]);
  const [notSetUp, setNotSetUp] = useState(false);
  const seen = useRef(new Set<string>());
  const previews = useRef(new Map<number, string>());

  const busy = items.some(i => i.status === 'uploading');
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { previews.current.forEach(u => URL.revokeObjectURL(u)); }, []);

  const patch = (id: number, p: Partial<Item>) => setItems(list => list.map(i => (i.id === id ? { ...i, ...p } : i)));
  const dropPreview = (id: number) => { const u = previews.current.get(id); if (u) { URL.revokeObjectURL(u); previews.current.delete(id); } };

  async function upload(id: number, file: File) {
    try {
      const perm = await fetch('/api/uploads/product-image', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contentType: file.type, size: file.size }) });
      const body = await perm.json().catch(() => null) as { url?: string; fields?: Record<string, string>; publicUrl?: string; error?: string } | null;
      if (!perm.ok || !body?.url || !body.fields || !body.publicUrl) {
        if (perm.status === 503) setNotSetUp(true);
        throw new UploadError(body?.error ?? 'Could not start the upload.');
      }
      const form = new FormData();
      for (const [k, v] of Object.entries(body.fields)) form.append(k, v);
      form.append('file', file); // S3 requires the file to be the last field
      const sent = await fetch(body.url, { method: 'POST', body: form });
      if (!sent.ok) throw new UploadError('The photo could not be uploaded.');
      dropPreview(id);
      patch(id, { status: 'done', url: body.publicUrl, preview: undefined });
    } catch (e) {
      const message = e instanceof UploadError ? e.message : 'Network error. Please try again.';
      patch(id, { status: 'error', error: message });
      setMessages(m => [...m, `${file.name}: ${message}`]);
    }
  }

  function onPick(files: FileList | File[] | null) {
    const picked = Array.from(files ?? []);
    if (!picked.length) return;
    const problems: string[] = [];
    let room = MAX_IMAGES - items.length;
    const accepted: { id: number; file: File }[] = [];
    for (const file of picked) {
      if (!Object.hasOwn(IMAGE_TYPES, file.type)) { problems.push(`${file.name}: only JPEG, PNG or WebP photos are allowed.`); continue; }
      if (file.size < 1) { problems.push(`${file.name}: the file is empty.`); continue; }
      if (file.size > MAX_IMAGE_BYTES) { problems.push(`${file.name}: larger than 5 MB.`); continue; }
      if (seen.current.has(signature(file))) { problems.push(`${file.name}: already added.`); continue; }
      if (room < 1) continue;
      room--; seen.current.add(signature(file));
      accepted.push({ id: next.current++, file });
    }
    const skipped = picked.filter(f => Object.hasOwn(IMAGE_TYPES, f.type) && f.size >= 1 && f.size <= MAX_IMAGE_BYTES && !seen.current.has(signature(f))).length;
    if (skipped > 0) problems.push(`Only ${MAX_IMAGES - items.length} more photo${MAX_IMAGES - items.length === 1 ? '' : 's'} fit (limit ${MAX_IMAGES}).`);
    setMessages(problems);
    setItems(list => [...list, ...accepted.map(({ id, file }) => ({
      id, name: file.name, status: 'uploading' as const,
      preview: canPreview() ? (() => { const u = URL.createObjectURL(file); previews.current.set(id, u); return u; })() : undefined,
    }))]);
    for (const { id, file } of accepted) void upload(id, file);
  }

  const remove = (id: number) => { dropPreview(id); setItems(list => list.filter(i => i.id !== id)); };
  const makeCover = (id: number) => setItems(list => { const it = list.find(i => i.id === id); return it ? [it, ...list.filter(i => i.id !== id)] : list; });
  const kept = items.filter(i => i.status === 'done' && i.url);
  const full = items.length >= MAX_IMAGES;

  return (
    <fieldset className="uploader">
      <legend>Photos</legend>
      {kept.map(i => <input key={i.id} type="hidden" name="images" value={i.url} />)}
      <ul className="uploader-grid">
        {items.map((i, index) => (
          <li key={i.id} className={`uploader-tile ${i.status}`}>
            <div className="uploader-thumb">
              {(i.url || i.preview) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.url ?? i.preview} alt="" loading="lazy" />
              )}
              {i.status === 'uploading' && <span className="rr-spinner" role="presentation" />}
              {index === 0 && i.status === 'done' && <span className="uploader-badge">Cover</span>}
            </div>
            {i.status === 'error' && <p className="uploader-error">{i.error}</p>}
            <div className="uploader-actions">
              {index > 0 && i.status === 'done' && <button type="button" className="button" aria-label={`Make photo ${index + 1} the cover`} onClick={() => makeCover(i.id)}>Make cover</button>}
              <button type="button" className="button" aria-label={`Remove photo ${index + 1}`} disabled={i.status === 'uploading'} onClick={() => remove(i.id)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <label className={`button uploader-add${full || notSetUp ? ' disabled' : ''}`}>
        Add photos
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={full || notSetUp} onChange={e => { onPick(e.target.files); e.target.value = ''; }} />
      </label>
      <p role="status" className="uploader-count">{items.length} of {MAX_IMAGES} photos. The first is the cover. JPEG, PNG or WebP, up to 5 MB each.</p>
      {(messages.length > 0 || notSetUp) && (
        <div role="alert" className="admin-error">
          {notSetUp && <p>{NOT_SET_UP}</p>}
          {messages.filter(m => !(notSetUp && m.includes(NOT_SET_UP))).map((m, i) => <p key={i}>{m}</p>)}
        </div>
      )}
    </fieldset>
  );
}
