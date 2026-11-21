import { Breadcrumbs } from '@/components/Breadcrumbs';
import { supportLine } from '@/lib/workshop-support';

/**
 * Shown the moment the workshops page is opened, while the listings load: the breadcrumbs, the eyebrow, the title and the intro are
 * there at once (none of them depend on the data), and only the Host a workshop button, the filters and the list are placeholders.
 * No spinner: nothing blocks the page.
 */
export default function WorkshopsLoading() {
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Workshops', path: '/workshops' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <div className="page-head ws-head">
        <span className="eyebrow">OUT OF THE SCROLL, INTO THE STUDIO</span>
        <h1>Creative workshops &amp; pop-ups</h1>
        <p>Hands-on workshops, creative meetups and pop-ups hosted by local studios and cafés.</p>
        <p className="ws-supports">{supportLine()}</p>
        <div className="ws-head-cta"><span className="skeleton skeleton-button" aria-hidden="true" /></div>
      </div>
      <section className="workshop-band" style={{ display: 'block', marginTop: 30 }} aria-busy="true">
        <p className="sr-only" role="status">Loading workshops</p>
        <div className="skeleton skeleton-filters" aria-hidden="true" />
        <div className="workshop-list" aria-hidden="true">
          {[0, 1, 2, 3].map(i => <span key={i} className="skeleton skeleton-workshop" />)}
        </div>
      </section>
    </>
  );
}
