import { requestOrigin } from '@/lib/request-origin';
import { listActiveCities } from '@/lib/cities';
import { cityLabeller } from '@/lib/city-label';
import { SITE, contactEmail } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** llms.txt: a plain-markdown site summary for AI search engines. Only states facts the site itself publishes. */
export async function GET() {
  const origin = await requestOrigin();
  const cities = await listActiveCities().catch(() => []);
  const label = cityLabeller(cities);
  const body = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description} ${SITE.name} lists independent makers and creative workshops across India. Buyers contact the maker directly to order; ${SITE.name} takes no commission.`,
    '',
    '## Key pages',
    `- [Shop](${origin}/shop): handmade products from independent makers, filterable by category and city`,
    `- [Workshops](${origin}/workshops): creative workshops, meetups and pop-up experiences hosted by local makers`,
    `- [Fair](${origin}/fair): a walk-around exhibition of handmade stalls where visitors meet makers, watch crafts being made and shortlist products`,
    `- [About](${origin}/about): who ${SITE.name} is and how it works`,
    `- [Help](${origin}/help): ordering, selling and account questions`,
    `- [Contact](${origin}/contact): reach the ${SITE.name} team (${contactEmail()})`,
    ...(cities.length ? ['', '## Cities', ...cities.map(c => `- [Handmade and workshops in ${label(c)}](${origin}/cities/${c.slug})`)] : []),
    '',
    '## Optional',
    `- [Sitemap](${origin}/sitemap.xml)`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
