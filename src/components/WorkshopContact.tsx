import type { Workshop } from '@/lib/types';
import { instagramUrl } from '@/lib/social';
import type { WorkshopPlacement } from '@/lib/ga-events';
import { WorkshopTrackedLink } from './WorkshopTrackedLink';
import { ChannelIcon } from './class/ChannelIcon';

/** wa.me chat link with no prefilled text: the visitor writes to the instructor on their own WhatsApp. */
const whatsappChat = (number: string) => `https://wa.me/${number.replace(/\D/g, '')}`;
const safeWebsite = (u: string) => (/^https?:\/\//i.test(u) ? u : undefined);

/** How to reach the host of an online class: the public contact details only (never the private phone and email). */
export function WorkshopContact({ w, workshopId, category, contentType, placement }: { w: Pick<Workshop, 'whatsapp' | 'instagram' | 'website' | 'publicPhone'>; workshopId: string; category?: string; contentType: 'class' | 'workshop'; placement: WorkshopPlacement }) {
  const t = { workshopId, category, contentType, placement };
  const site = w.website ? safeWebsite(w.website) : undefined;
  if (!w.whatsapp && !w.instagram && !site && !w.publicPhone) return null;
  return (
    <span className="ws-contact">
      {w.publicPhone && <WorkshopTrackedLink {...t} method="call" className="button ws-icon ws-call" href={`tel:${w.publicPhone}`} aria-label={`Call ${w.publicPhone}`} title={`Call ${w.publicPhone}`}><ChannelIcon kind="call" size={26} /></WorkshopTrackedLink>}
      {/* Call, WhatsApp and Instagram are icon buttons (the name is the label for screen readers and the tooltip); Website keeps its word. */}
      {w.whatsapp && <WorkshopTrackedLink {...t} method="whatsapp" className="button ws-icon ws-whatsapp" href={whatsappChat(w.whatsapp)} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" title="Chat on WhatsApp"><ChannelIcon kind="whatsapp" size={26} /></WorkshopTrackedLink>}
      {w.instagram && <WorkshopTrackedLink {...t} method="instagram" className="button ws-icon ws-insta" href={instagramUrl(w.instagram)} target="_blank" rel="noopener noreferrer" aria-label="Open the instructor's Instagram" title="Open the instructor's Instagram"><ChannelIcon kind="instagram" size={26} /></WorkshopTrackedLink>}
      {site && <WorkshopTrackedLink {...t} method="website" className="button" href={site} target="_blank" rel="noopener noreferrer">Website</WorkshopTrackedLink>}
    </span>
  );
}
