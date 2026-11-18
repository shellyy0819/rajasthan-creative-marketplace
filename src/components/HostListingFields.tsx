import { CityInput } from './CityInput';
import { PHONE_HINT, PHONE_PATTERN } from '@/lib/phone';

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const DAY_OPTIONS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']] as const;
export const PRICE_PLAN_LIMIT = 5;
export type PriceDraft = { label: string; amount: string; sessions: string };

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
      <label><span className="lbl">Venue and address</span><input name="venue" required maxLength={300} autoComplete="street-address" /></label>
      <label className="check"><input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} /> Participants pay to attend</label>
      {paid && <label><span className="lbl">Price per person (Rs.)</span><input name="priceRupees" type="number" min={1} max={1000000} inputMode="numeric" required /></label>}
    </>
  );
}

/** Step 2 of an online class: platform, dates, class days, time, duration, price plans and the free trial. */
export function ClassWhenAndPrice({ startDate, setStartDate, rows, setRows }: { startDate: string; setStartDate: (v: string) => void; rows: PriceDraft[]; setRows: (r: PriceDraft[]) => void }) {
  const patch = (i: number, p: Partial<PriceDraft>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <>
      <label><span className="lbl">Online platform</span><input name="platform" list="host-platforms" required maxLength={60} placeholder="Zoom, Google Meet…" /></label>
      <datalist id="host-platforms"><option value="Zoom" /><option value="Google Meet" /><option value="Microsoft Teams" /></datalist>
      <div className="admin-form-row">
        <label><span className="lbl">Start date</span><input name="startDate" type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
        <label>End date<input name="endsOn" type="date" min={startDate || undefined} /></label>
      </div>
      <p className="form-note">Leave the end date empty if the classes run until further notice.</p>
      <fieldset className="host-days">
        <legend>Class days</legend>
        <div className="host-day-chips">{DAY_OPTIONS.map(([v, l]) => <label key={v} className="host-day"><input type="checkbox" name="days" value={v} /> {l}</label>)}</div>
      </fieldset>
      <div className="admin-form-row">
        <label><span className="lbl">Class time</span><input name="classTime" type="time" required /></label>
        <label><span className="lbl">Duration</span>
          <select name="duration" defaultValue="60">{[30, 45, 60, 75, 90, 120].map(m => <option key={m} value={m}>{m} minutes</option>)}</select>
        </label>
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
    </>
  );
}

/** The extra questions an online class asks on the last step. */
export function ClassAbout() {
  return (
    <>
      <label>Languages<input name="languages" maxLength={160} placeholder="Hindi, English" /></label>
      <label>Level
        <select name="level" defaultValue="">
          <option value="">Not specified</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="all">All levels</option>
        </select>
      </label>
      <label>Experience<textarea name="experience" maxLength={500} rows={2} /></label>
      <label>Certifications<textarea name="certifications" maxLength={500} rows={2} /></label>
      <label>WhatsApp number<input name="whatsapp" type="tel" inputMode="tel" maxLength={40} pattern={PHONE_PATTERN} title={PHONE_HINT} placeholder="9989898999" /></label>
    </>
  );
}
