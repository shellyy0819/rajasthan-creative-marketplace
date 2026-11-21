import type { ChannelKind } from '@/lib/class-page';
import { BrandMark, CallMark } from '../BrandIcon';


/**
 * The marks of the contact channels (decorative: the link carries the name). WhatsApp, Instagram and the phone are the same marks the product pages use
 * (shared in BrandIcon); `onGreen` is for a green button, where WhatsApp swaps to a white disc so it still reads.
 */
export function ChannelIcon({ kind, size = 20, onGreen = false }: { kind: ChannelKind; size?: number; onGreen?: boolean }) {
  if (kind === 'whatsapp' || kind === 'instagram') return <BrandMark name={kind} size={size} onGreen={onGreen} />;
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  if (kind === 'call') return <CallMark size={size} />;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
}
