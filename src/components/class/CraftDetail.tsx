import Link from 'next/link';
import { HostProfileLink } from './HostProfileLink';
import { InstructorBio } from './InstructorBio';
import { ReserveButton } from '@/components/ReserveButton';
import { clock12, contactChannels, artKind, startsIn } from '@/lib/class-page';
import { formatDay } from '@/lib/format';
import { money } from '@/lib/money';
import type { Workshop } from '@/lib/types';
import { LEVEL_LABEL } from '@/lib/workshop-support';
import { ChannelIcon } from './ChannelIcon';
import { ClassIllustration } from './ClassIllustration';
import { PhotoMosaic } from './PhotoMosaic';
import { WorkshopTrackedLink } from '../WorkshopTrackedLink';
import { gaWorkshopType } from '@/lib/ga-events';
import '@/components/WorkshopListings.css';
import './ClassDetail.css';
import './CraftDetail.css';

const KIND: Record<string, string> = { workshop: 'WORKSHOP', meetup: 'MEETUP', popup: 'POP-UP', market: 'FLEA MARKET' };
const date = (iso: string) => { const d = formatDay(iso); return `${d.day} ${d.month} ${d.year}`; };
const weekday = (iso: string) => new Date(`${iso}T12:00:00+05:30`).toLocaleString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }).toUpperCase();
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('') || '·';

