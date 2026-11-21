import type { Workshop } from '@/lib/types';
import { money } from '@/lib/money';
import { formatDay } from '@/lib/format';
import { workshopSlug } from '@/lib/catalog-shared';
import { describeSchedule, summarizePrices } from '@/lib/workshop-listing';
import { LEVEL_LABEL } from '@/lib/workshop-support';
import { ClassArt } from './class/ClassIllustration';
import { isYogaListing } from '@/lib/class-page';
import { ReserveButton } from './ReserveButton';
import './WorkshopListings.css';
import { WorkshopContact } from './WorkshopContact';
import { WorkshopTitleLink } from './WorkshopTitleLink';
import { gaWorkshopType } from '@/lib/ga-events';

export function WorkshopCard({ w }: { w: Workshop }) {
  const { day, month } = formatDay(w.date);
  const isClass = w.kind === 'class' || w.mode === 'online';
  const bookable = !isClass && w.seats !== null;
  const left = (w.seats ?? 0) - w.booked;
  const cover = w.images[0]; // the first photo is the cover
  const yogaArt = !cover && isYogaListing(w); // no photo: a yoga listing shows the yoga illustration, other listings the plain tile
  // With a picture (a photo or the yoga illustration) the free trial is a chip on it, like "Only 1 left" on a product card; on the plain tile it stays a badge under the title.
  const trialChip = (cover || yogaArt) && w.freeTrial ? (w.freeTrialDays ? `${w.freeTrialDays}-day free trial` : 'Free trial') : null;
  const chip = isClass ? `Online${w.platform ? ` · ${w.platform}` : ''}` : `${day} ${month}`;
  const price = w.prices.length ? summarizePrices(w.prices).from : w.type === 'FREE' ? 'Free' : money(w.pricePaise);
  return (
    <article className={`workshop-card${cover || yogaArt ? ' with-photo' : ''}`}>
      {cover
        ? (
          <div className="date-tile has-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" loading="lazy" />
            {trialChip && <span className="tile-trial">{trialChip}</span>}
            <span className="tile-chip">{chip}</span>
          </div>
        )
        : yogaArt
          ? (
            <div className="date-tile has-photo has-art">
              <ClassArt title={w.title} yoga />
              {trialChip && <span className="tile-trial">{trialChip}</span>}
              <span className="tile-chip">{chip}</span>
            </div>
          )
          : <div className="date-tile">{isClass ? <><b>Online</b><span>{w.platform}</span></> : <><b>{day}</b><span>{month} · {w.city ?? 'Online'}</span></>}</div>}
      <div>
        <h3><WorkshopTitleLink href={`/workshops/${workshopSlug(w)}`} workshopId={w.id} category={w.topic?.name} contentType={gaWorkshopType(w)}>{w.title}</WorkshopTitleLink></h3>
        {isClass
          ? <p>{w.schedule ? describeSchedule(w.schedule) : 'Online class'}<br />{w.host}</p>
          : <p>{w.venue} · <time dateTime={`${w.date}T${w.time}+05:30`}>{w.time}</time><br />{w.host}{bookable ? ` · ${left} seats left` : ''}</p>}
        {(w.level || (w.freeTrial && !trialChip) || w.languages.length > 0) && (
          <p className="ws-badges">
            {w.level && <span>{LEVEL_LABEL[w.level]}</span>}
            {w.languages.length > 0 && <span>{w.languages.join(', ')}</span>}
            {w.freeTrial && !trialChip && <span>{w.freeTrialDays ? `Free trial · ${w.freeTrialDays} days` : 'Free trial'}</span>}
          </p>
        )}
      </div>
      <div className="workshop-price"><b>{price}</b>{bookable ? <ReserveButton workshop={w} /> : <WorkshopContact w={w} workshopId={w.id} category={w.topic?.name} contentType={gaWorkshopType(w)} placement="card" />}</div>
    </article>
  );
}
