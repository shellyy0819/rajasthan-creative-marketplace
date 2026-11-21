import { Breadcrumbs } from '@/components/Breadcrumbs';
import '@/components/class/ClassDetail.css';

/**
 * Shown the moment a workshop page is opened, while its data loads: the same frame as the real page (breadcrumbs, the hero with the title
 * lines beside a picture box, the facts row), so nothing jumps when the page arrives. The picture box is the size of the real picture or
 * photo (see .cd-media-skeleton). No spinner: nothing blocks the page.
 */
export default function WorkshopLoading() {
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Workshops', path: '/workshops' }, { name: 'Workshop', path: '/workshops' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <div className="cd" aria-busy="true">
        <p className="sr-only" role="status">Loading workshop</p>
        <section className="cd-hero" aria-hidden="true">
          <div className="cd-hero-text">
            <span className="skeleton skeleton-line short" />
            <span className="skeleton skeleton-line title" />
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-button" />
          </div>
          <div className="cd-media"><span className="skeleton cd-media-skeleton" /></div>
        </section>
        <section className="cd-facts cd-facts-skeleton" aria-hidden="true">
          {[0, 1, 2, 3].map(i => <div key={i}><span className="skeleton skeleton-line short" /><span className="skeleton skeleton-line" /></div>)}
        </section>
      </div>
    </>
  );
}
