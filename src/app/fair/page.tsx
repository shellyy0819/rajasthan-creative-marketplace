import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FairGame } from '@/components/fair/FairGame';
import { JsonLd } from '@/components/JsonLd';
import { getFairData } from '@/lib/fair-data';
import { breadcrumbJsonLd, fairJsonLd } from '@/lib/jsonld';
import { money } from '@/lib/money';
import { pageMetadata } from '@/lib/meta';

export const dynamic = 'force-dynamic';

const DESCRIPTION = 'Walk through a virtual exhibition of handmade stalls. Meet the makers at their counters, watch a craft being made, try on earrings at the mirror and see who else is visiting.';
export const metadata: Metadata = pageMetadata({ title: 'Craftofy Fair: a walk-around handmade exhibition', description: DESCRIPTION, path: '/fair' });

export default async function FairPage() {
  const data = await getFairData();
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Fair', path: '/fair' }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={fairJsonLd(DESCRIPTION)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">WALK THE EXHIBITION</span>
        <h1>Craftofy Fair</h1>
        <p>Two rows of stalls and one lane between them. Walk with the arrow keys or click where you want to go, meet the makers, watch them work and shortlist what you love.</p>
      </div>
      <section className="section">
        <FairGame data={data} />
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
