'use client';
import { useEffect, useRef, useState } from 'react';
import { ImageUploader } from './ImageUploader';
import { ClassAbout, ClassWhenAndPrice, DURATION_ERROR, durationMinutes, durationValid, EventWhereWhen, type PriceDraft } from './HostListingFields';
import { PHONE_HINT, PHONE_PATTERN } from '@/lib/phone';
import { MAX_REQUEST_IMAGES } from '@/lib/workshop-requests-shared';
import type { HostPath } from '@/lib/host-link';
import type { TopicOption } from '@/lib/topics';
import type { Workshop } from '@/lib/types';
import type { WorkshopRequest } from '@/lib/workshop-requests';

const field = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const rupees = (paise: number) => String(paise / 100);

type Defaults = { path: HostPath; startDate: string; paid: boolean; priceRows: PriceDraft[]; days: string[]; weeks: string[]; repeat: 'weekly' | 'monthly'; freeTrial: boolean; images: string[]; values: Record<string, string> };

/** What the form starts with: an existing listing (edit), a request (create from it), or nothing. */
function defaultsFor(src: Workshop | WorkshopRequest | undefined): Defaults {
  const empty: Defaults = { path: 'event', startDate: '', paid: false, priceRows: [], days: [], weeks: [], repeat: 'weekly', freeTrial: false, images: [], values: { status: 'DRAFT' } };
  if (!src) return empty;
  const isRequest = 'hostName' in src;
  const online = src.mode === 'online' || src.kind === 'class';
  const prices = src.prices.map(r => ({ label: r.label, amount: rupees(r.amountPaise), sessions: r.sessions ? String(r.sessions) : '' }));
  const paid = !online && (isRequest ? src.priceType === 'PAID' : src.type === 'PAID');
  const paise = isRequest ? src.pricePaise : src.pricePaise;
  const repeat = src.schedule?.repeat === 'monthly' ? 'monthly' as const : 'weekly' as const;
  const weeks = (src.schedule?.weeks ?? []).map(String);
  const v: Record<string, string> = {
    status: isRequest ? 'DRAFT' : src.status, title: src.title, description: src.description, topicId: src.topicId ? String(src.topicId) : '', kind: src.kind === 'class' ? '' : src.kind,
    platform: src.platform ?? '', endsOn: src.endsOn ?? '', languages: src.languages.join(', '), level: src.level ?? '', experience: src.experience ?? '', certifications: src.certifications ?? '',
    whatsapp: src.whatsapp ?? '', instagram: src.instagram ?? '', website: src.website ?? '',
    classTime: src.schedule?.time ?? '', ...(src.schedule && src.schedule.durationMin >= 60 && src.schedule.durationMin % 60 === 0 ? { durationValue: String(src.schedule.durationMin / 60), durationUnit: 'hours' } : { durationValue: src.schedule ? String(src.schedule.durationMin) : '60', durationUnit: 'mins' }),
    priceRupees: paid && paise ? rupees(paise) : '',
  };
  if (isRequest) {
    Object.assign(v, { hostName: src.hostName, contactName: src.contactName, contactPhone: src.phone, contactEmail: src.email, venue: src.venue, seats: src.seats ? String(src.seats) : '', startTime: src.startTime ?? '', endTime: src.endTime ?? '', endDate: src.endDate !== src.startDate ? src.endDate : '' });
    return { path: online ? 'class' : 'event', startDate: src.startDate, paid, priceRows: prices, days: src.schedule?.days ?? [], weeks, repeat, freeTrial: src.freeTrial, images: src.images, values: v };
  }
  Object.assign(v, { hostName: src.host, contactName: src.contactName ?? '', contactPhone: src.contactPhone ?? '', contactEmail: src.contactEmail ?? '', venue: src.venue ?? '', seats: src.seats ? String(src.seats) : '', startTime: online ? '' : src.time, endDate: !online && src.endsOn ? src.endsOn : '' });
  return { path: online ? 'class' : 'event', startDate: src.date, paid, priceRows: prices, days: src.schedule?.days ?? [], weeks, repeat, freeTrial: src.freeTrial, images: src.images, values: v };
}

/**
 * The admin's listing form: the same fields and limits as the public host form, on one page. An admin adds a listing for a host,
 * edits one, or creates one from a request. Nothing here is emailed or rate limited; the listing is a Draft until the admin publishes it.
 */
