import { quad, range, r2 } from './geom';

/** A tika plate with a kumkum dot, rice grains and a small diya. */
export const BTika = () => (
  <g transform="translate(88 472)">
    <ellipse cx="0" cy="4" rx="26" ry="7" fill="var(--stk-gold)" stroke="#B8860B" strokeWidth="1" />
    <ellipse cx="0" cy="2" rx="21" ry="4.5" fill="var(--stall-chalk)" />
    <circle cx="-8" cy="1" r="3.4" fill="var(--stk-red)" />
    {([[2, 0], [7, 2], [12, 0], [5, 4], [-1, 3]] as const).map(([x, y], i) => (
      <ellipse key={i} cx={x} cy={y} rx="1.8" ry=".9" fill="var(--stk-snow)" />
    ))}
    <g transform="translate(16 -2) scale(.4)">
      <path d="M-13 -3H13Q11 9 0 9Q-11 9 -13 -3Z" fill="var(--stk-clay)" />
      <g className="flame">
        <path d="M0 -4C-6 -11 -2 -17 0 -24C2 -17 6 -11 0 -4Z" fill="var(--stk-flame2)" />
      </g>
    </g>
  </g>
);

const BOX_COLOURS = ['var(--stk-marigold)', 'var(--stk-flame2)', 'var(--stk-marigold2)'];

/** An open box of laddus. */
export const BSweets = () => (
  <g>
    <rect x="456" y="396" width="52" height="24" rx="3" fill="var(--stk-red)" />
    <rect x="452" y="392" width="60" height="8" rx="2" fill="var(--stk-gold)" />
    {range(3).map((i) => (
      <circle key={i} cx={470 + i * 16} cy="388" r="8" fill={BOX_COLOURS[i]} stroke="#B8860B" strokeWidth=".8" />
    ))}
    <path d="M456 408H508" stroke="var(--stk-gold)" strokeWidth="1.5" />
  </g>
);

/** A hanging strand of marigolds and thread tassels across the top. */
export const BThread = () => (
  <g>
    <path d="M0 14Q300 52 600 14" fill="none" stroke="var(--stk-red)" strokeWidth="2" />
    {range(13, 1).map((i) => {
      const p = quad([0, 14], [300, 52], [600, 14], i / 14);
      return (
        <g key={i}>
          <line x1={p.x} y1={p.y} x2={p.x} y2={r2(p.y + 14)} stroke="var(--stk-gold)" strokeWidth="1.2" />
          <circle cx={p.x} cy={r2(p.y + 18)} r="4.6" fill={i % 2 ? 'var(--stk-marigold)' : 'var(--stk-flame2)'} />
          <circle cx={p.x} cy={r2(p.y + 18)} r="1.6" fill="var(--stk-red)" />
        </g>
      );
    })}
  </g>
);
