import type { Workshop } from '@/lib/types';
import { instagramUrl } from '@/lib/social';

/** wa.me chat link with no prefilled text: the visitor writes to the instructor on their own WhatsApp. */
const whatsappChat = (number: string) => `https://wa.me/${number.replace(/\D/g, '')}`;
const safeWebsite = (u: string) => (/^https:\/\//i.test(u) ? u : undefined);

/** How to reach the host of an online class: the public contact details only (never the private phone and email). */
export function WorkshopContact({ w }: { w: Pick<Workshop, 'whatsapp' | 'instagram' | 'website'> }) {
  const site = w.website ? safeWebsite(w.website) : undefined;
  if (!w.whatsapp && !w.instagram && !site) return null;
  return (
    <span className="ws-contact">
      {w.whatsapp && <a className="button" href={whatsappChat(w.whatsapp)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
      {w.instagram && <a className="button" href={instagramUrl(w.instagram)} target="_blank" rel="noopener noreferrer">Instagram</a>}
      {site && <a className="button" href={site} target="_blank" rel="noopener noreferrer">Website</a>}
    </span>
  );
}
