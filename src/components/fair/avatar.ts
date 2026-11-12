import type { Character } from '@/lib/fair-characters';
import type { MakerLook } from '@/lib/fair-types';

type Face = {
  top: string; acc: string; skin: string; hair: string;
  /** Makers: long hair and a bun. Visitors use `style` instead. */
  long?: boolean; bun?: boolean; style?: Character['hairStyle'];
  headwear?: Character['headwear']; beard?: boolean; bindi?: boolean;
};
/** A hex colour or one of our design-token variables; anything else is replaced, so no markup can get into the SVG text. */
const safe = (c: string) => (/^(#[0-9a-f]{3,8}|var\(--[a-z0-9-]+\))$/i.test(c) ? c : '#888888');

/** A round head-and-shoulders portrait as SVG. Colours are CSS values, so makers use the design tokens and visitors use their own hex colours. */
export const avatarSvg = (raw: Face) => {
  const c = { ...raw, top: safe(raw.top), acc: safe(raw.acc), skin: safe(raw.skin), hair: safe(raw.hair) };
  const long = c.long || c.style === 'long', bun = c.bun || c.style === 'bun', bob = c.style === 'bob', braid = c.style === 'braid';
  const hw = c.headwear ? { kind: c.headwear.kind, color: safe(c.headwear.color) } : null;
  return `<svg viewBox="0 0 72 72" aria-hidden="true" focusable="false"><rect width="72" height="72" fill="var(--cream)"/>`
    + (long ? `<rect x="19" y="24" width="34" height="40" rx="12" fill="${c.hair}"/>` : '')
    + (bob ? `<rect x="19" y="24" width="34" height="26" rx="11" fill="${c.hair}"/>` : '')
    + (braid ? `<rect x="49" y="38" width="8" height="30" rx="4" fill="${c.hair}"/><circle cx="53" cy="62" r="3" fill="#c66b43"/>` : '')
    + `<path d="M8 72q2-18 28-18t28 18z" fill="${c.top}"/><path d="M18 72q6-14 24-14l6 14z" fill="${c.acc}" opacity=".9"/><rect x="31" y="46" width="10" height="10" fill="${c.skin}"/><circle cx="36" cy="34" r="16" fill="${c.skin}"/>`
    + (c.beard ? `<path d="M21 36q15 24 30 0q-15 9-30 0z" fill="${c.hair}"/>` : '')
    + `<path d="M20 32a16 16 0 0 1 32 0q-8-9-16-8t-16 8z" fill="${c.hair}"/>`
    + (bun ? `<circle cx="36" cy="14" r="7" fill="${c.hair}"/>` : '')
    + (hw?.kind === 'pagdi' ? `<ellipse cx="36" cy="19" rx="19" ry="12" fill="${hw.color}"/><rect x="17" y="21" width="38" height="6" rx="3" fill="${hw.color}"/><path d="M19 24q17 6 34 0M22 17q14-6 28 0" stroke="rgba(0,0,0,.28)" stroke-width="1.6" fill="none"/><circle cx="36" cy="17" r="2.6" fill="#fbf7ef"/>` : '')
    + (hw?.kind === 'cap' ? `<path d="M19 27a17 17 0 0 1 34 0z" fill="${hw.color}"/><rect x="17" y="25" width="38" height="4" rx="2" fill="rgba(0,0,0,.28)"/>` : '')
    + (c.bindi ? `<circle cx="36" cy="26" r="1.8" fill="#b3262e"/>` : '')
    + `<circle cx="30" cy="36" r="1.8" fill="${c.hair}"/><circle cx="42" cy="36" r="1.8" fill="${c.hair}"/>`
    + (c.beard ? `<path d="M29 43q7-3 14 0" stroke="${c.hair}" stroke-width="2" fill="none" stroke-linecap="round"/>` : `<path d="M30 42q6 5 12 0" fill="none" stroke="var(--stall-terra-d)" stroke-width="1.8" stroke-linecap="round"/>`)
    + `</svg>`;
};

const TOKEN: Record<string, string> = { orange: '--orange', green: '--green', indigo: '--stall-indigo', mustard: '--stall-mustard', sage: '--sage', chalk: '--stall-chalk' };
const v = (name: string) => `var(${TOKEN[name] ?? '--orange'})`;
export const makerAvatar = (l: MakerLook) => avatarSvg({ top: v(l.top), acc: v(l.acc), skin: l.skin === 'skin' ? 'var(--stall-skin)' : 'var(--stall-skin-2)', hair: 'var(--stall-hair)', long: l.long, bun: l.bun });
export const visitorAvatar = (c: Character) => avatarSvg({ top: c.top, acc: c.acc, skin: c.skin, hair: '#2a211c', style: c.hairStyle, headwear: c.headwear, beard: c.beard, bindi: c.bindi });
