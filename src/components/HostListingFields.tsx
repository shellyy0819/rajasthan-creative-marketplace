import { useRef } from 'react';
import { CityInput } from './CityInput';
import { instagramUrl } from '@/lib/social';
import { PHONE_HINT, PHONE_PATTERN } from '@/lib/phone';

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

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

/** Instagram handle or link, with a link that opens the profile in a new tab (reads the field when clicked, so pre-filled values work). */
export function InstagramField() {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="host-instagram">
      <label>Instagram<input ref={input} name="instagram" maxLength={200} placeholder="@yourstudio" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" /></label>
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
export function EventWhereWhen({ startDate, setStartDate, paid, setPaid, cityRequired = true, cityDefault }: { startDate: string; setStartDate: (v: string) => void; paid: boolean; setPaid: (v: boolean) => void; cityRequired?: boolean; cityDefault?: { id: number; label: string } }) {
  return (
    <>
      <div className="admin-form-row">
        <label><span className="lbl">Start date</span><input name="startDate" type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
        <label>End date<input name="endDate" type="date" min={startDate || undefined} /></label>
      </div>
      <p className="form-note">{startDate ? `If you leave the end date empty, the event ends on ${fmtDate(startDate)}, the start date.` : 'If you leave the end date empty, the event ends on the start date.'}</p>
      <div className="admin-form-row">
        <label>Start time<input name="startTime" type="time" /></label>
        <label>End time<input name="endTime" type="time" /></label>
      </div>
      <div className="admin-form-row">
        <label><span className="lbl">City</span><CityInput required={cityRequired} valueFormat="name" defaultCity={cityDefault} /></label>
        <label>Seats<input name="seats" type="number" min={1} max={100000} inputMode="numeric" /></label>
      </div>
      <label><span className="lbl">Venue and address</span><input name="venue" required maxLength={300} autoComplete="street-address" autoCapitalize="words" enterKeyHint="next" /></label>
      <label>Price
        <select name="entry" value={paid ? 'paid' : 'free'} onChange={e => setPaid(e.target.value === 'paid')}><option value="free">Free</option><option value="paid">Paid</option></select>
      </label>
      {paid && <label><span className="lbl">Price per person (Rs.)</span><input name="priceRupees" type="number" min={1} max={1000000} inputMode="numeric" required /></label>}
    </>
  );
}

/** Step 2 of an online class: platform, dates, class days, time, duration, price plans and the free trial. */
export function ClassWhenAndPrice({ startDate, setStartDate, rows, setRows, repeat, setRepeat }: { startDate: string; setStartDate: (v: string) => void; rows: PriceDraft[]; setRows: (r: PriceDraft[]) => void; repeat: 'weekly' | 'monthly'; setRepeat: (v: 'weekly' | 'monthly') => void }) {
  const patch = (i: number, p: Partial<PriceDraft>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <>
      <label><span className="lbl">Online platform</span><input name="platform" list="host-platforms" required maxLength={60} placeholder="Zoom, Google Meet…" autoCapitalize="words" enterKeyHint="next" /></label>
      <datalist id="host-platforms"><option value="Zoom" /><option value="Google Meet" /><option value="Microsoft Teams" /></datalist>
      <label>Meeting link (optional)<input name="joinLink" type="url" inputMode="url" maxLength={500} placeholder="https://zoom.us/j/…" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" /></label>
      <p className="form-note">Private: only our team sees it. It is never shown on the website.</p>
      <div className="admin-form-row">
        <label><span className="lbl">Start date</span><input name="startDate" type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
        <label>End date<input name="endsOn" type="date" min={startDate || undefined} /></label>
      </div>
      <p className="form-note">Leave the end date empty if the classes run until further notice.</p>
      <label>Repeats
        <select name="repeat" value={repeat} onChange={e => setRepeat(e.target.value === 'monthly' ? 'monthly' : 'weekly')}><option value="weekly">Every week</option><option value="monthly">Every month</option></select>
      </label>
      {repeat === 'monthly' && (
        <fieldset className="host-days">
          <legend>Which weeks of the month</legend>
          <div className="host-day-chips">{WEEK_OPTIONS.map(([v, l]) => <label key={v} className="host-day"><input type="checkbox" name="weeks" value={v} /> {l}</label>)}</div>
        </fieldset>
      )}
      <fieldset className="host-days">
        <legend>Class days</legend>
        <div className="host-day-chips">{DAY_OPTIONS.map(([v, l]) => <label key={v} className="host-day"><input type="checkbox" name="days" value={v} /> {l}</label>)}</div>
      </fieldset>
      <div className="admin-form-row">
        <label><span className="lbl">Class time</span><input name="classTime" type="time" required /></label>
        <div className="host-duration">
          <label><span className="lbl">Duration</span><input name="durationValue" type="number" inputMode="decimal" min="0.25" step="any" required defaultValue="60" enterKeyHint="next" /></label>
          <select name="durationUnit" aria-label="Minutes or hours" defaultValue="mins"><option value="mins">mins</option><option value="hours">hours</option></select>
        </div>
      </div>
      <fieldset className="host-prices">
        <legend>Price plans</legend>
        {rows.length === 0 && <p className="form-note">No price plans means the class is free.</p>}
        <datalist id="host-plan-names"><option value="Per session" /><option value="Monthly" /><option value="Quarterly" /></datalist>
        {rows.map((r, i) => (
          <div key={i} className="host-price-row">
            <input aria-label={`Plan ${i + 1} name`} list="host-plan-names" required maxLength={30} placeholder="Monthly" value={r.label} onChange={e => patch(i, { label: e.target.value })} />
            <input aria-label={`Plan ${i + 1} price (Rs.)`} type="number" min={0} max={100000} inputMode="numeric" required placeholder="Rs." value={r.amount} onChange={e => patch(i, { amount: e.target.value })} />
            <input aria-label={`Plan ${i + 1} sessions`} type="number" min={1} max={1000} inputMode="numeric" placeholder="Sessions" value={r.sessions} onChange={e => patch(i, { sessions: e.target.value })} />
            <button type="button" className="icon-btn" aria-label={`Remove plan ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="button" disabled={rows.length >= PRICE_PLAN_LIMIT} onClick={() => setRows([...rows, { label: '', amount: '', sessions: '' }])}>Add a price plan</button>
      </fieldset>
      <label className="check"><input type="checkbox" name="freeTrial" /> Offers a free trial class</label>
      <label>Free trial length in days (optional)<input name="freeTrialDays" type="number" min={1} max={365} inputMode="numeric" placeholder="e.g. 7" enterKeyHint="next" /></label>
    </>
  );
}

/** The extra questions an online class asks on the last step. */
export function ClassAbout() {
  return (
    <>
      <label>Languages<input name="languages" maxLength={160} placeholder="Hindi, English" autoCapitalize="words" enterKeyHint="next" /></label>
      <label>Level
        <select name="level" defaultValue="">
          <option value="">Not specified</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="all">All levels</option>
        </select>
      </label>
      <label>Experience<textarea name="experience" maxLength={500} rows={2} /></label>
      <label>Certifications<textarea name="certifications" maxLength={500} rows={2} /></label>
      <label>WhatsApp number<input name="whatsapp" type="tel" inputMode="tel" maxLength={40} pattern={PHONE_PATTERN} title={PHONE_HINT} placeholder="9989898999" autoComplete="tel" enterKeyHint="next" /></label>
    </>
  );
}
