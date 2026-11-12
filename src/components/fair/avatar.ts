import type { MakerLook } from '@/lib/fair-types';

type Face = { top: string; acc: string; skin: string; hair: string; long?: boolean; bun?: boolean };
/** A round head-and-shoulders portrait as SVG. Colours are CSS values, so makers use the design tokens and visitors use their own hex colours. */
/** A hex colour or one of our design-token variables; anything else is replaced, so no markup can get into the SVG text. */
const safe = (c: string) => (/^(#[0-9a-f]{3,8}|var\(--[a-z0-9-]+\))$/i.test(c) ? c : '#888888');
export const avatarSvg = (raw: Face) => { const c: Face = { ...raw, top: safe(raw.top), acc: safe(raw.acc), skin: safe(raw.skin), hair: safe(raw.hair) }; return `<svg viewBox="0 0 72 72" aria-hidden="true" focusable="false"><rect width="72" height="72" fill="var(--cream)"/>${c.long ? `<rect x="19" y="24" width="34" height="40" rx="12" fill="${c.hair}"/>` : ''}<path d="M8 72q2-18 28-18t28 18z" fill="${c.top}"/><path d="M18 72q6-14 24-14l6 14z" fill="${c.acc}" opacity=".9"/><rect x="31" y="46" width="10" height="10" fill="${c.skin}"/><circle cx="36" cy="34" r="16" fill="${c.skin}"/><path d="M20 32a16 16 0 0 1 32 0q-8-9-16-8t-16 8z" fill="${c.hair}"/>${c.bun ? `<circle cx="36" cy="14" r="7" fill="${c.hair}"/>` : ''}<circle cx="30" cy="36" r="1.8" fill="${c.hair}"/><circle cx="42" cy="36" r="1.8" fill="${c.hair}"/><path d="M30 42q6 5 12 0" fill="none" stroke="var(--stall-terra-d)" stroke-width="1.8" stroke-linecap="round"/></svg>`; };

const TOKEN: Record<string, string> = { orange: '--orange', green: '--green', indigo: '--stall-indigo', mustard: '--stall-mustard', sage: '--sage', chalk: '--stall-chalk' };
const v = (name: string) => `var(${TOKEN[name] ?? '--orange'})`;
export const makerAvatar = (l: MakerLook) => avatarSvg({ top: v(l.top), acc: v(l.acc), skin: l.skin === 'skin' ? 'var(--stall-skin)' : 'var(--stall-skin-2)', hair: 'var(--stall-hair)', long: l.long, bun: l.bun });
export const visitorAvatar = (c: { top: string; acc: string; skin: string; long: boolean }) => avatarSvg({ top: c.top, acc: c.acc, skin: c.skin, hair: '#2a211c', long: c.long });
