'use client';
import Link from 'next/link';
import { ArtistAvatar } from '@/components/ArtistAvatar';
import { BrandMark, CallMark, type BrandName } from '@/components/BrandIcon';
import { TrackedLink } from '@/components/TrackedLink';
import type { GaContactMethod } from '@/lib/ga-events';
import { EmailMakerButton } from '@/components/EmailMakerButton';
import { InstagramMessageButton } from '@/components/InstagramMessageButton';
import { enquiryMessage } from '@/lib/enquiry-message';
import { instagramHandle, instagramUrl, whatsappUrl, youtubeUrl } from '@/lib/social';
import type { TrackType } from '@/lib/track';
import type { Product } from '@/lib/types';

type Method = { key: GaContactMethod; label: string; href: string; type: TrackType; external?: boolean; form?: boolean };

const BRAND_NAMES = ['whatsapp', 'email', 'instagram', 'youtube'];
const icon = (key: string, onGreen = false) => BRAND_NAMES.includes(key)
  ? <BrandMark name={key as BrandName} onGreen={onGreen} className="maker-brand" />
  : <CallMark className="maker-icon" />;

/**
 * Product page: who made this and how to reach them. WhatsApp leads (a wa.me link that opens the buyer's own
 * WhatsApp with a message typed in: free for both sides); the other methods the maker shares follow as buttons.
 * Without WhatsApp or phone, the first shared method becomes the main button.
 */
/** `productUrl` is the product page's full public address. The page (a server component) builds it, because the browser bundle may not know the site's address. */
export function MakerCard({ product: p, productUrl }: { product: Product; productUrl: string }) {
  const waNumber = p.whatsapp ?? p.phone;
  const message = enquiryMessage(p);
  const waText = `${message}\n\n${productUrl}`; // WhatsApp turns the link into a preview card (name, price, maker) the maker can tap to see every photo
  const methods: Method[] = [
    ...(waNumber ? [{ key: 'whatsapp' as const, label: 'WhatsApp', href: whatsappUrl(waNumber, waText), type: 'contact' as const, external: true }] : []),
    ...(p.phone ? [{ key: 'call' as const, label: 'Call', href: `tel:${p.phone.replace(/[^\d+]/g, '')}`, type: 'contact_call' as const }] : []),
    ...(p.email ? [{ key: 'email' as const, label: 'Email', href: `mailto:${p.email}`, type: 'contact_email' as const, form: true }] : []),
    ...(p.instagram ? [{ key: 'instagram' as const, label: 'Instagram', href: instagramUrl(p.instagram), type: 'contact_instagram' as const, external: true, form: true }] : []),
    ...(p.youtube ? [{ key: 'youtube' as const, label: 'YouTube', href: youtubeUrl(p.youtube), type: 'contact_youtube' as const, external: true }] : []),
  ];
  const [main, ...rest] = methods;
  const compact = rest.length <= 2;
  const link = (m: Method, className: string, onGreen = false) => m.form && m.key === 'instagram' ? (
    <InstagramMessageButton key={m.key} product={p} productUrl={productUrl} className={className} icon={icon(m.key, onGreen)}><span className="maker-label">{m.label}</span></InstagramMessageButton>
  ) : m.form ? (
    <EmailMakerButton key={m.key} product={p} className={className} icon={icon(m.key, onGreen)}><span className="maker-label">{m.label}</span></EmailMakerButton>
  ) : (
    <TrackedLink key={m.key} className={className} productId={p.id} sellerSlug={p.sellerSlug} category={p.category} method={m.key} type={m.type} href={m.href}
      {...(m.external ? { target: '_blank', rel: 'noreferrer' } : {})}>
      {icon(m.key, onGreen)}<span className="maker-label">{m.label}</span>
    </TrackedLink>
  );
  const name = (
    <>
      <span className="maker-avatar" aria-hidden="true"><ArtistAvatar key={p.sellerLogo ?? 'none'} src={p.sellerLogo} initial={p.seller.trim().charAt(0).toUpperCase()} /></span>
      <span className="maker-who">
        <span className="maker-eyebrow">Made by</span>
        <span className="maker-name">{p.seller}</span>
        {p.artistCity && <span className="maker-city">{p.artistCity}, Rajasthan</span>}
      </span>
    </>
  );
  return (
    <section className={`maker-card${compact ? ' compact' : ''}`} aria-label="About the maker">
      {p.sellerSlug ? <Link className="maker-head" href={`/artists/${p.sellerSlug}?from=${p.id}`}>{name}</Link> : <div className="maker-head">{name}</div>}
      {p.artistBio && <p className="maker-bio">{p.artistBio}</p>}
      {main ? (
        <>
          {/* Phones only (CSS): a heading, then the methods as icons. The words stay in the page for screen readers. */}
          <h2 className="maker-contact-h">Contact via</h2>
          <div className="maker-actions">
            {compact ? link(main, 'button maker-chip') : link(main, 'button primary maker-main', true)}
            {rest.length > 0 && <div className="maker-chips">{rest.map(m => link(m, 'button maker-chip'))}</div>}
          </div>
          {main.key === 'whatsapp' && <p className="maker-note">Your message will start with: “{message}” and include a link to this product.</p>}
        </>
      ) : <p className="maker-note">This artist has not shared contact details yet.</p>}
    </section>
  );
}
