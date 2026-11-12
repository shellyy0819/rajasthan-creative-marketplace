'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { money } from '@/lib/money';
import type { FairData, FairItem, FairMaker } from '@/lib/fair-types';
import { ProductImage } from '../ProductImage';
import { artSvg } from './art';
import { FEMALE_LOOKS, LOOKS, MALE_LOOKS } from '@/lib/fair-characters';
import type { LookId } from '@/lib/fair-constants';
import { makerAvatar, visitorAvatar } from './avatar';
import { NOTE_MAX, type Note } from './profile';
import type { SelfiePose } from './engine';

/** A modal sheet on the native <dialog>: it traps focus, closes on Escape and hands focus back. */
export function Sheet({ labelId, onClose, children }: { labelId: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); return () => { if (d?.open) d.close(); }; }, []);
  return (
    <dialog ref={ref} className="fair-sheet" aria-labelledby={labelId} onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}>
      <div className="fair-sheet-body">
        <button type="button" className="icon-btn fair-x" aria-label="Close" onClick={onClose}>✕</button>
        {children}
      </div>
    </dialog>
  );
}

const Art = ({ item }: { item: FairItem }) => <span className="fair-art" dangerouslySetInnerHTML={{ __html: artSvg(item.art, item.color) }} />;
const ItemPicture = ({ item, real }: { item: FairItem; real: boolean }) => (real && item.imageUrl ? <ProductImage src={item.imageUrl} alt={item.name} fallback={<Art item={item} />} /> : <Art item={item} />);

