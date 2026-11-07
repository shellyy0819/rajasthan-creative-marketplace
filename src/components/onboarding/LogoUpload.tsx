'use client';
import { useEffect, useRef, useState } from 'react';
import { MAX_IMAGE_BYTES } from '@/lib/image-limits';

export const LOGO_MIN_SIZE = 400;
export const LOGO_MESSAGES = {
  type: 'Use a JPG or PNG photo.',
  size: 'That photo is larger than 5 MB. Choose a smaller one.',
  small: 'That photo is too small. Use one that is at least 400 by 400 pixels.',
  unreadable: 'We could not read that photo. Try a different JPG or PNG.',
  notSetUp: 'Photo uploads are not set up yet. Please try again later.',
  failed: 'The photo could not be uploaded.',
  network: 'Network error. Please check your connection and try again.',
} as const;

/** A failure we describe ourselves; anything else thrown by fetch is a network problem. */
class UploadError extends Error {}

async function readSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file);
      const size = { width: bmp.width, height: bmp.height };
      bmp.close?.();
      return size;
    }
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('decode'));
        img.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  } catch { return null; }
}

/**
 * Logo or profile photo: checks the file in the browser (JPG or PNG, at least 400 by 400, up to 5 MB), then sends it
 * straight to S3 with a signed form from /api/uploads/seller-logo. `value` is the uploaded public URL.
 */
export function LogoUpload({ value, onChange, onBusyChange, invalid, describedBy }: {
  value: string; onChange: (url: string) => void; onBusyChange: (busy: boolean) => void;
  invalid?: boolean; describedBy?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);
  const lastFile = useRef<File | null>(null);
  const alive = useRef(true);
  const busyCb = useRef(onBusyChange);
  useEffect(() => { busyCb.current = onBusyChange; });
  useEffect(() => { busyCb.current(busy); }, [busy]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function send(file: File) {
    setBusy(true); setError(''); setRetryable(false);
    try {
      const perm = await fetch('/api/uploads/seller-logo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contentType: file.type, size: file.size }) });
      const body = await perm.json().catch(() => null) as { url?: string; fields?: Record<string, string>; publicUrl?: string; error?: string } | null;
      if (perm.status === 503) throw new UploadError(LOGO_MESSAGES.notSetUp);
      if (!perm.ok || !body?.url || !body.fields || !body.publicUrl) throw new UploadError(body?.error ?? LOGO_MESSAGES.failed);
      const form = new FormData();
      for (const [k, v] of Object.entries(body.fields)) form.append(k, v);
      form.append('file', file); // S3 requires the file to be the last field
      const sent = await fetch(body.url, { method: 'POST', body: form });
      if (!sent.ok) throw new UploadError(LOGO_MESSAGES.failed);
      if (!alive.current) return;
      lastFile.current = null;
      onChange(body.publicUrl);
    } catch (e) {
      if (!alive.current) return;
      const notSetUp = e instanceof UploadError && e.message === LOGO_MESSAGES.notSetUp;
      setError(e instanceof UploadError ? e.message : LOGO_MESSAGES.network);
      setRetryable(!notSetUp);
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    lastFile.current = null;
    setError(''); setRetryable(false);
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') { setError(LOGO_MESSAGES.type); return; }
    if (file.size > MAX_IMAGE_BYTES) { setError(LOGO_MESSAGES.size); return; }
    setBusy(true); // checking the picture counts as busy so Finish waits
    const size = await readSize(file);
    if (!alive.current) return;
    if (!size) { setBusy(false); setError(LOGO_MESSAGES.unreadable); return; }
    if (size.width < LOGO_MIN_SIZE || size.height < LOGO_MIN_SIZE) { setBusy(false); setError(LOGO_MESSAGES.small); return; }
    lastFile.current = file;
    await send(file);
  }

  const describe = [describedBy, error ? 'err-logo-upload' : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="logo-upload">
      <div className={`logo-preview${value ? ' has-photo' : ''}`}>
        {value
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={value} alt="Your logo" />
          : <span aria-hidden="true">Logo</span>}
        {busy && <span className="rr-spinner" role="presentation" />}
      </div>
      <div className="logo-actions">
        <label className={`button uploader-add${busy ? ' disabled' : ''}`}>
          {value ? 'Replace photo' : 'Upload photo'}
          <input type="file" name="logo" data-field="logoUrl" accept="image/jpeg,image/png" disabled={busy}
            aria-invalid={invalid || error ? true : undefined} aria-describedby={describe}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void pick(f); }} />
        </label>
        <small className="onboard-hint">Camera or gallery. JPG or PNG, up to 5 MB.</small>
        {busy && <small className="onboard-hint" role="status">Uploading…</small>}
        {error && (
          <p className="field-error" id="err-logo-upload" role="alert"><span>{error}</span></p>
        )}
        {error && retryable && (
          <button type="button" className="button" onClick={() => lastFile.current && void send(lastFile.current)}>Try again</button>
        )}
      </div>
    </div>
  );
}
