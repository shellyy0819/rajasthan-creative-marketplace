import { useCallback, useEffect, useRef, useState } from 'react';
import { RichTextField } from './RichTextField';
import { LanguageSelect } from './LanguageSelect';
import { CityInput } from './CityInput';
import { instagramUrl } from '@/lib/social';
import { PHONE_HINT, PHONE_PATTERN } from '@/lib/phone';

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** The message for one field, right under it. */
export function FieldError({ errors, name }: { errors?: Record<string, string>; name: string }) {
  const m = errors?.[name];
  return m ? <small className="field-error" id={`err-${name}`} role="alert">{m}</small> : null;
}

export const DAY_OPTIONS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']] as const;
export const WEEK_OPTIONS = [['1', '1st'], ['2', '2nd'], ['3', '3rd'], ['4', '4th'], ['last', 'Last']] as const;
export const PRICE_PLAN_LIMIT = 5;
export const DURATION_ERROR = 'The class must last between 15 minutes and 8 hours.';
/** Minutes from what was typed and the unit chosen (hours may be fractional: 1.5 hours is 90 minutes). NaN when nothing sensible was typed. */
export function durationMinutes(value: string, unit: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * (unit === 'hours' ? 60 : 1)) : Number.NaN;
}
export const durationValid = (minutes: number) => Number.isInteger(minutes) && minutes >= 15 && minutes <= 480;
export type PriceDraft = { label: string; amount: string; sessions: string };
export const BLANK_PRICE: PriceDraft = { label: '', amount: '', sessions: '' };
export const PRICE_ROW_ERROR = 'Fill in both the name and the price for each price plan, or remove the empty one.';
/** A price plan row nobody has typed into: it is ignored, so a class with only that row is free. */
export const isBlankPrice = (r: PriceDraft) => !r.label.trim() && !r.amount.trim() && !r.sessions.trim();
export const activePriceRows = (rows: PriceDraft[]) => rows.filter(r => !isBlankPrice(r));
/** Is some plan half filled (a name without a price, or a price without a name)? */
export const priceRowsIncomplete = (rows: PriceDraft[]) => activePriceRows(rows).some(r => !r.label.trim() || !r.amount.trim());

/** Instagram handle or link, with a link that opens the profile in a new tab (reads the field when clicked, so pre-filled values work). */
export function InstagramField({ errors }: { errors?: Record<string, string> }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="host-instagram">
      <label>Instagram<input ref={input} name="instagram" maxLength={200} placeholder="@yourstudio" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" /><FieldError errors={errors} name="instagram" /></label>
      <a className="host-open-link" href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer"
        onClick={e => {
          const v = input.current?.value.trim();
          if (!v) { e.preventDefault(); input.current?.focus(); return; }
          e.currentTarget.href = instagramUrl(v);
        }}>Open on Instagram <span aria-hidden="true">↗</span></a>
    </div>
  );
}

/** Step 2 of an in-person event: when, where, seats and the single price. */
export function EventWhereWhen({ startDate, setStartDate, paid, setPaid, cityRequired = true, cityDefault, errors }: { errors?: Record<string, string>; startDate: string; setStartDate: (v: string) => void; paid: boolean; setPaid: (v: boolean) => void; cityRequired?: boolean; cityDefault?: { id: number; label: string } }) {
  return (
    <>
      <div className="admin-form-row">
        <label><span className="lbl">Start date</span><input name="startDate" type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} /><FieldError errors={errors} name="startDate" /></label>
        <label>End date<input name="endDate" type="date" min={startDate || undefined} /><FieldError errors={errors} name="endDate" /></label>
      </div>
      <p className="form-note">{startDate ? `If you leave the end date empty, the event ends on ${fmtDate(startDate)}, the start date.` : 'If you leave the end date empty, the event ends on the start date.'}</p>
      <div className="admin-form-row">
        <label>Start time<input name="startTime" type="time" /><FieldError errors={errors} name="startTime" /></label>
        <label>End time<input name="endTime" type="time" /><FieldError errors={errors} name="endTime" /></label>
      </div>
      <div className="admin-form-row">
        <label><span className="lbl">City</span><CityInput required={cityRequired} valueFormat="name" defaultCity={cityDefault} /></label>
        <label>Seats<input name="seats" type="number" min={1} max={100000} inputMode="numeric" /><FieldError errors={errors} name="seats" /></label>
      </div>
      <label><span className="lbl">Venue and address</span><input name="venue" required maxLength={300} autoComplete="street-address" autoCapitalize="words" enterKeyHint="next" /><FieldError errors={errors} name="venue" /></label>
      <label>Price
        <select name="entry" value={paid ? 'paid' : 'free'} onChange={e => setPaid(e.target.value === 'paid')}><option value="free">Free</option><option value="paid">Paid</option></select>
      </label>
      {paid && <label><span className="lbl">Price per person (Rs.)</span><input name="priceRupees" type="number" min={1} max={1000000} inputMode="numeric" required /><FieldError errors={errors} name="priceRupees" /></label>}
    </>
  );
}

