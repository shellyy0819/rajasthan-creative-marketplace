'use client';
import { useId } from 'react';

const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';
const brand = (uid: string): Record<string, React.ReactNode> => ({
  whatsapp: <><circle cx="12" cy="12" r="12" fill="#25D366" /><path transform="translate(3.4 3.4) scale(.717)" fill="#fff" d={WA_PATH} /></>,
  whatsappOnGreen: <><circle cx="12" cy="12" r="12" fill="#fff" /><path transform="translate(3.4 3.4) scale(.717)" fill="#25D366" d={WA_PATH} /></>,
  email: <>
    <path fill="#4285F4" d="M2 7.6 5.5 10.2V19H3a1 1 0 0 1-1-1V7.6Z" />
    <path fill="#34A853" d="M22 7.6 18.5 10.2V19H21a1 1 0 0 0 1-1V7.6Z" />
    <path fill="#FBBC04" d="M18.5 5.4V10.2L22 7.6V6.2c0-1.7-1.9-2.6-3.3-1.6l-.2.2Z" />
    <path fill="#EA4335" d="M5.5 10.2V5.4L12 10.3l6.5-4.9v4.8L12 15.1 5.5 10.2Z" />
    <path fill="#C5221F" d="M2 6.2v1.4l3.5 2.6V5.4l-.2-.2C3.9 4.2 2 5.1 2 6.2Z" />
  </>,
  instagram: <>
    <defs><linearGradient id={`ig-${uid}`} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#FEDA75" /><stop offset=".25" stopColor="#FA7E1E" /><stop offset=".5" stopColor="#D62976" /><stop offset=".75" stopColor="#962FBF" /><stop offset="1" stopColor="#4F5BD5" /></linearGradient></defs>
    <rect width="24" height="24" rx="6" fill={`url(#ig-${uid})`} />
    <rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="1.7" />
    <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.7" />
    <circle cx="16.2" cy="7.8" r="1" fill="#fff" />
  </>,
  youtube: <><rect x="1" y="4.5" width="22" height="15" rx="4.5" fill="#FF0000" /><path d="m10 8.8 5.5 3.2-5.5 3.2V8.8Z" fill="#fff" /></>,
});
const CALL_ICON = <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />;

export type BrandName = 'whatsapp' | 'email' | 'instagram' | 'youtube';

/**
 * The real marks of the contact channels, shared by every page so a channel looks the same everywhere (product page, workshop cards and pages):
 * WhatsApp (green speech bubble on a white disc; `onGreen` swaps the colours so it reads on a green button), Gmail, Instagram, YouTube.
 * Decorative: the link or button carries the name. Give `size` for a fixed square, or a `className` to size it in CSS.
 */
export function BrandMark({ name, onGreen = false, size, className }: { name: BrandName; onGreen?: boolean; size?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const marks = brand(uid);
  return <svg className={className} {...(size ? { width: size, height: size } : {})} viewBox="0 0 24 24" aria-hidden="true">{marks[onGreen && name === 'whatsapp' ? 'whatsappOnGreen' : name]}</svg>;
}

/** The phone mark of the contact channels (a plain stroke icon in the text colour). */
export function CallMark({ size, className }: { size?: number; className?: string }) {
  return <svg className={className} {...(size ? { width: size, height: size } : {})} viewBox="0 0 24 24" aria-hidden="true">{CALL_ICON}</svg>;
}
