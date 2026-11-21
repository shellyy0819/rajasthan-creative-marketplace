import type { ChannelKind } from '@/lib/class-page';
import { BrandMark } from '../BrandIcon';


/**
 * The marks of the contact channels (decorative: the link carries the name). WhatsApp and Instagram are the same brand marks the product pages use
 * (shared in BrandIcon); `onGreen` is for a green button, where WhatsApp swaps to a white disc so it still reads.
 */
export function ChannelIcon({ kind, size = 20, onGreen = false }: { kind: ChannelKind; size?: number; onGreen?: boolean }) {
  if (kind === 'whatsapp' || kind === 'instagram') return <BrandMark name={kind} size={size} onGreen={onGreen} />;
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  if (kind === 'call') return <svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
}