export function ListingForm({ topics, workshop, fromRequest, onSaved, onClose }: { topics: TopicOption[]; workshop?: Workshop; fromRequest?: WorkshopRequest; onSaved: (w: Workshop) => void; onClose: () => void }) {
  const d = useRef(defaultsFor(workshop ?? fromRequest)).current;
  const [path, setPath] = useState<HostPath>(d.path);
  const [startDate, setStartDate] = useState(d.startDate);
  const [paid, setPaid] = useState(d.paid);
  const [rows, setRows] = useState<PriceDraft[]>(d.priceRows);
  const [repeat, setRepeat] = useState<'weekly' | 'monthly'>(d.repeat);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  // Fill the uncontrolled inputs once the fields for the chosen path exist.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    for (const [name, value] of Object.entries(d.values)) {
      const el = form.elements.namedItem(name);
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) el.value = value;
    }
    form.querySelectorAll<HTMLInputElement>('input[name="days"]').forEach(c => { c.checked = d.days.includes(c.value); });
    form.querySelectorAll<HTMLInputElement>('input[name="weeks"]').forEach(c => { c.checked = d.weeks.includes(c.value); });
    const trial = form.elements.namedItem('freeTrial');
    if (trial instanceof HTMLInputElement) trial.checked = d.freeTrial;
  }, [d]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sending, onClose]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const form = e.currentTarget;
    if (path === 'class' && !form.querySelector('input[name="days"]:checked')) { setError('Choose at least one class day.'); return; }
    if (path === 'class' && !durationValid(durationMinutes(String(new FormData(form).get('durationValue') ?? ''), String(new FormData(form).get('durationUnit') ?? '')))) { setError(DURATION_ERROR); return; }
    if (path === 'class' && repeat === 'monthly' && !form.querySelector('input[name="weeks"]:checked')) { setError('Choose at least one week of the month.'); return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (path === 'event' && !/^\d+$/.test(String(new FormData(form).get('seats') ?? '').trim())) { setError('Enter the number of seats.'); return; }
    const f = new FormData(form);
    const isClass = path === 'class';
    const common = {
      title: field(f, 'title'), description: field(f, 'description'), host: field(f, 'hostName'), status: field(f, 'status') || 'DRAFT',
      topicId: field(f, 'topicId') ? Number(field(f, 'topicId')) : null, instagram: field(f, 'instagram') || null, website: field(f, 'website') || null,
      images: f.getAll('images').map(v => String(v).trim()).filter(Boolean),
      contactName: field(f, 'contactName') || null, contactPhone: field(f, 'contactPhone') || null, contactEmail: field(f, 'contactEmail') || null,
      ...(fromRequest ? { sourceRequestId: fromRequest.id } : {}),
    };
    const body = isClass ? {
      ...common, mode: 'online', kind: 'class', platform: field(f, 'platform'), date: field(f, 'startDate'), time: field(f, 'classTime'), endsOn: field(f, 'endsOn') || null,
      schedule: { repeat, days: f.getAll('days').map(String), ...(repeat === 'monthly' ? { weeks: f.getAll('weeks').map(w => (w === 'last' ? 'last' : Number(w))) } : {}), time: field(f, 'classTime'), durationMin: durationMinutes(field(f, 'durationValue'), field(f, 'durationUnit')) },
      venue: null, cityId: null, seats: null,
      prices: rows.map(r => ({ label: r.label.trim(), amountPaise: Math.round(Number(r.amount) * 100), sessions: r.sessions ? Number(r.sessions) : null })),
      freeTrial: f.get('freeTrial') === 'on', languages: field(f, 'languages').split(',').map(x => x.trim()).filter(Boolean),
      level: field(f, 'level') || null, experience: field(f, 'experience') || null, certifications: field(f, 'certifications') || null, whatsapp: field(f, 'whatsapp') || null,
    } : {
      ...common, mode: 'in_person', kind: field(f, 'kind') || 'workshop', venue: field(f, 'venue'), date: field(f, 'startDate'), time: field(f, 'startTime') || '09:00',
      endsOn: field(f, 'endDate') || null, seats: Number(field(f, 'seats')),
      platform: null, schedule: null, prices: [], languages: [], level: null, freeTrial: false,
      ...(field(f, 'cityRef') ? { cityRef: field(f, 'cityRef') } : field(f, 'cityId') ? { cityId: Number(field(f, 'cityId')) } : {}),
      type: paid ? 'PAID' : 'FREE', pricePaise: paid ? Math.round(Number(field(f, 'priceRupees')) * 100) : 0,
    };
    setSending(true); setError('');
    try {
      const r = await fetch(workshop ? `/api/workshops/${workshop.id}` : '/api/workshops', { method: workshop ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => null);
      if (!r.ok) { setError(data?.error ?? 'Something went wrong. Please try again.'); setSending(false); return; }
      onSaved(data as Workshop);
    } catch { setError('Network error. Please try again.'); setSending(false); }
  }

  return (
    <div className="contact-backdrop admin-modal" onClick={e => { if (e.target === e.currentTarget && !sending) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="listing-title" className="contact-card">
        <div className="dialog-head">
          <h2 id="listing-title">{workshop ? 'Edit listing' : fromRequest ? 'Create listing from request' : 'New listing'}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} disabled={sending}>✕</button>
        </div>
        <form ref={formRef} className="admin-form" noValidate onSubmit={save}>
          {error && <p role="alert" className="admin-error">{error}</p>}
          <fieldset className="host-path">
            <legend>What is it?</legend>
            <div className="host-path-cards">
              <label className="host-path-card"><input type="radio" name="path" value="event" aria-label="In-person event" checked={path === 'event'} onChange={() => setPath('event')} /><span><b>In-person event</b><small>Workshop, meetup, pop-up or flea market</small></span></label>
              <label className="host-path-card"><input type="radio" name="path" value="class" aria-label="Online class" checked={path === 'class'} onChange={() => setPath('class')} /><span><b>Online class</b><small>Regular classes online</small></span></label>
            </div>
          </fieldset>
          <label>Status
            <select name="status" defaultValue="DRAFT"><option value="DRAFT">Draft</option><option value="APPROVED">Published</option><option value="ARCHIVED">Archived</option></select>
          </label>
          <label>Topic
            <select name="topicId" defaultValue=""><option value="">Other</option>{topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          </label>
          <label><span className="lbl">{path === 'class' ? 'Class title' : 'Event title'}</span><input name="title" required maxLength={150} /></label>
          {path !== 'class' && (
            <label><span className="lbl">Type</span>
              <select name="kind" required defaultValue="workshop"><option value="workshop">Workshop</option><option value="meetup">Meetup</option><option value="popup">Pop-up</option><option value="market">Flea market</option></select>
            </label>
          )}
          <label><span className="lbl">{path === 'class' ? 'About the class' : 'What happens at the event'}</span><textarea name="description" required maxLength={2000} rows={3} /></label>
          <ImageUploader initial={d.images} max={MAX_REQUEST_IMAGES} endpoint="/api/uploads/workshop-request-image" legend="Photos (up to 3)" onBusyChange={setUploading} />
          {path === 'class'
            ? <ClassWhenAndPrice startDate={startDate} setStartDate={setStartDate} rows={rows} setRows={setRows} repeat={repeat} setRepeat={setRepeat} />
            : <EventWhereWhen startDate={startDate} setStartDate={setStartDate} paid={paid} setPaid={setPaid} cityRequired={!workshop?.cityId} cityDefault={workshop?.cityId && workshop.city ? { id: workshop.cityId, label: workshop.city } : undefined} />}
          <fieldset>
            <legend>Host</legend>
            <label><span className="lbl">Host, studio, cafe or organiser name</span><input name="hostName" required maxLength={200} /></label>
            <div className="admin-form-row">
              <label>Instagram<input name="instagram" maxLength={200} placeholder="@yourstudio" /></label>
              <label>Website<input name="website" type="text" inputMode="url" maxLength={300} placeholder="yourstudio.in" /></label>
            </div>
            {path === 'class' && <ClassAbout />}
          </fieldset>
          <fieldset>
            <legend>Private contact (staff only, never shown on the site)</legend>
            <label>Contact name<input name="contactName" maxLength={100} /></label>
            <div className="admin-form-row">
              <label>Contact phone<input name="contactPhone" type="tel" inputMode="tel" maxLength={40} pattern={PHONE_PATTERN} title={PHONE_HINT} /></label>
              <label>Contact email<input name="contactEmail" type="email" maxLength={200} /></label>
            </div>
          </fieldset>
          <div className="admin-actions">
            <button type="button" className="button" onClick={onClose} disabled={sending}>Cancel</button>
            <button type="submit" className="button primary" disabled={sending || uploading} aria-busy={sending}>{sending ? 'Saving…' : 'Save listing'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
