import Link from 'next/link';
import { EVERYDAY } from '@/lib/themes/presets';
import { fitText } from './theme/fit';

const D = EVERYDAY.config;

/** Wording that fits its slot is left exactly as drawn; only different wording is measured and, if it overflows, squeezed to fit. */
export function Fitted({ value, original, x, y, size, width, ...rest }: { value: string; original: string; x: number; y: number; size: number; width: number } & React.SVGProps<SVGTextElement>) {
  const f = value === original ? { text: value } : fitText(value, size, width);
  return <text x={x} y={y} fontSize={size} {...(f.textLength ? { textLength: f.textLength, lengthAdjust: 'spacingAndGlyphs' as const } : {})} {...rest}>{f.text}</text>;
}

/** The easel sign: a link when the admin gave it somewhere to go. The caller draws it only when it has words (hasChalkboard). */
export function StallBoard({ chalkLabel, chalkTitle, chalkSub, chalkHref }: { chalkLabel: string; chalkTitle: string; chalkSub: string; chalkHref?: string }) {
  const board = (
    <>
      <line x1="500" y1="586" x2="490" y2="660" strokeWidth="3" className="st-s-woodd"/><line x1="524" y1="586" x2="534" y2="660" strokeWidth="3" className="st-s-woodd"/>
      <rect x="480" y="548" width="64" height="44" rx="3" className="st-f-board"/>
      <rect x="480" y="548" width="64" height="44" rx="3" fill="none" strokeWidth="2" className="st-s-woodd"/>
      <Fitted value={chalkLabel.toUpperCase()} original={D.chalkLabel.toUpperCase()} x={512} y={562} size={6} width={54} textAnchor="middle" fontWeight="600" letterSpacing="1.5" className="st-t-mustard"/>
      <Fitted value={chalkTitle} original={D.chalkTitle} x={512} y={575} size={8} width={54} textAnchor="middle" fontWeight="600" className="st-t-chalk"/>
      <Fitted value={chalkSub} original={D.chalkSub} x={512} y={585} size={6.5} width={54} textAnchor="middle" className="st-t-chalk" opacity=".85"/>
    </>
  );
  if (!chalkHref) return <g>{board}</g>;
  const label = [chalkLabel, chalkTitle, chalkSub].filter(Boolean).join('. ');
  return chalkHref.startsWith('/')
    ? <Link href={chalkHref} className="st-board-link" aria-label={label}>{board}</Link>
    : <a href={chalkHref} className="st-board-link" aria-label={label} target="_blank" rel="noopener noreferrer">{board}</a>;
}

/** The turning "Made by hand · Made in India" stamp. The stall's <defs> must hold the path #st-badge-path. */
export function StallBadge() {
  return (
    <g transform="translate(550 92)">
      <circle r="38" className="st-f-chalk"/>
      <circle r="38" fill="none" strokeWidth="1" className="st-s-terrad" opacity=".5"/>
      <g className="st-spin">
        <text fontSize="7.5" fontWeight="600" letterSpacing="1.4" className="st-t-terrad">
          <textPath href="#st-badge-path" textLength="160">MADE BY HAND · MADE IN INDIA ·</textPath>
        </text>
      </g>
      <g className="st-f-terra">
        <circle r="4" cx="0" cy="-8"/><circle r="4" cx="8" cy="-2"/><circle r="4" cx="5" cy="7"/>
        <circle r="4" cx="-5" cy="7"/><circle r="4" cx="-8" cy="-2"/>
      </g>
      <circle r="3" className="st-f-mustard"/>
    </g>
  );
}
