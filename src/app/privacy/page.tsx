import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { InfoPage } from '@/components/InfoPage';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { contactEmail } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy policy',
  description: 'What personal data Craftofy collects, why, who sees it and the choices you have.',
  path: '/privacy',
  noindex: true, // DRAFT: remove once a lawyer has approved the text
});

export const dynamic = 'force-dynamic'; // read CONTACT_EMAIL when the page is served

const crumbs = [{ name: 'Home', path: '/' }, { name: 'Privacy policy', path: '/privacy' }];

export default function PrivacyPage() {
  const email = contactEmail();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <InfoPage eyebrow="LEGAL" title="Privacy policy." intro="What we collect, why we collect it, who can see it and what you can do about it.">
        <p className="legal-draft"><b>DRAFT for legal review.</b> Not yet in force. Text in [square brackets] must be filled in or confirmed by counsel.</p>
        <p><small>Last updated: [DATE]</small></p>

        <h2>1. Who is responsible</h2>
        <p>[LEGAL ENTITY NAME], of [REGISTERED ADDRESS], India, runs Craftofy and decides how your personal data is used (the “data fiduciary” under India’s Digital Personal Data Protection Act, 2023). Contact: <a href={`mailto:${email}`}>{email}</a>. Grievance Officer: [NAME], [EMAIL].</p>

        <h2>2. What we collect</h2>
        <h3>If you only browse</h3>
        <ul>
          <li><b>Likes.</b> When you like a product we store the like against a random visitor ID kept in a cookie (<code>rr_vid</code>, one year) or, if you are signed in, against your email.</li>
          <li><b>Engagement counts.</b> We count views and contact taps on products and artist pages. The visitor is recorded as a one-way hash that changes every day. Your IP address and browser details are not stored and cannot be linked across days.</li>
          <li><b>Analytics, only if you agree.</b> If you accept the cookie banner, Google Analytics 4 receives page views and events such as likes and contact taps, with your IP address and device details, as set out in Google’s own policy. If you decline, it is not loaded.</li>
          <li><b>Your choices on your device.</b> Light or dark theme, cookie choice and whether you have seen the intro screen are saved in your browser only.</li>
        </ul>
        <h3>If you reserve a workshop spot</h3>
        <ul><li>Your name, email, number of seats and any note you add. We pass them to the host so they can reach you.</li></ul>
        <h3>If you are a maker or host</h3>
        <ul>
          <li><b>Account.</b> Your name and email from Google sign-in. We do not see your Google password.</li>
          <li><b>Profile.</b> Brand name, full name, mobile number, city, category, description, logo, Instagram, YouTube, website, WhatsApp and the contact options you choose.</li>
          <li><b>Listings.</b> Product and workshop details and photos.</li>
          <li><b>Public by design.</b> Your brand name, bio, city, logo, photos, and the contact details you choose to share (phone, email, Instagram, website, WhatsApp) are shown publicly. Your registration email is shown as your public email.</li>
        </ul>
        <h3>If you write to us</h3>
        <ul><li>Whatever you put in the email, including your name and contact details.</li></ul>

        <h2>3. Why we use it</h2>
        <ul>
          <li>To run the site: show listings, let you like, contact and reserve, and let makers manage their profile and products.</li>
          <li>To keep it safe: prevent abuse, spam and fraud, and apply our terms.</li>
          <li>To understand what is useful and improve Craftofy (counts always, analytics only with your consent).</li>
          <li>To contact you about your account, listings or reservations.</li>
          <li>To meet legal duties.</li>
        </ul>
        <p>[Counsel to confirm the lawful basis for each: consent, or the “legitimate uses” in sections 6 and 7 of the DPDP Act.]</p>

        <h2>4. Who sees or handles it</h2>
        <ul>
          <li><b>The public:</b> the maker and listing details described above.</li>
          <li><b>Workshop hosts:</b> the details of people who reserve their workshop.</li>
          <li><b>Service providers acting for us:</b> web hosting [Vercel Inc.], database hosting [PROVIDER AND REGION], image storage [Amazon Web Services, REGION], sign-in [Google], analytics [Google Analytics, if you consent], email [PROVIDER, if any].</li>
          <li><b>Authorities:</b> where the law or a valid order requires it.</li>
          <li>We do not sell your personal data.</li>
        </ul>
        <p>Some providers store data outside India. [Counsel to confirm cross-border transfer wording.]</p>

        <h2>5. Cookies and similar storage</h2>
        <ul>
          <li><code>rr_vid</code> (cookie, one year): visitor ID for likes.</li>
          <li>Sign-in session cookie (until you sign out or it expires): keeps makers signed in.</li>
          <li><code>rr_consent</code> (browser storage): remembers your analytics choice.</li>
          <li>Theme and intro-screen flags (browser storage): your display choices.</li>
          <li>Google Analytics cookies, only if you accept.</li>
        </ul>
        <p>You can change your analytics choice at any time. [Link to cookie settings, once the footer link is restored.]</p>

        <h2>6. How long we keep it</h2>
        <ul>
          <li>Maker and listing data: while the account is active, then [PERIOD] after deactivation or deletion.</li>
          <li>Workshop reservations: [PERIOD].</li>
          <li>Likes and engagement counts: [PERIOD].</li>
          <li>Emails to us: [PERIOD].</li>
          <li>Anything we must keep by law: for as long as the law requires.</li>
        </ul>

        <h2>7. Your rights</h2>
        <p>You can ask us to show you the personal data we hold about you, correct it, update it, or erase it, and you can withdraw your consent (for example to analytics) at any time. You can also nominate someone to exercise these rights for you. Write to <a href={`mailto:${email}`}>{email}</a>. We will reply within [PERIOD]. If you are not satisfied, contact our Grievance Officer, and then the Data Protection Board of India. Some maker profile details are public and may need to be removed by us at your request. Makers cannot edit a submitted profile themselves, so ask us to change it.</p>

        <h2>8. Security</h2>
        <p>We use reasonable safeguards, including encrypted connections and access limits, but no system is completely secure. Tell us at once if you think your account has been misused.</p>

        <h2>9. Children</h2>
        <p>Craftofy is not meant for under-18s, and makers and hosts must be adults. We do not knowingly collect data from children. [Counsel to confirm verifiable parental consent position under the DPDP Act.]</p>

        <h2>10. Changes</h2>
        <p>We will update this policy as needed. The date at the top shows the latest version. For significant changes we will [tell you by email or a notice on the site].</p>

        <h2>11. Contact</h2>
        <p>Privacy questions and requests: <a href={`mailto:${email}`}>{email}</a>.</p>
      </InfoPage>
    </>
  );
}
