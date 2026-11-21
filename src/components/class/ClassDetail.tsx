import Link from 'next/link';
import { contactChannels, describeNext, isYogaListing, nextSession, weekStrip, type Channel } from '@/lib/class-page';
import { formatDay } from '@/lib/format';
import { describeSchedule } from '@/lib/workshop-listing';
import { money } from '@/lib/money';
import type { Workshop } from '@/lib/types';
import { LEVEL_LABEL } from '@/lib/workshop-support';
import { ChannelIcon } from './ChannelIcon';
import { ClassIllustration } from './ClassIllustration';
import { PhotoMosaic } from './PhotoMosaic';
import '@/components/WorkshopListings.css';
import './ClassDetail.css';

const date = (iso: string) => { const d = formatDay(iso); return `${d.day} ${d.month} ${d.year}`; };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('') || '·';

function Button({ c, outline }: { c: Channel; outline?: boolean }) {
  return <a className={`button cd-btn${outline ? '' : ' primary'}`} href={c.href} {...(c.kind === 'call' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}><ChannelIcon kind={c.kind} />{c.label}</a>;
}

/** The detail page of an online class: photos, who teaches it, when it meets, what it costs and how to reach the host. Public details only. */
export function ClassDetail({ w, ended, now = new Date(), hostPhoto, share }: { w: Workshop; ended: boolean; now?: Date; /** The seller's profile photo (https), when the class is linked to a seller who has one. */ hostPhoto?: string; /** The Share button, when this viewer may see it (decided by the page). */ share?: React.ReactNode }) {
  const ch = contactChannels(w);
  const next = ended ? null : nextSession(w, now);
  // The main button (and any outline buttons) already carry their channel; the icon row lists only the others, so nothing shows twice.
  const shown = new Set([ch.primary?.kind, ...ch.secondary.map(c => c.kind)].filter(Boolean));
  const icons = ended ? ch.icons : ch.icons.filter(c => !shown.has(c.kind));
  const week = !ended && w.schedule ? weekStrip(w, now) : [];
  const meetsThisWeek = week.some(d => d.state !== 'rest');
  const trial = w.freeTrial ? (w.freeTrialDays ? `${w.freeTrialDays}-day free trial` : 'Free trial') : null;
  const free = !w.prices.length && w.type === 'FREE';
  const topic = w.topic?.name.toUpperCase();
  const facts: { k: string; v: string }[] = [
    ...(w.schedule ? [{ k: 'EACH CLASS', v: `${w.schedule.durationMin} minutes` }] : []),
    { k: 'STARTS', v: w.endsOn && w.endsOn !== w.date ? `${date(w.date)} to ${date(w.endsOn)}` : w.endsOn ? date(w.date) : `From ${date(w.date)}` },
    ...(w.level || w.languages.length ? [{ k: 'FOR', v: [w.level ? (w.level === 'beginner' ? 'Beginners' : LEVEL_LABEL[w.level]) : '', w.languages.join(', ')].filter(Boolean).join(' · ') }] : []),
  ];
  const live = `Live on ${w.platform ?? 'video call'}`;
  const where = w.mode !== 'online' ? [w.venue, w.city].filter(Boolean).join(', ') : '';
  const perClass = (amount: number, sessions: number | null) => (sessions && sessions > 1 && amount > 0 ? `${sessions} sessions · about ${money(Math.round(amount / sessions))} a class` : sessions ? `${sessions} ${sessions === 1 ? 'session' : 'sessions'}` : '');
  return (
    <div className="cd">
      <section className="cd-hero" aria-labelledby="cd-h1">
        <div className="cd-hero-text">
          <p className="cd-eyebrow">ONLINE CLASS{topic ? ` · ${topic}` : ''}</p>
          <h1 id="cd-h1">{w.title}</h1>
          {ended && <p className="ws-ended" role="status">This class has ended. <Link href="/workshops">See upcoming workshops</Link></p>}
          <p className="cd-lead">{w.description}</p>
          {trial && <p className="cd-badges"><span className="cd-badge">{trial}</span></p>}
          <div className="cd-panel">
          <div className="cd-row cd-teacher">
            <div className="cd-avatar" aria-hidden="true">{hostPhoto ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={hostPhoto} alt="" referrerPolicy="no-referrer" /> : initials(w.host)}</div>
            <div>
              <span className="cd-label">YOUR INSTRUCTOR</span>
              <span className="cd-name">{w.host}</span>
              {(w.experience || w.certifications) && <span className="cd-sub">{[w.experience, w.certifications].filter(Boolean).join(' · ')}</span>}
              {icons.length > 0 && (
                <span className="cd-icons">{icons.map(c => <a key={c.kind} href={c.href} aria-label={c.short} {...(c.kind === 'call' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}><ChannelIcon kind={c.kind} /></a>)}</span>
              )}
            </div>
          </div>
          <div className="cd-row">
            <div className="cd-ico" aria-hidden="true">
              {where
                ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="14" height="12" rx="3" /><path d="M16 10l6-3v10l-6-3z" /></svg>}
            </div>
            <div>
              <span className="cd-label">WHERE</span>
              <span className="cr-line">{where || live}</span>
              {where
                ? <><a className="cr-maps" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`} target="_blank" rel="noopener noreferrer">Open in Maps</a>{w.mode === 'hybrid' && <span className="cr-sub">Also live on {w.platform ?? 'video call'}</span>}</>
                : <span className="cr-sub">The meeting link is sent to you privately.</span>}
            </div>
          </div>
          {next && (
            <div className="cd-row cd-next">
              <span aria-hidden="true" className="cd-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>
              <span><span className="cd-label">NEXT CLASS</span><span className="cd-next-text">{describeNext(next, now)}</span></span>
            </div>
          )}
          </div>
          {!ended && ch.primary && <div className="cd-cta"><Button c={ch.primary} />{ch.secondary.map(c => <Button key={c.kind} c={c} outline />)}</div>}
          {share && <div className="share-slot">{share}</div>}
        </div>
        {w.images.length ? <PhotoMosaic images={w.images} title={w.title} /> : <ClassIllustration title={w.title} yoga={isYogaListing(w)} />}
      </section>

      <section className="cd-facts" aria-label="Class at a glance">
        {facts.map(f => <div key={f.k}><span className="cd-label">{f.k}</span><span className="cd-fact">{f.v}</span></div>)}
      </section>

      <div className="cd-body">
        <main className="cd-main">
          {/* A week with no class in it (not started yet): keep the schedule line, drop the seven empty boxes. */}
          {week.length > 0 && (
            <section aria-labelledby="cd-week-h">
              <h2 id="cd-week-h">{meetsThisWeek ? 'This week' : 'Schedule'}</h2>
              <p className="cd-note">{w.schedule ? `${describeSchedule(w.schedule)}. ` : ''}Times are India time (IST).</p>
              {meetsThisWeek && <ol className="cd-week">
                {week.map(d => (
                  <li key={d.date} className={`cd-day cd-${d.state}`}>
                    <b>{d.state === 'today' ? 'TODAY' : d.label.toUpperCase()}</b>
                    <span className="cd-dom">{d.dom}</span>
                    {d.state === 'rest' ? <span className="sr-only">No class</span> : <small>{d.state === 'done' ? 'Done' : d.time}</small>}
                  </li>
                ))}
              </ol>}
            </section>
          )}

          {free ? (
            <section aria-labelledby="cd-price-h">
              <h2 id="cd-price-h">Price</h2>
              <div className="cd-free">
                <span className="cd-free-badge">Free</span>
                <p><strong>Every class is free.</strong> There is nothing to pay.</p>
              </div>
            </section>
          ) : (
          <section aria-labelledby="cd-plans-h">
            <h2 id="cd-plans-h">Plans</h2>
            <p className="cd-note">You pay the instructor directly. Craftofy collects no payment.</p>
            <div className="cd-plans">
              {!w.prices.length && <div className="cd-plan"><span className="cd-plan-name">Per class</span><span className="cd-plan-price">{money(w.pricePaise)}</span></div>}
              {w.prices.map(p => (
                <div key={p.label} className="cd-plan">
                  <span className="cd-plan-name">{p.label}</span>
                  <span className="cd-plan-price">{p.amountPaise === 0 ? 'Free' : money(p.amountPaise)}</span>
                  <span className="cd-plan-sub">{perClass(p.amountPaise, p.sessions)}</span>
                </div>
              ))}
            </div>
          </section>
          )}

          {!ended && ch.primary && (
            <section aria-labelledby="cd-join-h">
              <h2 id="cd-join-h">How to join</h2>
              <ol className="cd-steps">
                <li><b>1</b><span><strong>Contact the host</strong>Use {ch.primary.kind === 'whatsapp' ? 'WhatsApp' : ch.primary.kind === 'call' ? 'the phone number' : ch.primary.short} and pick your start day.</span></li>
                <li><b>2</b><span><strong>Get the {w.platform ?? 'meeting'} link</strong>The meeting link is sent to you privately, never posted here.</span></li>
                {trial && <li><b>3</b><span><strong>Try the free class</strong>Join, then choose a plan only if you like it.</span></li>}
              </ol>
            </section>
          )}
        </main>

        {!ended && ch.primary && (
          <aside className="cd-aside" aria-label="Contact the instructor">
            <div className="cd-aside-copy">
              <strong>Join {w.title}</strong>
              <p>{free ? 'This class is free.' : w.prices.length ? `Plans from ${money(Math.min(...w.prices.map(p => p.amountPaise)))}.` : `${money(w.pricePaise)} a class.`}{trial ? ' Ask the host about the free trial.' : ''}</p>
            </div>
            <Button c={ch.primary} />
          </aside>
        )}
      </div>
    </div>
  );
}
