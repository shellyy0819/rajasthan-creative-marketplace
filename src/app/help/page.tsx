import Link from 'next/link';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { AttenderScene, HostScene, MakerScene, ShopperScene } from '@/components/HelpScenes';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { contactEmail } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'How it works',
  description: 'How Craftofy works for shoppers, makers, workshop hosts and attendees. Find a maker or workshop, contact them directly and pay them directly. Craftofy does not take payments.',
  path: '/help',
});

export const dynamic = 'force-dynamic'; // read CONTACT_EMAIL when the page is served

const crumbs = [{ name: 'Home', path: '/' }, { name: 'How it works', path: '/help' }];

type Role = {
  id: string; pill: string; eyebrow: string; title: string; intro: string;
  steps: { head: string; text: string }[]; benefits: string[]; scene: React.ReactNode;
  cta: { label: string; href: string; external?: boolean };
};

export default function HelpPage() {
  const email = contactEmail();
  const HOST = `mailto:${email}?subject=${encodeURIComponent('Hosting a Craftofy workshop')}`;
  const roles: Role[] = [
    {
      id: 'shoppers', pill: 'Shoppers', eyebrow: 'FOR SHOPPERS', title: 'Find it, love it, talk to the maker.',
      intro: 'No account and no cart. You deal with the person who made it.',
      steps: [
        { head: 'Find.', text: 'Browse handmade finds, filter by city or category, and tap the heart on the ones you like.' },
        { head: 'Connect.', text: 'Tap Contact artist to see the phone, email or Instagram the maker chose to share.' },
        { head: 'Buy.', text: 'Agree the details and pay the maker directly. Craftofy does not take payments.' },
      ],
      benefits: ['No marketplace commission added to the price', 'Every piece comes straight from the maker', 'Ask for changes, sizes or custom orders'],
      scene: <ShopperScene />, cta: { label: 'Shop handmade', href: '/shop' },
    },
    {
      id: 'makers', pill: 'Makers', eyebrow: 'FOR MAKERS', title: 'Open your own stall in minutes.',
      intro: 'You create, we connect, you sell. We do not collect payments: customers pay you directly. You stay in charge of your products, prices and earnings.',
      steps: [
        { head: 'Sign in.', text: 'Continue with Google. There is no approval to join.' },
        { head: 'Tell us about your craft.', text: 'Your brand name, city, category and how customers can reach you. A logo is optional.' },
        { head: 'Add your products.', text: 'Add photos, price and stock. Our team reviews each one before it goes live on the shop.' },
        { head: 'Get contacted and paid.', text: 'Customers contact you directly and you agree the sale between you. They pay you directly. Craftofy never collects payments.' },
      ],
      benefits: ['No commission on your sales', 'Customers pay you directly', 'You set the price and the stock', 'Your own artist page with all your work'],
      scene: <MakerScene />, cta: { label: 'Start selling', href: '/sell' },
    },
    {
      id: 'hosts', pill: 'Workshop hosts', eyebrow: 'FOR WORKSHOP HOSTS', title: 'Fill your studio with curious people.',
      intro: 'Run a workshop, meetup or pop-up at your studio or café and let people in your city find it.',
      steps: [
        { head: 'Write to us.', text: 'Send the title, date, venue, seats and whether it is free or paid. The Host a workshop button opens an email with the questions ready.' },
        { head: 'We list it.', text: 'We review it and publish it on the workshops page for your city.' },
        { head: 'People reserve.', text: 'Attendees reserve a spot, and the seats left update on your listing.' },
      ],
      benefits: ['Reach people near you', 'Free or paid, you decide', 'Seats left shown on the listing', 'Works for studios, cafés and pop-ups'],
      scene: <HostScene />, cta: { label: 'Host a workshop', href: HOST, external: true },
    },
    {
      id: 'attendees', pill: 'Attendees', eyebrow: 'FOR ATTENDEES', title: 'Learn a craft, meet the makers.',
      intro: 'Hands-on workshops, creative meetups and pop-ups hosted by local studios and cafés.',
      steps: [
        { head: 'Find.', text: 'Browse workshops by city and see the date, venue, price and seats left.' },
        { head: 'Reserve.', text: 'Tap Reserve spot and leave your details to hold a place.' },
        { head: 'Show up.', text: 'Turn up on the day. For a paid workshop, pay the host directly. Craftofy does not take payments.' },
      ],
      benefits: ['Free and paid options', 'Small groups, you see seats left', 'Local studios and cafés', 'Meet the makers behind the work'],
      scene: <AttenderScene />, cta: { label: 'Browse workshops', href: '/workshops' },
    },
  ];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">LET US HELP YOU</span>
        <h1>How Craftofy works.</h1>
        <p>Craftofy helps people find makers and workshops. The rest happens between you and the maker or host. We never take a cut and we do not handle payments.</p>
      </div>
      <nav className="help-pills" aria-label="Jump to">
        {roles.map(r => <a key={r.id} href={`#${r.id}`}>{r.pill}</a>)}
      </nav>
      {roles.map(r => (
        <section key={r.id} id={r.id} className="help-role" aria-labelledby={`${r.id}-h`}>
          <div className="help-art">{r.scene}</div>
          <div className="help-copy">
            <span className="eyebrow">{r.eyebrow}</span>
            <h2 id={`${r.id}-h`}>{r.title}</h2>
            <p className="help-intro">{r.intro}</p>
            <ol className="help-steps">
              {r.steps.map(s => <li key={s.head}><b>{s.head}</b> {s.text}</li>)}
            </ol>
            <ul className="help-benefits" aria-label="Benefits">
              {r.benefits.map(b => <li key={b}>{b}</li>)}
            </ul>
            {r.cta.external
              ? <a className="button primary" href={r.cta.href}>{r.cta.label} <span>↗</span></a>
              : <Link className="button primary" href={r.cta.href}>{r.cta.label} <span>↗</span></Link>}
          </div>
        </section>
      ))}
      <p className="help-foot">Questions? Write to <a href={`mailto:${email}`}>{email}</a>.</p>
    </>
  );
}
