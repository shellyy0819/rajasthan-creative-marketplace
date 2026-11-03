import { quad, range, r2, starPoints } from './geom';

export const XSanta = () => (
  <g transform="translate(440 112) scale(1.1)">
    <path d="M-34 0C-36 -34 -26 -52 0 -52C26 -52 36 -34 34 0Z" fill="var(--stk-red)" />
    <rect x="-34" y="-4" width="68" height="6" rx="3" fill="var(--stk-snow)" />
    <rect x="-5" y="-52" width="10" height="48" fill="var(--stk-snow)" />
    <rect x="-34" y="-17" width="68" height="8" fill="#2B1B17" />
    <rect x="-7" y="-18" width="14" height="10" rx="1.5" fill="var(--stk-gold)" />
    <path d="M-28 -40L-34 -14" stroke="var(--stk-red)" strokeWidth="11" strokeLinecap="round" fill="none" />
    <circle cx="-34" cy="-12" r="5.5" fill="var(--stk-snow)" />
    <g className="wave2">
      <path d="M28 -44L46 -70" stroke="var(--stk-red)" strokeWidth="11" strokeLinecap="round" fill="none" />
      <circle cx="48" cy="-74" r="5.5" fill="var(--stk-snow)" />
    </g>
    <circle cx="0" cy="-62" r="14" fill="#E9B48E" />
    <circle cx="-5" cy="-66" r="1.4" fill="#2A1D18" />
    <circle cx="5" cy="-66" r="1.4" fill="#2A1D18" />
    <ellipse cx="0" cy="-51" rx="14" ry="12" fill="var(--stk-snow)" />
    <ellipse cx="-6.5" cy="-58" rx="6.5" ry="3.2" fill="var(--stk-snow)" />
    <ellipse cx="6.5" cy="-58" rx="6.5" ry="3.2" fill="var(--stk-snow)" />
    <circle cx="0" cy="-61" r="2.8" fill="#E58E7C" />
    <path d="M-16 -68C-15 -92 6 -101 23 -88C17 -86 14 -79 16 -68Z" fill="var(--stk-red)" />
    <ellipse cx="0" cy="-68" rx="17.5" ry="5" fill="var(--stk-snow)" />
    <circle cx="24" cy="-88" r="5.5" fill="var(--stk-snow)" />
  </g>
);

const BULBS = ['var(--stk-red)', 'var(--stk-pine2)', 'var(--stk-gold)', 'var(--stk-snow)'];

export const XLights = () => (
  <g>
    <path d="M0 18Q300 64 600 18" fill="none" stroke="var(--stk-pine)" strokeWidth="2" />
    {range(15, 1).map((n) => {
      const p = quad([0, 18], [300, 64], [600, 18], n / 16);
      return (
        <g key={n}>
          <line x1={p.x} y1={p.y} x2={p.x} y2={p.y + 6} stroke="var(--stk-pine)" strokeWidth="1" />
          <circle cx={p.x} cy={p.y + 11} r="9" fill={BULBS[n % 4]} opacity=".2" />
          <circle cx={p.x} cy={p.y + 11} r="4.2" fill={BULBS[n % 4]} stroke="var(--stk-ice)" strokeWidth=".6" />
        </g>
      );
    })}
  </g>
);

export const XStar = () => (
  <g>
    <line x1="300" y1="0" x2="300" y2="16" stroke="var(--stall-wood-d)" strokeWidth="1.5" />
    <circle cx="300" cy="38" r="28" fill="var(--stk-gold)" opacity=".22" />
    <polygon points={starPoints(300, 38, 10, 22, 9)} fill="var(--stk-gold)" stroke="#B8860B" strokeWidth="1" strokeLinejoin="round" />
  </g>
);

export const XWreath = () => (
  <g transform="translate(130 234)">
    {range(16).map((w) => {
      const a = (w * Math.PI) / 8, x = r2(Math.cos(a) * 19), y = r2(Math.sin(a) * 19);
      return <ellipse key={w} cx={x} cy={y} rx="10" ry="4.4" transform={`rotate(${w * 22.5 + 90} ${x} ${y})`} fill={w % 2 ? 'var(--stk-pine)' : 'var(--stk-pine2)'} />;
    })}
    {range(6).map((b) => (
      <circle key={b} cx={r2(Math.cos((b * Math.PI) / 3 + 0.4) * 19)} cy={r2(Math.sin((b * Math.PI) / 3 + 0.4) * 19)} r="2.6" fill="var(--stk-red)" />
    ))}
    <path d="M0 19L-12 29L-8 17ZM0 19L12 29L8 17Z" fill="var(--stk-red)" />
    <circle cx="0" cy="19" r="3.4" fill="#8F1D24" />
  </g>
);

const BAUBLES: [number, number, string][] = [
  [-10, -34, 'var(--stk-red)'], [14, -26, 'var(--stk-gold)'], [-22, -22, 'var(--stk-gold)'], [8, -56, 'var(--stk-red)'],
  [-12, -62, 'var(--stk-gold)'], [2, -92, 'var(--stk-red)'], [-5, -82, 'var(--stk-snow)'],
];

export const XTree = () => (
  <g transform="translate(34 596)">
    <rect x="-6" y="-14" width="12" height="14" fill="var(--stall-wood-d)" />
    <polygon points="0,-84 -34,-14 34,-14" fill="var(--stk-pine)" />
    <polygon points="0,-104 -27,-48 27,-48" fill="var(--stk-pine2)" />
    <polygon points="0,-122 -20,-76 20,-76" fill="var(--stk-pine)" />
    {BAUBLES.map(([x, y, fill]) => <circle key={`${x},${y}`} cx={x} cy={y} r="3.6" fill={fill} />)}
    <polygon points={starPoints(0, -126, 10, 8, 3.5)} fill="var(--stk-gold)" />
  </g>
);

export const XGifts = () => (
  <g transform="translate(90 478)">
    <rect x="-22" y="-18" width="24" height="18" fill="var(--stk-red)" />
    <path d="M-10 -18V0M-22 -9H2" stroke="var(--stk-gold)" strokeWidth="3" fill="none" />
    <rect x="4" y="-14" width="20" height="14" fill="var(--stk-pine2)" />
    <path d="M14 -14V0M4 -7H24" stroke="var(--stk-snow)" strokeWidth="2.5" fill="none" />
    <rect x="-15" y="-28" width="14" height="10" fill="var(--stk-gold)" />
    <path d="M-8 -28V-18M-15 -23H-1M-8 -28q-5-7-9-3q3 5 9 3M-8 -28q5-7 9-3q-3 5-9 3" stroke="var(--stk-red)" strokeWidth="1.8" fill="none" />
  </g>
);

export const XSnow = () => (
  <g>
    {range(18).map((f) => {
      const x = 24 + ((f * 97) % 550), y = 92 + ((f * 53) % 250), r = 5 + (f % 3) * 2.5;
      return (
        <g key={f} transform={`translate(${x} ${y})`} stroke="var(--stk-ice)" strokeWidth="1.5" strokeLinecap="round">
          {[0, 60, 120].map((d) => <line key={d} x1={-r} y1="0" x2={r} y2="0" transform={`rotate(${d})`} />)}
          <circle r="1.6" fill="var(--stk-snow)" stroke="none" />
        </g>
      );
    })}
  </g>
);
