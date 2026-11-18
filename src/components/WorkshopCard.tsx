import Link from 'next/link';
import type { Workshop } from '@/lib/types';
import { money } from '@/lib/money';
import { formatDay } from '@/lib/format';
import { workshopSlug } from '@/lib/catalog-shared';
import { describeSchedule, summarizePrices } from '@/lib/workshop-listing';
import { LEVEL_LABEL } from '@/lib/workshop-support';
import { ReserveButton } from './ReserveButton';
import './WorkshopListings.css';
import { WorkshopContact } from './WorkshopContact';

export function WorkshopCard({ w }: { w: Workshop }) {
  const { day, month } = formatDay(w.date);
  const isClass = w.kind === 'class' || w.mode === 'online';
  const bookable = !isClass && w.seats !== null;
  const left = (w.seats ?? 0) - w.booked;
  const price = w.prices.length ? summarizePrices(w.prices).from : w.type === 'FREE' ? 'Free' : money(w.pricePaise);
  return (
    <article className="workshop-card">
      <div className="date-tile">{isClass ? <><b>Online</b><span>{w.platform}</span></> : <><b>{day}</b><span>{month} · {w.city ?? 'Online'}</span></>}</div>
      <div>
        <h3><Link href={`/workshops/${workshopSlug(w)}`}>{w.title}</Link></h3>
        {isClass
          ? <p>{w.schedule ? describeSchedule(w.schedule) : 'Online class'}<br />{w.host}</p>
          : <p>{w.venue} · <time dateTime={`${w.date}T${w.time}+05:30`}>{w.time}</time><br />{w.host}{bookable ? ` · ${left} seats left` : ''}</p>}
        {(w.level || w.freeTrial || w.languages.length > 0) && (
          <p className="ws-badges">
            {w.level && <span>{LEVEL_LABEL[w.level]}</span>}
            {w.languages.length > 0 && <span>{w.languages.join(', ')}</span>}
            {w.freeTrial && <span>Free trial</span>}
          </p>
        )}
      </div>
      <div className="workshop-price"><b>{price}</b>{bookable ? <ReserveButton workshop={w} /> : <WorkshopContact w={w} />}</div>
    </article>
  );
}