export function StallSheet({ maker, real, shortlist, onAdd, onWatch, onOpenShortlist, onClose }: {
  maker: FairMaker; real: boolean; shortlist: Record<string, number>; onAdd: (item: FairItem) => void; onWatch: () => void; onOpenShortlist: () => void; onClose: () => void;
}) {
  const [said, setSaid] = useState(maker.greet);
  const total = Object.values(shortlist).reduce((a, b) => a + b, 0);
  return (
    <Sheet labelId="fair-stall-h" onClose={onClose}>
      <div className="fair-sheet-head">
        <span className="fair-avatar" dangerouslySetInnerHTML={{ __html: makerAvatar(maker.look) }} />
        <div>
          <h2 id="fair-stall-h">{maker.name}</h2>
          <p className="fair-meta">{maker.city} · {maker.category}{real && maker.href ? <> · <Link href={maker.href}>Artist page</Link></> : null}</p>
        </div>
      </div>
      <p className="fair-say">{said}</p>
      <ul className="fair-items">
        {maker.items.map(it => (
          <li key={it.key} className="fair-item">
            <div className="fair-item-pic"><ItemPicture item={it} real={real} />{shortlist[it.key] ? <span className="fair-qty-badge">×{shortlist[it.key]}</span> : null}</div>
            <h3>{it.name}</h3>
            <p className="fair-price">{money(it.pricePaise)}</p>
            <div className="fair-item-actions">
              <button type="button" className="button primary" onClick={() => { onAdd(it); setSaid(maker.thanks); }}>{shortlist[it.key] ? 'Add another' : 'Add to shortlist'}</button>
              {real && it.href ? <Link className="button" href={it.href}>View product</Link> : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="fair-sheet-foot">
        <button type="button" className="button" onClick={onWatch}>Watch {maker.name.split(' ')[0]} work</button>
        <button type="button" className="button" onClick={onOpenShortlist}>Shortlist{total ? ` (${total})` : ''}</button>
      </div>
    </Sheet>
  );
}

export function ShortlistSheet({ data, shortlist, onChange, onClose }: { data: FairData; shortlist: Record<string, number>; onChange: (key: string, delta: number) => void; onClose: () => void }) {
  const items = data.makers.flatMap(m => m.items.map(i => ({ item: i, maker: m }))), lines = items.filter(l => shortlist[l.item.key]);
  const total = lines.reduce((a, l) => a + l.item.pricePaise * shortlist[l.item.key], 0), real = data.source === 'real';
  return (
    <Sheet labelId="fair-list-h" onClose={onClose}>
      <h2 id="fair-list-h">Your shortlist</h2>
      {lines.length === 0 ? <p className="fair-empty">Nothing here yet. Walk up to a stall and add something.</p> : (
        <>
          <ul className="fair-lines">
            {lines.map(({ item, maker }) => (
              <li key={item.key}>
                <span className="fair-line-pic"><ItemPicture item={item} real={real} /></span>
                <div><b>{real && item.href ? <Link href={item.href}>{item.name}</Link> : item.name}</b><small>{maker.name} · {money(item.pricePaise)}</small></div>
                <div className="fair-stepper">
                  <button type="button" aria-label={`One less ${item.name}`} onClick={() => onChange(item.key, -1)}>−</button>
                  <output aria-label={`${shortlist[item.key]} of ${item.name}`}>{shortlist[item.key]}</output>
                  <button type="button" aria-label={`One more ${item.name}`} onClick={() => onChange(item.key, 1)}>+</button>
                </div>
              </li>
            ))}
          </ul>
          <p className="fair-total"><span>Total</span><span>{money(total)}</span></p>
        </>
      )}
      <p className="fair-note">{real ? 'This is a shortlist, not an order. Open a product to contact the maker and buy.' : 'These are sample items, so nothing can be ordered.'}</p>
      <div className="fair-sheet-foot"><button type="button" className="button primary" onClick={onClose}>Keep exploring</button></div>
    </Sheet>
  );
}

const ICONS = {
  cam: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  note: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v11l-5 5H5z" /><path d="M14 20v-5h5M8 9h8M8 12h5" /></svg>,
  ear: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 1 0 6" /><circle cx="12" cy="14" r="3" /><path d="M12 17v4" /></svg>,
};
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function MirrorSheet({ maker, view, setView, tryOn, onTry, wearables, onAdd, shortlist, notes, onNote, onSelfie, onShutter, paint, onClose }: {
  maker: FairMaker; view: 'menu' | 'selfie' | 'note'; setView: (v: 'menu' | 'selfie' | 'note') => void;
  tryOn: string | null; onTry: (key: string | null) => void; wearables: FairItem[]; onAdd: (item: FairItem) => void; shortlist: Record<string, number>;
  notes: Note[]; onNote: (text: string, rating: number) => Promise<string | null>; onSelfie: () => void; onShutter: () => void; paint: (cv: HTMLCanvasElement, pose: SelfiePose) => void; onClose: () => void;
}) {
  const [pose, setPose] = useState<SelfiePose>('smile'), [shot, setShot] = useState(0), [rating, setRating] = useState(0), [error, setError] = useState(''), [sending, setSending] = useState(false);
  const cv = useRef<HTMLCanvasElement>(null);
  const tried = wearables.find(e => e.key === tryOn);
  useEffect(() => { if (view === 'selfie' && cv.current) paint(cv.current, pose); }, [view, pose, shot, paint]);
  useEffect(() => { if (view === 'selfie') onSelfie(); }, [view, onSelfie]);
  useEffect(() => { if (view === 'selfie') onShutter(); }, [view, shot, onShutter]);
  return (
    <Sheet labelId="fair-mirror-h" onClose={onClose}>
      {view === 'menu' && (
        <>
          <h2 id="fair-mirror-h">The mirror</h2>
          <p className="fair-meta">{maker.name}, {maker.city}</p>
          <div className="fair-opts">
            <button type="button" className="fair-opt" onClick={() => setView('selfie')}>{ICONS.cam}<span><b>Take a mirror selfie</b><small>A photo of you with the fair behind you{tried ? `, wearing ${tried.name}` : ''}.</small></span></button>
            <button type="button" className="fair-opt" onClick={() => setView('note')}>{ICONS.note}<span><b>Leave a feedback note</b><small>Pin a note on the stall wall. {notes.length ? `${notes.length} pinned so far.` : 'Be the first.'}</small></span></button>
            {wearables.length > 0 && (
              <div className="fair-opt fair-opt-static">{ICONS.ear}<span><b>Try something on</b><small>Your reflection and your character wear it.</small>
                <span className="fair-seg" role="group" aria-label="Something to try on">
                  <button type="button" aria-pressed={!tryOn} onClick={() => onTry(null)}>None</button>
                  {wearables.map(e => <button key={e.key} type="button" aria-pressed={tryOn === e.key} onClick={() => onTry(e.key)}>{e.name}</button>)}
                </span>
                {tried && <button type="button" className="button primary" onClick={() => onAdd(tried)}>{shortlist[tried.key] ? 'Add another' : 'Add to shortlist'} · {money(tried.pricePaise)}</button>}
              </span></div>
            )}
          </div>
        </>
      )}
      {view === 'selfie' && (
        <>
          <h2 id="fair-mirror-h">Mirror selfie</h2>
          <div className="fair-selfie"><canvas ref={cv} aria-label="Your mirror selfie, with the fair reflected behind you" /><span key={shot} className="fair-flash" aria-hidden="true" /></div>
          <div className="fair-sheet-foot">
            <button type="button" className="button" onClick={() => setView('menu')}>Back</button>
            <span className="fair-acts"><button type="button" className="button" onClick={() => setPose(p => (p === 'smile' ? 'wave' : 'smile'))}>Change pose</button><button type="button" className="button primary" onClick={() => setShot(s => s + 1)}>Take another</button></span>
          </div>
          <p className="fair-note">Photos are not saved. Take a screenshot to keep this one.</p>
        </>
      )}
      {view === 'note' && (
        <>
          <h2 id="fair-mirror-h">Leave a feedback note</h2>
          <p className="fair-meta">It goes to the Craftofy team and gets pinned on the {maker.name} wall.</p>
          <form className="admin-form" noValidate onSubmit={async e => {
            e.preventDefault();
            if (sending) return;
            const text = String(new FormData(e.currentTarget).get('note') ?? '').trim();
            if (!text) { setError('Write a few words first, then send your note.'); return; }
            setError(''); setSending(true);
            const problem = await onNote(text, rating);
            setSending(false);
            if (problem) { setError(problem); return; }
            setRating(0); setView('menu');
          }}>
            <p className="form-note"><b>*</b> Required</p>
            <label><span className="lbl">Your note</span><textarea name="note" required maxLength={NOTE_MAX} rows={4} placeholder="What did you like? What would make the fair better?" /></label>
            <div className="fair-rate" role="group" aria-label="How was the fair, out of 5">
              {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" data-on={n <= rating ? '1' : '0'} aria-pressed={n === rating} aria-label={`${n} out of 5`} onClick={() => setRating(r => (r === n ? 0 : n))}>★</button>)}
            </div>
            {error && <p role="alert" className="admin-error">{error}</p>}
            <div className="fair-sheet-foot"><button type="button" className="button" onClick={() => setView('menu')}>Back</button><button type="submit" className="button primary" disabled={sending} aria-busy={sending}>Send my note</button></div>
          </form>
          <p className="fair-note">Your note is sent with your visitor code only, never your name. Please leave out personal details.</p>
          {notes.length > 0 && <ul className="fair-notes" aria-label="Your pinned notes">{notes.slice(-3).reverse().map(n => <li key={n.t + n.text}>{n.rating ? <span aria-label={`${n.rating} out of 5`}>{stars(n.rating)} </span> : null}{n.text}</li>)}</ul>}
        </>
      )}
    </Sheet>
  );
}

/** "My look": five female and five male characters to choose from. */
export function LookSheet({ current, startsWith, onPick, onClose }: { current: LookId; startsWith: LookId; onPick: (id: LookId | null) => void; onClose: () => void }) {
  const group = (title: string, ids: readonly LookId[]) => (
    <fieldset className="fair-looks-group">
      <legend>{title}</legend>
      <div className="fair-looks">
        {ids.map(id => (
          <button key={id} type="button" className="fair-look" aria-pressed={id === current} onClick={() => onPick(id)}>
            <span className="fair-avatar" dangerouslySetInnerHTML={{ __html: visitorAvatar(LOOKS[id]) }} />
            <span>{LOOKS[id].name}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
  return (
    <Sheet labelId="fair-look-h" onClose={onClose}>
      <h2 id="fair-look-h">My look</h2>
      <p className="fair-meta">Pick the character you walk the fair as. Other visitors see it too.</p>
      {group('Female', FEMALE_LOOKS)}
      {group('Male', MALE_LOOKS)}
      <div className="fair-sheet-foot">
        {current !== startsWith ? <button type="button" className="button" onClick={() => onPick(null)}>Back to my starting look</button> : <span />}
        <button type="button" className="button primary" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}
