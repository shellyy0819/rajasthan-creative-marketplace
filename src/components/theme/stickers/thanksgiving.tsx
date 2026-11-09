import { quad, range, r2 } from './geom';

const LEAVES = ['var(--stk-red)', 'var(--stk-marigold)', '#B5532A', 'var(--stk-gold)'];
const leaf = (fill: string) => <path d="M0 -9C8 -6 8 4 0 10C-8 4 -8 -6 0 -9Z" fill={fill} />;

/** A string of autumn leaves across the top. */
export const TGarland = () => (
  <g>
    <path d="M0 16Q300 58 600 16" fill="none" stroke="var(--stall-wood-d)" strokeWidth="1.5" />
    {range(14, 1).map((i) => {
      const p = quad([0, 16], [300, 58], [600, 16], i / 15);
      return (
        <g key={i} transform={`translate(${p.x} ${r2(p.y + 12)}) rotate(${(i % 3) * 18 - 18})`}>
          <line x1="0" y1="-12" x2="0" y2="-8" stroke="var(--stall-wood-d)" strokeWidth="1" />
          {leaf(LEAVES[i % 4])}
        </g>
      );
    })}
  </g>
);

/** Three pumpkins on the ground. */
export const TPumpkins = () => (
  <g>
    {([[70, 686, 1], [122, 690, 0.8], [168, 686, 0.65]] as const).map(([x, y, sc], k) => (
      <g key={k} transform={`translate(${x} ${y}) scale(${sc})`}>
        <ellipse cx="0" cy="-14" rx="26" ry="18" fill="var(--stk-flame2)" stroke="#B5532A" strokeWidth="1.2" />
        <path d="M-9 -30Q-14 -14 -9 2M9 -30Q14 -14 9 2M0 -32V4" stroke="#B5532A" strokeWidth="1.2" fill="none" />
        <rect x="-3" y="-38" width="6" height="9" rx="2" fill="var(--stk-leaf)" />
      </g>
    ))}
  </g>
);

const SPOTS: [number, number, number][] = [[40, 110, 0], [120, 190, 40], [210, 130, -30], [300, 250, 20], [380, 160, 60], [470, 230, -20], [540, 120, 30], [90, 300, -50], [430, 320, 10]];

/** Leaves drifting down through the scene. */
export const TLeaves = () => (
  <g>
    {SPOTS.map(([x, y, rot], i) => (
      <g key={i} transform={`translate(${x} ${y}) rotate(${rot}) scale(1.1)`} opacity=".9">{leaf(LEAVES[i % 4])}</g>
    ))}
  </g>
);

/** A cartoon turkey: round body, fan of tail feathers, no face detail beyond a beak. */
export const TTurkey = () => (
  <g transform="translate(540 480)">
    {range(7).map((i) => {
      const a = ((i - 3) * 24 * Math.PI) / 180;
      return <ellipse key={i} cx={r2(Math.sin(a) * 18)} cy={r2(-14 - Math.cos(a) * 14)} rx="5.5" ry="13" transform={`rotate(${(i - 3) * 24} ${r2(Math.sin(a) * 18)} ${r2(-14 - Math.cos(a) * 14)})`} fill={LEAVES[i % 4]} />;
    })}
    <ellipse cx="0" cy="-2" rx="16" ry="13" fill="#8C5A32" />
    <circle cx="12" cy="-14" r="6" fill="#8C5A32" />
    <polygon points="17,-14 23,-12 17,-10" fill="var(--stk-gold)" />
    <circle cx="14" cy="-16" r="1.2" fill="#2A1D18" />
    <path d="M18 -8Q21 -3 18 0" stroke="var(--stk-red)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    <path d="M-4 10V16M4 10V16" stroke="var(--stk-gold)" strokeWidth="2" />
  </g>
);
