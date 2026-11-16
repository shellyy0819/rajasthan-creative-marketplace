'use client';
import { useEffect, useId, useRef, useState } from 'react';

export const MAX_STOCK = 100_000;
const BAD = `Enter a whole number from 0 to ${MAX_STOCK.toLocaleString('en-IN')}. 0 means sold out.`;
/** The typed stock as a number: a whole number from 0 to 100000, otherwise null. */
export const parseStock = (v: string): number | null => (/^\d{1,6}$/.test(v.trim()) && Number(v) <= MAX_STOCK ? Number(v) : null);

/**
 * (The close handler only counts a dialog that is really closed: in development React runs the effect twice, so the first close() sends a late 'close' event
 * that must not shut the dialog that was just opened again.)
 *
 * A small dialog in the middle of the screen for a stock the dropdown does not offer. `onSave` saves it and returns null when it worked or the reason when it did not
 * (shown here, because a toast behind the dialog would be hidden). Escape, Cancel, the cross and a click outside close it without saving.
 */
export function StockDialog({ name, current, onSave, onClose }: { name: string; current: number; onSave: (stock: number) => Promise<string | null>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(String(current));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const uid = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }   // the attribute is the fallback where showModal does not exist
    input.current?.select();
    return () => { if (d?.open) { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); } };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const n = parseStock(value);
    if (n === null) { setError(BAD); input.current?.focus(); return; }
    if (n === current) { onClose(); return; }
    setBusy(true); setError('');
    const err = await onSave(n);
    setBusy(false);
    if (err) setError(err); else onClose();
  }

  return (
    <dialog ref={ref} aria-labelledby={`${uid}-h`} className="stock-dialog" onClose={() => { if (!ref.current?.open) onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }}>
      <div className="dialog-head">
        <h2 id={`${uid}-h`}>Set stock</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <form onSubmit={save} noValidate>
        <p className="form-note">How many of <b>{name}</b> are in stock? It is published at once, with no review.</p>
        {error && <p role="alert" className="field-error" id={`${uid}-err`}>{error}</p>}
        <label><span className="lbl">Number in stock</span>
          <input ref={input} name="stock" type="number" inputMode="numeric" min={0} max={MAX_STOCK} step={1} value={value}
            onChange={e => { setValue(e.target.value); setError(''); }} aria-describedby={error ? `${uid}-err` : undefined} required />
          <small>A whole number from 0 to {MAX_STOCK.toLocaleString('en-IN')}. 0 means sold out.</small>
        </label>
        <div className="admin-actions">
          <button type="submit" className="button primary" disabled={busy} aria-busy={busy}>Save</button>
          <button type="button" className="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </dialog>
  );
}
