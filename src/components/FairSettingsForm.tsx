'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast, type ToastState } from './Toast';
import type { FairSettings } from '@/lib/fair-settings';
import type { FairSource } from '@/lib/fair-types';
import { DEFAULT_MELA, type MelaSchedule } from '@/lib/fair-mela';

/** The five dates as the form holds them, so they can be typed and edited one at a time. */
type Dates = { t0: string; t1: string; c0: string; c1: string; p: string };
const toDates = (m: MelaSchedule | null): Dates => { const d = m ?? DEFAULT_MELA; return { t0: d.trade[0], t1: d.trade[1], c0: d.culture[0], c1: d.culture[1], p: d.purnima }; };
const toSchedule = (d: Dates): MelaSchedule => ({ trade: [d.t0, d.t1], culture: [d.c0, d.c1], purnima: d.p });

const HELP: Record<FairSource, string> = {
  sample: 'The fair shows invented makers and products, clearly labelled as samples. Nothing links to a real shop.',
  real: 'The fair shows up to 8 sellers who have approved products right now, and their real products link to the product pages. Sellers with the most products come first.',
};

/** Admin switch for the exhibition (/fair): invented sample makers, or live sellers from the marketplace. */
export function FairSettingsForm({ initial }: { initial: FairSettings }) {
  const [saved, setSaved] = useState<FairSource>(initial.source);
  const [source, setSource] = useState<FairSource>(initial.source);
  const [savedOpen, setSavedOpen] = useState(initial.enabled);
  const [open, setOpen] = useState(initial.enabled);
  const [melaOn, setMelaOn] = useState(initial.mela !== null);
  const [dates, setDates] = useState<Dates>(toDates(initial.mela));
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const closeToast = useCallback(() => setToast(null), []);

  return (
    <div className="admin-grid admin-grid-solo">
      <Toast toast={toast} onClose={closeToast} />
      <section className="settings-card" aria-labelledby="fair-h">
        <h2 id="fair-h">Exhibition</h2>
        <p className="settings-lead">The walk-around fair at /fair. Open or close it for everyone, and choose which makers its stalls show.</p>
        <form className="admin-form" onSubmit={async e => {
          e.preventDefault();
          if (busy) return;
          setBusy(true); setError('');
          try {
            const r = await fetch('/api/admin/settings/fair', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: open, source, mela: melaOn ? toSchedule(dates) : null }) });
            const data = await r.json().catch(() => null);
            if (!r.ok) { setError((data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.'); return; }
            setSaved((data as FairSettings).source); setSavedOpen((data as FairSettings).enabled);
            setMelaOn((data as FairSettings).mela !== null); setDates(toDates((data as FairSettings).mela));
            router.refresh(); // re-render the server layout so the header's Fair link follows the new setting
            setToast({ id: Date.now() + Math.random(), kind: 'success', text: 'Exhibition settings saved.' });
          } catch { setError('Network error. Please try again.'); }
          finally { setBusy(false); }
        }}>
          <p className="form-note">{savedOpen ? `The fair is open, showing ${saved === 'real' ? 'live sellers' : 'sample makers'}. ${HELP[saved]}` : 'The fair is closed. /fair shows a closed notice, the Fair link is hidden from the header, and the sitemap and llms.txt leave it out.'}</p>
          {error && <p role="alert" className="admin-error">{error}</p>}
          <label><span className="lbl">Exhibition</span>
            <select name="enabled" value={open ? 'open' : 'closed'} onChange={e => setOpen(e.target.value === 'open')}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
            <small>{open ? 'Visitors can walk the fair at /fair.' : 'Visitors see a closed notice. Nothing is saved for visitors while it is closed; their codes and quest history are kept for when it opens again.'}</small>
          </label>
          <label><span className="lbl">Makers shown in the fair</span>
            <select name="source" value={source} onChange={e => setSource(e.target.value as FairSource)}>
              <option value="sample">Sample makers (invented)</option>
              <option value="real">Live sellers from the marketplace</option>
            </select>
            <small>{HELP[source]}</small>
          </label>
          <fieldset>
            <legend>Pushkar Camel Fair week</legend>
            <label><span className="lbl">Show the Pushkar week in the fair</span>
              <select name="mela" value={melaOn ? 'on' : 'off'} onChange={e => setMelaOn(e.target.value === 'on')}>
                <option value="on">On, on the dates below</option>
                <option value="off">Off</option>
              </select>
              <small>The fair dresses for the real Pushkar Camel Fair: camels on the lanes for the trading days, Pushkar Lake on Kartik Purnima, and quests to match. The dates change every year (they follow the lunar calendar), so set this year&apos;s here, and check them against the official Pushkar fair announcement. Turn it off if the dates are not known yet.</small>
            </label>
            {melaOn && (
              <>
                <label><span className="lbl">Livestock trading: first day</span><input type="date" name="t0" value={dates.t0} onChange={e => setDates({ ...dates, t0: e.target.value })} required /></label>
                <label><span className="lbl">Livestock trading: last day</span><input type="date" name="t1" value={dates.t1} onChange={e => setDates({ ...dates, t1: e.target.value })} required /></label>
                <label><span className="lbl">Cultural events: first day</span><input type="date" name="c0" value={dates.c0} onChange={e => setDates({ ...dates, c0: e.target.value })} required /></label>
                <label><span className="lbl">Cultural events: last day</span><input type="date" name="c1" value={dates.c1} onChange={e => setDates({ ...dates, c1: e.target.value })} required /></label>
                <label><span className="lbl">Kartik Purnima (the holy bath)</span><input type="date" name="p" value={dates.p} onChange={e => setDates({ ...dates, p: e.target.value })} required /><small>Each part must come after the one before it.</small></label>
              </>
            )}
          </fieldset>
          <div className="admin-actions">
            <button type="submit" className="button primary" disabled={busy} aria-busy={busy}>Save</button>
          </div>
        </form>
      </section>
    </div>
  );
}
