/** Shown when a class has no photos: a rising sun behind a Rajasthani arch. For yoga, six people practise on mats in front of it. */
export function ClassIllustration({ title, yoga }: { title: string; yoga: boolean }) {
  const fig = (c: string) => ({ stroke: `var(${c})`, fill: 'none', strokeWidth: 9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });
  const head = (c: string, cx: number, cy: number, r: number) => <circle cx={cx} cy={cy} r={r} fill={`var(${c})`} stroke="none" />;
  return (
    <div className="cd-media">
      <div className="cd-art">
        <svg viewBox="0 0 400 420" width="100%" height="100%" role="img" aria-label={yoga ? `Illustration of six people practising yoga together on mats, in front of a rising sun and a Rajasthani arch (${title})` : `Illustration of a rising sun behind a Rajasthani arch (${title})`} preserveAspectRatio="xMidYMid slice">
          <rect width="400" height="420" fill="var(--cream)" />
          <circle cx="200" cy="196" r="128" fill="var(--orange)" opacity="0.25" />
          <circle cx="200" cy="196" r="98" fill="var(--orange)" opacity="0.5" />
          <circle cx="200" cy="196" r="68" fill="var(--orange)" />
          <path d="M40 420 V176 Q40 28 200 28 Q360 28 360 176 V420" fill="none" stroke="var(--green)" strokeWidth="10" />
          <path d="M72 420 V182 Q72 60 200 60 Q328 60 328 182 V420" fill="none" stroke="var(--green)" strokeWidth="3" opacity="0.55" />
          <path d="M0 314 Q100 298 200 308 T400 302 V420 H0Z" fill="var(--sand)" />
          {yoga && (
            <>
              <rect x="70" y="322" width="80" height="6" rx="3" fill="var(--sand-line)" /><rect x="165" y="322" width="80" height="6" rx="3" fill="var(--sand-line)" /><rect x="260" y="322" width="80" height="6" rx="3" fill="var(--sand-line)" />
              <g transform="translate(110 322) scale(0.72)" {...fig('--ink')}>{head('--ink', 0, -138, 10)}<path d="M0 -122 L0 -62" strokeWidth="18" /><path d="M0 -62 L0 0" strokeWidth="10" /><path d="M0 -62 L-26 -42 L-2 -30" /><path d="M-6 -118 L-10 -152 L0 -168 M6 -118 L10 -152 L0 -168" strokeWidth="6" /></g>
              <g transform="translate(205 322) scale(0.72)" {...fig('--stall-terra-d')}>{head('--stall-terra-d', 0, -138, 10)}<path d="M0 -122 L0 -64" strokeWidth="18" /><path d="M0 -64 L36 0 M0 -64 L-34 -46 L-34 0" strokeWidth="10" /><path d="M-52 -112 L52 -112" strokeWidth="6" /></g>
              <g transform="translate(300 322) scale(0.72)" {...fig('--stall-wood-d')}>{head('--stall-wood-d', 0, -138, 10)}<path d="M0 -122 L0 -64" strokeWidth="18" /><path d="M0 -64 L-8 0 M0 -64 L8 0" strokeWidth="10" /><path d="M-6 -118 L-20 -164 M6 -118 L20 -164" strokeWidth="6" /></g>
              <rect x="26" y="392" width="116" height="9" rx="4.5" fill="var(--green)" opacity="0.9" /><rect x="140" y="392" width="116" height="9" rx="4.5" fill="var(--green)" opacity="0.9" /><rect x="262" y="392" width="116" height="9" rx="4.5" fill="var(--green)" opacity="0.9" />
              <g transform="translate(84 392)" {...fig('--green-d')}>{head('--green-d', 0, -92, 11)}<path d="M0 -70 L0 -34" strokeWidth="22" /><path d="M-9 -64 Q-28 -48 -32 -28" /><path d="M9 -64 Q28 -48 32 -28" /><path d="M-40 -8 Q0 -30 40 -8 Q0 6 -40 -8Z" fill="var(--green-d)" strokeWidth="8" /></g>
              <g transform="translate(206 392)" {...fig('--stall-indigo')}>{head('--stall-indigo', -30, -18, 9)}<path d="M-56 0 L4 -70 L56 0" strokeWidth="10" /></g>
              <g transform="translate(328 392) scale(0.95)" {...fig('--chip-sand-ink')}><path d="M-8 -9 L34 -9" strokeWidth="12" /><ellipse cx="22" cy="-26" rx="15" ry="14" fill="var(--chip-sand-ink)" stroke="none" /><path d="M24 -32 Q-4 -42 -32 -24" strokeWidth="17" />{head('--chip-sand-ink', -44, -13, 9)}<path d="M-34 -14 L-84 -6" strokeWidth="6" /></g>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
