'use client';
import Link from 'next/link';
import { ArtistAvatar } from '@/components/ArtistAvatar';
import { TrackedLink } from '@/components/TrackedLink';
import type { GaContactMethod } from '@/lib/ga-events';
import { money } from '@/lib/money';
import { instagramHandle, instagramUrl, whatsappUrl, youtubeUrl } from '@/lib/social';
import type { TrackType } from '@/lib/track';
import type { Product } from '@/lib/types';

type Method = { key: GaContactMethod; label: string; href: string; type: TrackType; external?: boolean };

const WA_ICON = <path d="M3 21l1.65-4.9A9 9 0 1 1 8 19.4L3 21Zm5.5-11.2c.3 2.3 2.9 4.8 5.2 5.2l1.2-1.2-1.9-.9-.8.6c-.9-.3-1.8-1.2-2.1-2.1l.6-.8-.9-1.9-1.3 1.1Z" />;
const ICONS: Record<string, React.ReactNode> = {
  whatsapp: WA_ICON,
  call: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="18" cy="6" r="1" /></>,
  youtube: <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3V9Z" /></>,
};

/**
 * Product page: who made this and how to reach them. WhatsApp leads (a wa.me link that opens the buyer's own
 * WhatsApp with a message typed in: free for both sides); the other methods the maker shares follow as buttons.
 * Without WhatsApp or phone, the first shared method becomes the main button.
 */
export function MakerCard({ product: p }: { product: Product }) {
  const waNumber = p.whatsapp ?? p.phone;
  const message = `Hi ${p.seller}, I saw ${p.name} (${money(p.pricePaise)}) on Craftofy and I’m interested.`;
  const methods: Method[] = [
    ...(waNumber ? [{ key: 'whatsapp' as const, label: 'Message on WhatsApp', href: whatsappUrl(waNumber, message), type: 'contact' as const, external: true }] : []),
    ...(p.phone ? [{ key: 'call' as const, label: 'Call', href: `tel:${p.phone.replace(/[^\d+]/g, '')}`, type: 'contact_call' as const }] : []),
    ...(p.email ? [{ key: 'email' as const, label: 'Email', href: `mailto:${p.email}`, type: 'contact_email' as const }] : []),
    ...(p.instagram ? [{ key: 'instagram' as const, label: 'Instagram', href: instagramUrl(p.instagram), type: 'contact_instagram' as const, external: true }] : []),
    ...(p.youtube ? [{ key: 'youtube' as const, label: 'YouTube', href: youtubeUrl(p.youtube), type: 'contact_youtube' as const, external: true }] : []),
  ];
  const [main, ...rest] = methods;
  const link = (m: Method, className: string) => (
    <TrackedLink key={m.key} className={className} productId={p.id} sellerSlug={p.sellerSlug} method={m.key} type={m.type} href={m.href}
      {...(m.external ? { target: '_blank', rel: 'noreferrer' } : {})}>
      <svg className="maker-icon" viewBox="0 0 24 24" aria-hidden="true">{ICONS[m.key]}</svg>{m.label}
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
    <section className="maker-card" aria-label="About the maker">
      {p.sellerSlug ? <Link className="maker-head" href={`/artists/${p.sellerSlug}?from=${p.id}`}>{name}</Link> : <div className="maker-head">{name}</div>}
      {main ? (
        <>
          {link(main, 'button primary maker-main')}
          {rest.length > 0 && <div className="maker-chips">{rest.map(m => link(m, 'button maker-chip'))}</div>}
          {main.key === 'whatsapp' && <p className="maker-note">Your message will start with: “{message}”</p>}
        </>
      ) : <p className="maker-note">This artist has not shared contact details yet.</p>}
    </section>
  );
}
