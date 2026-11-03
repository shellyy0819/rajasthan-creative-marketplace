import { quad, range, r2, starPoints } from './geom';

/** The diya drawn once at the origin; `diya1`, `diya2` and the Diwali row `<use>` it (defined once by StickerLayer). */
export const DIYA_ID = 'stk-diya-shape';
export function DiyaDefs() {
  return (
    <defs>
      <g id={DIYA_ID}>
        <circle cx="0" cy="-8" r="15" fill="var(--stk-flame)" opacity=".28" />
        <path d="M-13 -3H13Q11 9 0 9Q-11 9 -13 -3Z" fill="var(--stk-clay)" />
        <ellipse cx="0" cy="-3" rx="13" ry="3.2" fill="#8F3E1D" />
        <g className="flame">
          <path d="M0 -4C-6 -11 -2 -17 0 -24C2 -17 6 -11 0 -4Z" fill="var(--stk-flame2)" />
          <path d="M0 -5C-3 -9 -1 -13 0 -17C1 -13 3 -9 0 -5Z" fill="var(--stk-flame)" />
        </g>
      </g>
    </defs>
  );
}

export const Lights = () => (
  <g>
    <path d="M0 18Q300 64 600 18" fill="none" stroke="var(--stall-wood-d)" strokeWidth="1.5" />
    {range(15, 1).map((i) => {
      const p = quad([0, 18], [300, 64], [600, 18], i / 16);
      return (
        <g key={i}>
          <line x1={p.x} y1={p.y} x2={p.x} y2={p.y + 6} stroke="var(--stall-wood-d)" strokeWidth="1" />
          <circle cx={p.x} cy={p.y + 11} r="9" fill="var(--stk-flame)" opacity=".22" />
          <circle cx={p.x} cy={p.y + 11} r="4.2" fill={i % 3 === 0 ? 'var(--stk-flame2)' : 'var(--stk-flame)'} />
        </g>
      );
    })}
  </g>
);

export const Toran = () => (
  <g>
    <path d="M70 210Q294 266 518 210" fill="none" stroke="var(--stk-leaf)" strokeWidth="3" />
    {range(12, 1).map((j) => {
      const q = quad([70, 210], [294, 266], [518, 210], j / 13);
      return (
        <g key={j}>
          <path d={`M${q.x} ${r2(q.y + 2)}q-9 6 -6 16q6 -4 6 -16z`} fill="var(--stk-leaf)" />
          <g transform={`translate(${q.x} ${r2(q.y + 6)})`}>
            {range(6).map((a) => (
              <circle key={a} cx={r2(Math.cos((a * Math.PI) / 3) * 5.2)} cy={r2(Math.sin((a * Math.PI) / 3) * 5.2)} r="4.4" fill={j % 2 ? 'var(--stk-marigold)' : 'var(--stk-marigold2)'} />
            ))}
            <circle r="3" fill="var(--stk-red)" />
          </g>
        </g>
      );
    })}
  </g>
);

export const Lantern = () => (
  <g>
    <line x1="46" y1="22" x2="46" y2="42" stroke="var(--stall-wood-d)" strokeWidth="1.5" />
    <polygon points={starPoints(46, 64, 16, 22, 11)} fill="var(--stk-red)" stroke="var(--stk-gold)" strokeWidth="1.5" />
    <circle cx="46" cy="64" r="6" fill="var(--stk-flame)" />
    <path d="M46 86v10M42 96h8" stroke="var(--stk-gold)" strokeWidth="2" fill="none" />
  </g>
);

export const Rangoli = () => (
  <g transform="translate(92 690) scale(1 .34)">
    <circle r="60" fill="var(--stall-chalk)" opacity=".9" />
    {range(12).map((k) => {
      const a = (k * Math.PI) / 6, x = r2(Math.cos(a) * 40), y = r2(Math.sin(a) * 40);
      return <ellipse key={k} cx={x} cy={y} rx="9" ry="16" transform={`rotate(${k * 30 + 90} ${x} ${y})`} fill={k % 2 ? 'var(--stk-marigold)' : 'var(--stk-red)'} />;
    })}
    <circle r="22" fill="var(--stk-gold)" />
    {range(8).map((m) => (
      <circle key={m} cx={r2(Math.cos((m * Math.PI) / 4) * 14)} cy={r2(Math.sin((m * Math.PI) / 4) * 14)} r="3.4" fill={m % 2 ? 'var(--stk-red)' : 'var(--stall-chalk)'} />
    ))}
    <circle r="5" fill="var(--stk-red)" />
  </g>
);

export const Kalash = () => (
  <g transform="translate(30 662)">
    <path d="M-17 -26C-26 -10 -22 2 -10 2H10C22 2 26 -10 17 -26Z" fill="var(--stk-gold)" />
    <path d="M-8 -26H8L10 -34H-10Z" fill="var(--stk-gold)" />
    <path d="M-19 -12H19" stroke="var(--stk-red)" strokeWidth="3" fill="none" />
    <path d="M-10 -34Q-24 -48 -14 -56Q-4 -44 -6 -34ZM10 -34Q24 -48 14 -56Q4 -44 6 -34ZM0 -34Q-6 -52 0 -60Q6 -52 0 -34Z" fill="var(--stk-leaf)" />
    <circle cx="0" cy="-44" r="9" fill="var(--stk-clay)" />
    <circle cx="0" cy="-44" r="3" fill="var(--stk-flame)" />
  </g>
);

export const Diya1 = () => <use href={`#${DIYA_ID}`} x="92" y="474" />;
export const Diya2 = () => <use href={`#${DIYA_ID}`} x="480" y="408" />;
