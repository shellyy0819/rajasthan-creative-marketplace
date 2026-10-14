import Link from 'next/link';
import type { Workshop } from '@/lib/types';
import { money } from '@/lib/money';
import { formatDay } from '@/lib/format';
import { workshopSlug } from '@/lib/catalog';
import { ReserveButton } from './ReserveButton';

export function WorkshopCard({ w }: { w: Workshop }) {
  const { day, month } = formatDay(w.date);
  const left = w.seats - w.booked;
  return (
    <article className="workshop-card">
      <div className="date-tile"><b>{day}</b><span>{month} · {w.city}</span></div>
      <div>
        <h3><Link href={`/workshops/${workshopSlug(w)}`}>{w.title}</Link></h3>
        <p>{w.venue} · <time dateTime={`${w.date}T${w.time}+05:30`}>{w.time}</time><br />{w.host} · {left} seats left</p>
      </div>
      <div className="workshop-price"><b>{w.type === 'FREE' ? 'Free' : money(w.pricePaise)}</b><ReserveButton workshop={w} /></div>
    </article>
  );
}
