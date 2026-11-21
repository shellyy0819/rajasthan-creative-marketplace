import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FairGame } from '@/components/fair/FairGame';
import { JsonLd } from '@/components/JsonLd';
import { diwaliOver } from '@/lib/fair-festival';
import { getFairSettings, isFairOpen } from '@/lib/fair-settings';
import { getFairData } from '@/lib/fair-data';
import { breadcrumbJsonLd, fairJsonLd } from '@/lib/jsonld';
import { money } from '@/lib/money';
import { capitalize, getCatalogWording } from '@/lib/catalog-wording';
import { pageMetadata } from '@/lib/meta';

export const dynamic = 'force-dynamic';

const describe = (products: string) => `Walk through a virtual exhibition of makers' stalls with ${products} to discover. Meet the makers at their counters, watch a craft being made, try on earrings at the mirror and see who else is visiting.`;
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({ title: 'Craftofy Fair: a walk-around exhibition', description: describe((await getCatalogWording()).products), path: '/fair', noindex: true }); // an interactive walk-through with no text of its own worth ranking: search engines skip it, always
}

export default async function FairPage() {
  const wording = await getCatalogWording();
  const DESCRIPTION = describe(wording.products);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Fair', path: '/fair' }];
  if (!(await isFairOpen())) {
    // An admin has closed the exhibition: say so plainly. (The page is never indexed: see generateMetadata.)
    return (
      <>
        <Breadcrumbs items={crumbs} />
        <div className="page-head">
          <span className="eyebrow">WALK THE EXHIBITION</span>
          <h1>The Craftofy Fair is closed for now</h1>
          <p>The exhibition is not open at the moment. Please check back soon. In the meantime you can shop {wording.products} from our makers.</p>
          <p><Link className="button primary" href="/shop">Browse the shop</Link></p>
        </div>
      </>
    );
  }
  const [data, { mela }] = await Promise.all([getFairData(), getFairSettings()]);
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={fairJsonLd(DESCRIPTION, `${capitalize(wording.products)} and creative workshops from independent makers in India`)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">WALK THE EXHIBITION</span>
        <h1>Craftofy Fair</h1>
        <p>Two rows of stalls and one lane between them. Walk with the arrow keys or click where you want to go, meet the makers, watch them work and shortlist what you love.</p>
      </div>
      <section className="section">
        <FairGame data={data} diyas={!diwaliOver(new Date())} schedule={mela} />
      </section>
      <section className="section fair-index" aria-labelledby="fair-index-h">
        <h2 id="fair-index-h">Stalls in the fair</h2>
        <p>Prefer a plain list? Here is everything on the counters right now.</p>
        {data.makers.length === 0 ? <p>No stalls are open yet.</p> : (
          <ul>
            {data.makers.map(m => (
              <li key={m.id}>
                <h3>{m.href ? <Link href={m.href}>{m.name}</Link> : m.name}</h3>
                <p>{m.city} · {m.category}</p>
                <ul>{m.items.map(i => <li key={i.key}>{i.href ? <Link href={i.href}>{i.name}</Link> : i.name}, {money(i.pricePaise)}</li>)}</ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
