import Link from 'next/link';
import type { MatchedItem } from '@/lib/trend-match';
import type { TrendsForPage } from '@/lib/trend-preview';
import { trendBlockHeading, type TrendSource } from '@/lib/trend-types';
import { TrendsPreviewBar } from './TrendsPreviewBar';
import './TrendsBlock.css';

const PATTERNS = 4; // the decorative tiles in TrendsBlock.css, handed out in turn

const updatedOn = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** Only an https address becomes a link; anything else is shown as plain text. */
function isHttps(url: string | undefined): url is string {
  if (!url) return false;
  try { return new URL(url).protocol === 'https:'; } catch { return false; }
}

function Sources({ sources }: { sources: TrendSource[] }) {
  return (
    <p className="trends-src">
      Source:{' '}
      {sources.map((s, i) => (
        <span key={i}>
          {i > 0 && ', '}
          {isHttps(s.url) ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : s.title}
        </span>
      ))}
    </p>
  );
}

function Reach({ item }: { item: MatchedItem }) {
  const workshop = item.kind === 'workshop';
  if (item.count === 0) return <span className="muted trends-reach">{workshop ? 'Not offered yet' : 'No artists listed yet'}</span>;
  const noun = workshop ? (item.count === 1 ? 'workshop' : 'workshops') : (item.count === 1 ? 'piece' : 'pieces');
  return <Link href={item.href} className="text-link trends-reach">{`See ${item.count} ${noun} →`}</Link>;
}

function Card({ item, index, row }: { item: MatchedItem; index: number; row?: boolean }) {
  return (
    <article className={row ? 'trends-card trends-row' : 'trends-card'}>
      <div className={`trends-tile trends-tile-${index % PATTERNS}`} aria-hidden="true" />
      <div className="trends-body">
        {item.category && <span className="eyebrow">{item.category}</span>}
        <h3>{item.title}</h3>
        <p className="trends-why">{item.why}</p>
        {item.tags.length > 0 && <ul className="trends-pills">{item.tags.map((t, i) => <li key={i}>{t}</li>)}</ul>}
        <Sources sources={item.sources} />
        <Reach item={item} />
      </div>
    </article>
  );
}

/** What is rising in crafts and art, and in workshops, with what we already have on the site for each. Everything comes from the digest; text is shown as text, never as markup. */
export function TrendsBlock({ data }: { data: TrendsForPage }) {
  const crafts = data.items.filter(i => i.kind !== 'workshop');
  const workshops = data.items.filter(i => i.kind === 'workshop');
  const heading = trendBlockHeading(crafts.map(i => i.kind));
  return (
    <div className="trends-block">
      {data.previewing && <TrendsPreviewBar />}
      <p className="muted trends-updated">Updated {updatedOn(data.updatedOn)}. {data.sourceLine}</p>
      {heading && (
        <section className="section" aria-labelledby="trends-crafts-h">
          <div className="section-heading"><div><h2 id="trends-crafts-h">{heading}</h2></div></div>
          <div className="trends-grid">{crafts.map((i, n) => <Card key={i.id} item={i} index={n} />)}</div>
        </section>
      )}
      {workshops.length > 0 && (
        <section className="section" aria-labelledby="trends-ws-h">
          <div className="section-heading"><div><span className="eyebrow">PEOPLE ARE LOOKING FOR</span><h2 id="trends-ws-h">Workshops on the rise</h2></div></div>
          <div className="trends-grid">{workshops.map((i, n) => <Card key={i.id} item={i} index={n} row />)}</div>
        </section>
      )}
    </div>
  );
}
