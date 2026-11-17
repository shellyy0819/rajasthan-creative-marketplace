'use client';
import Link from 'next/link';
import { ArtistAvatar } from '@/components/ArtistAvatar';
import { TrackedLink } from '@/components/TrackedLink';
import type { GaContactMethod } from '@/lib/ga-events';
import { EmailMakerButton } from '@/components/EmailMakerButton';
import { productSlug } from '@/lib/catalog-shared';
import { enquiryMessage } from '@/lib/enquiry-message';
import { abs } from '@/lib/site';
import { instagramHandle, instagramUrl, whatsappUrl, youtubeUrl } from '@/lib/social';
import type { TrackType } from '@/lib/track';
import type { Product } from '@/lib/types';

type Method = { key: GaContactMethod; label: string; href: string; type: TrackType; external?: boolean; form?: boolean };

const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';
/** The real marks: WhatsApp (green speech bubble on a white disc, so it also reads on the green button), Gmail, Instagram, YouTube. */
const BRAND: Record<string, React.ReactNode> = {
  whatsapp: <><circle cx="12" cy="12" r="12" fill="#fff" /><path transform="translate(3.4 3.4) scale(.717)" fill="#25D366" d={WA_PATH} /></>,
  email: <>
    <path fill="#4285F4" d="M2 7.6 5.5 10.2V19H3a1 1 0 0 1-1-1V7.6Z" />
    <path fill="#34A853" d="M22 7.6 18.5 10.2V19H21a1 1 0 0 0 1-1V7.6Z" />
    <path fill="#FBBC04" d="M18.5 5.4V10.2L22 7.6V6.2c0-1.7-1.9-2.6-3.3-1.6l-.2.2Z" />
    <path fill="#EA4335" d="M5.5 10.2V5.4L12 10.3l6.5-4.9v4.8L12 15.1 5.5 10.2Z" />
    <path fill="#C5221F" d="M2 6.2v1.4l3.5 2.6V5.4l-.2-.2C3.9 4.2 2 5.1 2 6.2Z" />
  </>,
  instagram: <>
    <defs><linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#FEDA75" /><stop offset=".25" stopColor="#FA7E1E" /><stop offset=".5" stopColor="#D62976" /><stop offset=".75" stopColor="#962FBF" /><stop offset="1" stopColor="#4F5BD5" /></linearGradient></defs>
    <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
    <rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="1.7" />
    <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.7" />
    <circle cx="16.2" cy="7.8" r="1" fill="#fff" />
  </>,
  youtube: <><rect x="1" y="4.5" width="22" height="15" rx="4.5" fill="#FF0000" /><path d="m10 8.8 5.5 3.2-5.5 3.2V8.8Z" fill="#fff" /></>,
};
const CALL_ICON = <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />;
const icon = (key: string) => BRAND[key]
  ? <svg className="maker-brand" viewBox="0 0 24 24" aria-hidden="true">{BRAND[key]}</svg>
  : <svg className="maker-icon" viewBox="0 0 24 24" aria-hidden="true">{CALL_ICON}</svg>;

/**
 * Product page: who made this and how to reach them. WhatsApp leads (a wa.me link that opens the buyer's own
 * WhatsApp with a message typed in: free for both sides); the other methods the maker shares follow as buttons.
 * Without WhatsApp or phone, the first shared method becomes the main button.
 */
export function MakerCard({ product: p }: { product: Product }) {
  const waNumber = p.whatsapp ?? p.phone;
  const message = enquiryMessage(p);
  const productUrl = abs(`/products/${productSlug(p)}`);
  const waText = `${message}\n\n${productUrl}`; // WhatsApp turns the link into a preview card (name, price, maker) the maker can tap to see every photo
  const methods: Method[] = [
    ...(waNumber ? [{ key: 'whatsapp' as const, label: 'Message on WhatsApp', href: whatsappUrl(waNumber, waText), type: 'contact' as const, external: true }] : []),
    ...(p.phone ? [{ key: 'call' as const, label: 'Call', href: `tel:${p.phone.replace(/[^\d+]/g, '')}`, type: 'contact_call' as const }] : []),
    ...(p.email ? [{ key: 'email' as const, label: 'Email', href: `mailto:${p.email}`, type: 'contact_email' as const, form: true }] : []),
    ...(p.instagram ? [{ key: 'instagram' as const, label: 'Instagram', href: instagramUrl(p.instagram), type: 'contact_instagram' as const, external: true }] : []),
    ...(p.youtube ? [{ key: 'youtube' as const, label: 'YouTube', href: youtubeUrl(p.youtube), type: 'contact_youtube' as const, external: true }] : []),
  ];
  const [main, ...rest] = methods;
  const link = (m: Method, className: string) => m.form ? (
    <EmailMakerButton key={m.key} product={p} className={className} icon={icon(m.key)}>{m.label}</EmailMakerButton>
  ) : (
    <TrackedLink key={m.key} className={className} productId={p.id} sellerSlug={p.sellerSlug} method={m.key} type={m.type} href={m.href}
      {...(m.external ? { target: '_blank', rel: 'noreferrer' } : {})}>
      {icon(m.key)}{m.label}
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
    <section className={`maker-card${rest.length <= 2 ? ' compact' : ''}`} aria-label="About the maker">
      {p.sellerSlug ? <Link className="maker-head" href={`/artists/${p.sellerSlug}?from=${p.id}`}>{name}</Link> : <div className="maker-head">{name}</div>}
      {p.artistBio && <p className="maker-bio">{p.artistBio}</p>}
      {main ? (
        <>
          <div className="maker-actions">
            {link(main, 'button primary maker-main')}
            {rest.length > 0 && <div className="maker-chips">{rest.map(m => link(m, 'button maker-chip'))}</div>}
          </div>
          {main.key === 'whatsapp' && <p className="maker-note">Your message will start with: “{message}” and include a link to this product.</p>}
        </>
      ) : <p className="maker-note">This artist has not shared contact details yet.</p>}
    </section>
  );
}