/** Step 2 of an online class: platform, dates, class days, time, duration, price plans and the free trial. */
export function ClassWhenAndPrice({ startDate, setStartDate, rows, setRows, repeat, setRepeat, errors }: { errors?: Record<string, string>; startDate: string; setStartDate: (v: string) => void; rows: PriceDraft[]; setRows: (r: PriceDraft[]) => void; repeat: 'weekly' | 'monthly'; setRepeat: (v: 'weekly' | 'monthly') => void }) {
  const patch = (i: number, p: Partial<PriceDraft>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const [endsOn, setEndsOn] = useState('');
  // Start and end on the same day (or no end date, which means the same day): one class, so nothing repeats.
  const oneDay = !!startDate && (!endsOn || endsOn === startDate);
  // Drafts and edited listings fill the box from outside and fire `rr-sync`; follow them (and a value already there).
  const unsync = useRef<() => void>(() => {});
  const endsOnRef = useCallback((el: HTMLInputElement | null) => {
    unsync.current();
    if (!el) return;
    const read = () => setEndsOn(el.value);
    el.addEventListener('rr-sync', read);
    unsync.current = () => el.removeEventListener('rr-sync', read);
    if (el.value) read();
  }, []);
  // One class: nothing repeats, so a leftover "every month" choice must not demand weeks nobody can see.
  useEffect(() => { if (oneDay && repeat !== 'weekly') setRepeat('weekly'); }, [oneDay, repeat, setRepeat]);
  return (
    <>
      <label><span className="lbl">Online platform</span><input name="platform" list="host-platforms" required maxLength={60} placeholder="Zoom, Google Meet…" autoCapitalize="words" enterKeyHint="next" /><FieldError errors={errors} name="platform" /></label>
      <datalist id="host-platforms"><option value="Zoom" /><option value="Google Meet" /><option value="Microsoft Teams" /></datalist>
      <label>Meeting link (optional)<input name="joinLink" type="url" inputMode="url" maxLength={500} placeholder="https://zoom.us/j/…" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" /><FieldError errors={errors} name="joinLink" /></label>
      <p className="form-note">Private: only our team sees it. It is never shown on the website.</p>
      <div className="admin-form-row">
        <label><span className="lbl">Start date</span><input name="startDate" type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} /><FieldError errors={errors} name="startDate" /></label>
        <label>End date<input name="endsOn" type="date" min={startDate || undefined} ref={endsOnRef} onChange={e => setEndsOn(e.target.value)} /><FieldError errors={errors} name="endsOn" /></label>
      </div>
      <p className="form-note">{startDate ? `If you leave the end date empty, the classes end on ${fmtDate(startDate)}, the start date.` : 'If you leave the end date empty, the classes end on the start date.'}</p>
      {!oneDay && <label>Repeats
        <select name="repeat" value={repeat} onChange={e => setRepeat(e.target.value === 'monthly' ? 'monthly' : 'weekly')}><option value="weekly">Every week</option><option value="monthly">Every month</option></select>
      </label>}
      {!oneDay && repeat === 'monthly' && (
        <fieldset className="host-days">
          <legend>Which weeks of the month</legend>
          {/* Every week ticked is the same as "Every week": switch to it so the schedule stays simple. */}
          <div className="host-day-chips" onChange={e => { const box = e.currentTarget.querySelectorAll<HTMLInputElement>('input[name="weeks"]'); if (box.length && Array.from(box).every(b => b.checked)) setRepeat('weekly'); }}>
            {WEEK_OPTIONS.map(([v, l]) => <label key={v} className="host-day"><input type="checkbox" name="weeks" value={v} /> {l}</label>)}
            <button type="button" className="host-day host-all-weeks" onClick={() => setRepeat('weekly')}>All weeks</button>
          </div>
          <FieldError errors={errors} name="weeks" />
        </fieldset>
      )}
      <fieldset className="host-days">
        <legend>Class days</legend>
        <div className="host-day-chips">{DAY_OPTIONS.map(([v, l]) => <label key={v} className="host-day"><input type="checkbox" name="days" value={v} /> {l}</label>)}</div>
        <FieldError errors={errors} name="days" />
      </fieldset>
      <div className="admin-form-row">
        <label><span className="lbl">Class time</span><input name="classTime" type="time" required /><FieldError errors={errors} name="classTime" /></label>
        <div className="host-duration">
          <label><span className="lbl">Duration</span><input name="durationValue" type="number" inputMode="decimal" min="0.25" step="any" required defaultValue="60" enterKeyHint="next" /><FieldError errors={errors} name="durationValue" /></label>
          <select name="durationUnit" aria-label="Minutes or hours" defaultValue="mins"><option value="mins">mins</option><option value="hours">hours</option></select>
        </div>
      </div>
      <fieldset className="host-prices" data-field="prices">
        <legend>Price plans</legend>
        {rows.length === 0 && <p className="form-note">No price plans means the class is free.</p>}
        <datalist id="host-plan-names"><option value="Per session" /><option value="Monthly" /><option value="Quarterly" /></datalist>
        {rows.map((r, i) => (
          <div key={i} className="host-price-row">
            <input aria-label={`Plan ${i + 1} name`} list="host-plan-names" maxLength={30} placeholder="Monthly" value={r.label} onChange={e => patch(i, { label: e.target.value })} />
            <input aria-label={`Plan ${i + 1} price (Rs.)`} type="number" min={0} max={100000} inputMode="numeric" placeholder="Rs." value={r.amount} onChange={e => patch(i, { amount: e.target.value })} />
            <input aria-label={`Plan ${i + 1} sessions`} type="number" min={1} max={1000} inputMode="numeric" placeholder="Sessions" value={r.sessions} onChange={e => patch(i, { sessions: e.target.value })} />
            <button type="button" className="icon-btn" aria-label={`Remove plan ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <FieldError errors={errors} name="prices" />
        <button type="button" className="button" disabled={rows.length >= PRICE_PLAN_LIMIT} onClick={() => setRows([...rows, { ...BLANK_PRICE }])}>Add new price details</button>
      </fieldset>
      <label>Free trial length in days (optional)<input name="freeTrialDays" type="number" min={1} max={365} inputMode="numeric" placeholder="e.g. 7" enterKeyHint="next" /><FieldError errors={errors} name="freeTrialDays" /></label>
    </>
  );
}

const MAKE_ROWS = 3;
/**
 * The optional questions an in-person workshop asks on the last step, for craft and art workshops: who it is for, what people make,
 * what is included, what to bring. Read back with `craftFields`.
 */
export function EventAbout({ errors }: { errors?: Record<string, string> }) {
  return (
    <fieldset className="host-craft">
      <legend>About the workshop (optional)</legend>
      <LanguageSelect error={errors?.languages} />
      <div className="admin-form-row">
        <label>Level
          <select name="level" defaultValue="">
            <option value="">Not specified</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="all">All levels</option>
          </select>
          <FieldError errors={errors} name="level" />
        </label>
        <label>Minimum age<input name="minAge" type="number" min={1} max={99} inputMode="numeric" placeholder="Example: 14" /><FieldError errors={errors} name="minAge" /></label>
      </div>
      <div className="host-makes" data-field="makes">
        <span className="lbl">What people will make (up to 3)</span>
        {Array.from({ length: MAKE_ROWS }, (_, i) => (
          <div key={i} className="host-make-row">
            <input name={`makeTitle${i + 1}`} aria-label={`Item ${i + 1} title`} maxLength={60} placeholder={i === 0 ? 'Example: A cotton tote bag' : 'Title'} />
            <input name={`makeText${i + 1}`} aria-label={`Item ${i + 1} short line`} maxLength={120} placeholder="One short line (optional)" />
          </div>
        ))}
        <FieldError errors={errors} name="makes" />
      </div>
      <label>What is included (one per line, up to 6)<textarea name="included" rows={3} maxLength={500} placeholder={'Blocks and dyes\nMasala chai'} /><FieldError errors={errors} name="included" /></label>
      <label>What to bring (one per line, up to 6)<textarea name="bring" rows={2} maxLength={500} placeholder="Old clothes you do not mind staining" /><FieldError errors={errors} name="bring" /></label>
    </fieldset>
  );
}

/** Reads the `EventAbout` fields from a submitted form into what the API takes. Empty fields are left out or empty. */
export function craftFields(f: FormData) {
  const get = (k: string) => String(f.get(k) ?? '').trim();
  const makes = Array.from({ length: MAKE_ROWS }, (_, i) => ({ title: get(`makeTitle${i + 1}`), text: get(`makeText${i + 1}`) }))
    .filter(m => m.title || m.text);
  return {
    makes,
    included: get('included').split('\n').map(x => x.trim()).filter(Boolean),
    bring: get('bring').split('\n').map(x => x.trim()).filter(Boolean),
    minAge: get('minAge') ? Number(get('minAge')) : null,
    level: get('level') || null,
    languages: get('languages').split(',').map(x => x.trim()).filter(Boolean),
  };
}

/** The extra questions an online class asks on the last step. */
export function ClassAbout({ errors }: { errors?: Record<string, string> }) {
  return (
    <>
      <LanguageSelect error={errors?.languages} />
      <label>Level
        <select name="level" defaultValue="">
          <option value="">Not specified</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="all">All levels</option>
        </select>
        <FieldError errors={errors} name="level" />
      </label>
      <RichTextField name="experience" label="Experience" error={errors?.experience} /><FieldError errors={errors} name="experience" />
      <RichTextField name="certifications" label="Certifications" error={errors?.certifications} /><FieldError errors={errors} name="certifications" />
      <label>WhatsApp number<input name="whatsapp" type="tel" inputMode="tel" maxLength={40} pattern={PHONE_PATTERN} title={PHONE_HINT} placeholder="Example: 9999999999" autoComplete="tel" enterKeyHint="next" /><FieldError errors={errors} name="whatsapp" /></label>
    </>
  );
}
