import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { InfoPage } from '@/components/InfoPage';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { contactEmail } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Terms of use',
  description: 'The terms for using Craftofy as a shopper, maker, workshop host or attendee.',
  path: '/terms',
  noindex: true, // DRAFT: remove once a lawyer has approved the text
});

export const dynamic = 'force-dynamic'; // read CONTACT_EMAIL when the page is served

const crumbs = [{ name: 'Home', path: '/' }, { name: 'Terms of use', path: '/terms' }];

export default function TermsPage() {
  const email = contactEmail();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <InfoPage eyebrow="LEGAL" title="Terms of use." intro="Please read these terms before you use Craftofy. By using the site you agree to them.">
        <p className="legal-draft"><b>DRAFT for legal review.</b> Not yet in force. Text in [square brackets] must be filled in or confirmed by counsel.</p>
        <p><small>Last updated: [DATE]</small></p>

        <h2>1. Who we are</h2>
        <p>Craftofy (“Craftofy”, “we”, “us”) is operated by [LEGAL ENTITY NAME], [entity type], of [REGISTERED ADDRESS], India. You can reach us at <a href={`mailto:${email}`}>{email}</a>.</p>

        <h2>2. What Craftofy is</h2>
        <p>Craftofy is an online place where independent makers list handmade products, where workshop hosts list workshops, meetups and pop-ups, and where people can find them. We are an intermediary. We do not make, sell, stock, ship or deliver any product, and we do not run any workshop.</p>
        <ul>
          <li><b>We do not take payments.</b> Shoppers and attendees agree the details and pay the maker or host directly, outside Craftofy.</li>
          <li><b>The contract is between you and the maker or host.</b> Craftofy is not a party to it. Price, quality, delivery, refunds, cancellations and any dispute are between you and them.</li>
          <li>We do not guarantee that any listing is accurate, complete, lawful or available, or that any maker or host will respond.</li>
        </ul>

        <h2>3. Who can use Craftofy</h2>
        <p>You must be at least 18 and able to enter a binding contract to sell, host or sign in. Browsing is open to everyone. [Counsel to confirm the position for under-18 shoppers and attendees.]</p>

        <h2>4. Accounts for makers and hosts</h2>
        <ul>
          <li>Makers sign in with a Google account and complete a profile. You are responsible for your account and for everything done through it. Keep your sign-in secure.</li>
          <li>The details you give must be true and kept up to date. Once a maker profile is submitted it cannot be edited by the maker. Contact us to change it.</li>
          <li>The public email shown on a maker’s listings is the email they registered with.</li>
          <li>We may refuse, suspend or deactivate an account, and remove listings, if these terms are broken, if a listing is misleading or unlawful, or to comply with the law.</li>
        </ul>

        <h2>5. Listings and our review</h2>
        <ul>
          <li>New products start as drafts. They appear on the site only after our team publishes them. We may decline, edit the display of, unpublish or remove any listing at any time.</li>
          <li>Our review is not an inspection and not an endorsement. You remain responsible for your listings.</li>
        </ul>

        <h2>6. What makers and hosts promise</h2>
        <ul>
          <li>You own, or have the right to use, everything you upload (photos, text, logos).</li>
          <li>Listings are accurate, including price, stock, materials, size, dates, venue, seats and whether a workshop is free or paid.</li>
          <li>What you offer is lawful and you hold any licence or registration it needs. You will not list prohibited, counterfeit, hazardous or infringing items. [Counsel to add a prohibited-items list.]</li>
          <li>You alone deal with your customers: delivery, returns, refunds, warranties, invoices and taxes (including GST where it applies).</li>
          <li>Workshop hosts are responsible for the venue, safety, insurance and conduct of the session.</li>
          <li>Contact details you choose to share (phone, email, Instagram, website, WhatsApp) are public.</li>
        </ul>

        <h2>7. Your content and our licence</h2>
        <p>You keep ownership of what you upload. You give Craftofy a non-exclusive, worldwide, royalty-free licence to host, store, display, reproduce, resize and promote it on Craftofy and in our marketing (including social media), for as long as it is on the site and for a reasonable period afterwards. [Counsel to confirm scope and duration.]</p>

        <h2>8. Shoppers and attendees</h2>
        <ul>
          <li>Check the details with the maker or host before you pay. Craftofy does not hold your money and cannot refund it.</li>
          <li>When you reserve a workshop spot we pass your name, email and seat count to the host. A reservation is a request. Whether it is confirmed and on what terms is for the host to decide.</li>
          <li>Be honest and respectful when you contact makers and hosts.</li>
        </ul>

        <h2>9. Not allowed</h2>
        <ul>
          <li>Unlawful, fraudulent, misleading, hateful, harassing or adult content.</li>
          <li>Infringing someone’s intellectual property or privacy.</li>
          <li>Scraping, overloading, probing or attempting to break into the site, or using it to send spam.</li>
          <li>Pretending to be someone else, or using another person’s contact details without permission.</li>
        </ul>

        <h2>10. Our property</h2>
        <p>The Craftofy name, logo, illustrations, design and software belong to [LEGAL ENTITY NAME] or its licensors. You may not copy or reuse them without written permission. Listings, photos and text uploaded by makers and hosts belong to them, subject to section 7.</p>

        <h2>11. Reporting a problem</h2>
        <p>If you think a listing infringes your rights or breaks these terms, write to us at <a href={`mailto:${email}`}>{email}</a> with the page link, what is wrong, and your contact details. Our Grievance Officer is [NAME], [DESIGNATION], reachable at [EMAIL] and [ADDRESS]. We will acknowledge within [48 hours] and resolve within [one month]. [Counsel to align with the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the Consumer Protection (E-Commerce) Rules, 2020.]</p>

        <h2>12. Disclaimers</h2>
        <p>Craftofy is provided “as is” and “as available”. To the extent the law allows, we do not promise that the site will be uninterrupted or error free, or that any listing, maker, host, product or workshop is accurate, safe, lawful or fit for a purpose.</p>

        <h2>13. Limit of our liability</h2>
        <p>To the extent the law allows, Craftofy is not liable for any loss arising from a transaction or workshop between you and a maker or host, or for indirect or consequential loss. Our total liability to you for any claim about the site is limited to [AMOUNT, for example INR 1,000]. Nothing here limits liability that cannot be limited by law. [Counsel to confirm.]</p>

        <h2>14. Indemnity</h2>
        <p>If you are a maker or host, you will cover us for claims and costs arising from your listings, your content, your products or workshops, or your breach of these terms. [Counsel to confirm.]</p>

        <h2>15. Ending</h2>
        <p>You can stop using Craftofy at any time and ask us to deactivate your account. We may suspend or end your access as set out in section 4. Sections that by their nature should continue (content licence, our property, disclaimers, liability, indemnity, governing law) continue after that.</p>

        <h2>16. Changes</h2>
        <p>We may update these terms. The date at the top shows the latest version. If you keep using Craftofy after a change, you accept it. For material changes to makers and hosts we will [email or show a notice].</p>

        <h2>17. Law and courts</h2>
        <p>These terms are governed by the laws of India. The courts at [CITY], India have exclusive jurisdiction, subject to any right you have by law to go elsewhere. [Counsel to consider arbitration.]</p>

        <h2>18. Contact</h2>
        <p>Questions about these terms: <a href={`mailto:${email}`}>{email}</a>.</p>
      </InfoPage>
    </>
  );
}