/** The detail page of an in-person workshop, built for craft and art: when, where, seats and price first, then what people make. Public details only. */
export function CraftDetail({ w, ended, now = new Date(), share }: { w: Workshop; ended: boolean; now?: Date; /** The Share button, when this viewer may see it (decided by the page). */ share?: React.ReactNode }) {
  const ch = contactChannels(w);
  const d = formatDay(w.date);
  const seats = w.seats;
  const left = seats === null ? null : Math.max(0, seats - w.booked);
  const bookable = !ended && seats !== null && left !== null && left > 0;
  const where = [w.venue, w.city].filter(Boolean).join(', ');
  const when = `${date(w.date)}, ${clock12(w.time)}${w.endsOn && w.endsOn !== w.date ? ` to ${date(w.endsOn)}` : ''}`;
  const soon = ended ? null : startsIn(w.date, now);
  const free = w.type === 'FREE';
  const topic = w.topic?.name.toUpperCase();
  const facts: { k: string; v: string }[] = [
    ...(seats !== null ? [{ k: 'GROUP SIZE', v: `${seats} people at most` }] : []),
    ...(w.level || w.languages.length ? [{ k: 'FOR', v: [w.level ? (w.level === 'beginner' ? 'Beginners' : LEVEL_LABEL[w.level]) : '', w.languages.join(', ')].filter(Boolean).join(' · ') }] : []),
    ...(w.minAge ? [{ k: 'AGE', v: `Ages ${w.minAge} and over` }] : []),
  ];
  return (
    <div className="cd cr">
      <section className="cd-hero cr-hero" aria-labelledby="cr-h1">
        <div className="cd-hero-text">
          <p className="cd-eyebrow">{KIND[w.kind] ?? 'WORKSHOP'}{topic ? ` · ${topic}` : ''}</p>
          <h1 id="cr-h1">{w.title}</h1>
          {ended && <p className="ws-ended" role="status">This event has ended. <Link href="/workshops">See upcoming workshops</Link></p>}
          <p className="cd-lead">{w.description}</p>

          <div className="cd-panel">
          <div className="cd-row cd-teacher">
            <div className="cd-avatar" aria-hidden="true">{initials(w.host)}</div>
            <div>
              <span className="cd-label">YOUR HOST</span>
              <span className="cd-name">{w.hostSlug ? <Link href={`/artists/${w.hostSlug}`}>{w.host}</Link> : w.host}</span>
              <InstructorBio experience={w.experience} certifications={w.certifications} who="host" />
              {(ch.icons.length > 0 || w.hostSlug) && <span className="cd-icons cr-icons">{w.hostSlug && <HostProfileLink slug={w.hostSlug} host={w.host} />}{ch.icons.map(c => <WorkshopTrackedLink key={c.kind} workshopId={w.id} method={c.kind} placement="page" category={w.topic?.name} contentType={gaWorkshopType(w)} href={c.href} aria-label={c.short} {...(c.kind === 'call' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}><ChannelIcon kind={c.kind} /></WorkshopTrackedLink>)}</span>}
            </div>
          </div>

          <div className="cd-row">
            <div className="cr-date" aria-hidden="true"><span>{weekday(w.date)}</span><b>{d.day}</b><span>{d.month.toUpperCase()}</span></div>
            <div><span className="cd-label">WHEN</span><span className="cr-line"><time dateTime={`${w.date}T${w.time}+05:30`}>{when}</time></span>{soon && <span className="cr-sub">{soon}</span>}</div>
          </div>
          {where && (
            <div className="cd-row">
              <div className="cd-ico" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg></div>
              <div><span className="cd-label">WHERE</span><span className="cr-line">{w.venue}{w.venue && w.city ? ', ' : ''}{w.city && w.citySlug ? <Link href={`/cities/${w.citySlug}`}>{w.city}</Link> : w.city}</span><a className="cr-maps" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`} target="_blank" rel="noopener noreferrer">Open in Maps</a></div>
            </div>
          )}
          </div>

          {!ended && (
            <div className="cr-book">
              {seats !== null && left !== null && (
                <div className="cr-seats">
                  <div className="cr-seats-line"><span>{left > 0 ? `${left} of ${seats} seats left` : 'Full'}</span></div>
                  <div className="cr-bar" role="img" aria-label={left > 0 ? `${left} of ${seats} seats left` : 'Full'}><div style={{ width: `${Math.min(100, Math.round((w.booked / seats) * 100))}%` }} /></div>
                </div>
              )}
              <div className="cr-price">{free ? <b>Free</b> : <><b>{money(w.pricePaise)}</b><span>per person</span></>}</div>
              {(bookable || ch.primary) && (
                <div className="cr-actions">
                  {bookable ? <div className="cr-reserve"><ReserveButton workshop={w} /></div>
                : ch.primary && <WorkshopTrackedLink workshopId={w.id} method={ch.primary.kind} placement="page" category={w.topic?.name} contentType={gaWorkshopType(w)} className="button cd-btn primary cr-reserve" href={ch.primary.href} target="_blank" rel="noopener noreferrer"><ChannelIcon kind={ch.primary.kind} onGreen />{ch.primary.label}</WorkshopTrackedLink>}
                  {share && <div className="share-slot">{share}</div>}
                </div>
              )}
            </div>
          )}
          {/* With a main button, Share sits right behind it (above); otherwise it stands alone here. */}
          {share && !(!ended && (bookable || ch.primary)) && <div className="share-slot">{share}</div>}
        </div>
        {/* Outside the text column so, on laptops, the picture ends level with the Share button and not with this line. */}
        {!ended && <p className="cd-note cr-note">No payment is collected on Craftofy. You reserve here, and the host confirms and takes payment.</p>}
        {w.images.length ? <PhotoMosaic images={w.images} title={w.title} /> : <ClassIllustration title={w.title} kind={artKind(w)} />}
      </section>

      {facts.length > 0 && <section className="cd-facts" aria-label="Workshop at a glance">{facts.map(f => <div key={f.k}><span className="cd-label">{f.k}</span><span className="cd-fact">{f.v}</span></div>)}</section>}

      {(w.makes.length > 0 || w.included.length > 0 || w.bring.length > 0) && (
        <div className="cd-body">
          <main className="cd-main">
            {w.makes.length > 0 && (
              <section aria-labelledby="cr-make-h">
                <h2 id="cr-make-h">What you will make</h2>
                <div className="cr-makes">{w.makes.map(m => <div key={m.title} className="cr-make"><strong>{m.title}</strong>{m.text && <span>{m.text}</span>}</div>)}</div>
              </section>
            )}
            {(w.included.length > 0 || w.bring.length > 0) && (
              <section aria-labelledby="cr-inc-h">
                <h2 id="cr-inc-h">{w.included.length && w.bring.length ? 'Included, and what to bring' : w.included.length ? 'Included' : 'What to bring'}</h2>
                <div className="cr-lists">
                  {w.included.length > 0 && <div className="cr-list"><span className="cd-label">Included</span><ul>{w.included.map(x => <li key={x}>{x}</li>)}</ul></div>}
                  {w.bring.length > 0 && <div className="cr-list"><span className="cd-label">Bring</span><ul>{w.bring.map(x => <li key={x}>{x}</li>)}</ul></div>}
                </div>
              </section>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
