import type { Workshop } from '@/lib/types';
import { money } from '@/lib/money';
import { formatDay } from '@/lib/format';
import { workshopSlug } from '@/lib/catalog-shared';
import { describeSchedule, summarizePrices } from '@/lib/workshop-listing';
import { LEVEL_LABEL } from '@/lib/workshop-support';
import { ClassArt } from './class/ClassIllustration';
import { artKind } from '@/lib/class-page';
import { ReserveButton } from './ReserveButton';
import './WorkshopListings.css';
import { WorkshopContact } from './WorkshopContact';
import { WorkshopTitleLink } from './WorkshopTitleLink';
import { gaWorkshopType } from '@/lib/ga-events';

/** "Mon, Wed, Fri at 6:00 pm, 60 min": if the line has to wrap, the length ("60 min") moves down as a whole instead of splitting between "60" and "min". */
function ScheduleLine({ text }: { text: string }) {
  const i = text.lastIndexOf(', ');
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i + 1)} <span className="ws-duration">{text.slice(i + 2)}</span></>;
}

export function WorkshopCard({ w }: { w: Workshop }) {
  const { day, month } = formatDay(w.date);
  const isClass = w.kind === 'class' || w.mode === 'online';
  const bookable = !isClass && w.seats !== null;
  const left = (w.seats ?? 0) - w.booked;
  const cover = w.images[0]; // the first photo is the cover
  // A card without a photo shows the illustration for its category (yoga, crochet, painting, food, resin, or the generic one), so every card has a picture.
  const trialChip = w.freeTrial ? (w.freeTrialDays ? `${w.freeTrialDays}-day free trial` : 'Free trial') : null;
  const chip = isClass ? `Online${w.platform ? ` · ${w.platform}` : ''}` : `${day} ${month}`;
  const price = w.prices.length ? summarizePrices(w.prices).from : w.type === 'FREE' ? 'Free' : money(w.pricePaise);
  return (
    <article className="workshop-card with-photo">
      <div className="tile-col">
        {cover
          ? (
            <div className="date-tile has-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="" loading="lazy" />
            </div>
          )
          : <div className="date-tile has-photo has-art"><ClassArt title={w.title} kind={artKind(w)} /></div>}
        <span className="tile-chip">{chip}</span>
        {trialChip && <span className="tile-trial">{trialChip}</span>}
      </div>
      <div className="ws-text">
        <div className="ws-head">
          {/* Phones show the Online / date label above the title (the photo chip is for laptops); every card has a picture. */}
          <span className="ws-eyebrow">{chip}</span>
          <h3><WorkshopTitleLink href={`/workshops/${workshopSlug(w)}`} workshopId={w.id} category={w.topic?.name} contentType={gaWorkshopType(w)}>{w.title}</WorkshopTitleLink></h3>
          {isClass
            ? <p>{w.schedule ? <ScheduleLine text={describeSchedule(w.schedule)} /> : 'Online class'}<br />Instructor: {w.host}</p>
            : <p>{w.venue} · <time dateTime={`${w.date}T${w.time}+05:30`}>{w.time}</time><br />Host: {w.host}{bookable && <span className="ws-seats-inline">{` · ${left} seats left`}</span>}</p>}
        </div>
        {(w.level || w.languages.length > 0) && (
          <p className="ws-badges">
            {w.level && <span>{LEVEL_LABEL[w.level]}</span>}
            {w.languages.length > 0 && <span>{w.languages.join(', ')}</span>}
          </p>
        )}
      </div>
      <div className="workshop-price">
        <span className="ws-price-main">
          <b>{price}</b>
          {trialChip && <span className="ws-price-trial">{trialChip}</span>}
          {bookable && <span className="ws-seats">{left} seats left</span>}
        </span>
        {bookable ? <ReserveButton workshop={w} /> : <WorkshopContact w={w} workshopId={w.id} category={w.topic?.name} contentType={gaWorkshopType(w)} placement="card" />}
      </div>
    </article>
  );
}
