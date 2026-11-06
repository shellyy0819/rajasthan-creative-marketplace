import { DIYA_ID } from './dhanteras';
import { range, r2, starPoints } from './geom';

const FIRE = ['var(--stk-gold)', 'var(--stk-flame2)', '#E64A8A'];
const BURSTS: [number, number, number][] = [[86, 92, 30], [160, 38, 20], [452, 50, 26]];

export const DFire = () => (
  <g>
    {BURSTS.map(([cx, cy, r], bi) => (
      <g key={bi}>
        {range(12).map((i) => {
          const a = (i * Math.PI) / 6, c = Math.cos(a), s = Math.sin(a);
          return (
            <g key={i}>
              <line x1={r2(cx + c * r * 0.45)} y1={r2(cy + s * r * 0.45)} x2={r2(cx + c * r)} y2={r2(cy + s * r)} stroke={FIRE[(i + bi) % 3]} strokeWidth="2" strokeLinecap="round" />
              <circle cx={r2(cx + c * r * 1.18)} cy={r2(cy + s * r * 1.18)} r="1.8" fill={FIRE[(i + bi + 1) % 3]} />
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="3" fill="var(--stk-snow)" />
      </g>
    ))}
  </g>
);

export const DKandil = () => (
  <g>
    <line x1="440" y1="0" x2="440" y2="34" stroke="var(--stall-wood-d)" strokeWidth="1.5" />
    <circle cx="440" cy="62" r="36" fill="var(--stk-flame)" opacity=".2" />
    <polygon points={starPoints(440, 62, 16, 28, 13)} fill="var(--stk-flame2)" stroke="var(--stk-gold)" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="440" cy="62" r="8" fill="var(--stk-flame)" />
    <path d="M432 90L428 118M440 90V122M448 90L452 118" stroke="var(--stk-gold)" strokeWidth="2" strokeLinecap="round" fill="none" />
  </g>
);

const STRANDS = [91, 149, 207, 265, 323, 381, 439, 497];
const LENS = [70, 50, 82, 60, 76, 54, 86, 66];

export const DLights = () => (
  <g>
    {STRANDS.map((x, i) => {
      const y0 = 233, len = LENS[i];
      const ys = range(Math.floor((len - 12) / 14) + 1).map((n) => y0 + 12 + n * 14);
      return (
        <g key={x}>
          <line x1={x} y1={y0} x2={x} y2={y0 + len} stroke="var(--stk-gold)" strokeWidth="1.2" />
          {ys.map((y) => (
            <g key={y}>
              <circle cx={x} cy={y} r="7" fill="var(--stk-flame)" opacity=".22" />
              <circle cx={x} cy={y} r="3.4" fill={Math.round(y / 14) % 2 ? 'var(--stk-flame2)' : 'var(--stk-flame)'} />
            </g>
          ))}
        </g>
      );
    })}
  </g>
);

export const DThali = () => (
  <g transform="translate(88 472)">
    <ellipse cx="0" cy="4" rx="25" ry="6.5" fill="var(--stk-gold)" stroke="#B8860B" strokeWidth="1" />
    {([[-13, 0], [-4, -2], [6, 0], [15, -1], [-8, 5], [4, 5]] as const).map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="5" fill={i % 2 ? 'var(--stk-flame2)' : 'var(--stk-marigold)'} />
    ))}
    <circle cx="0" cy="-3" r="2.2" fill="var(--stk-red)" />
  </g>
);

export const DDiyas = () => (
  <g>
    {[72, 152, 232, 312, 392, 472].map((x) => (
      <use key={x} href={`#${DIYA_ID}`} transform={`translate(${x} 684) scale(.85)`} />
    ))}
  </g>
);

export const DRangoli = () => (
  <g transform="translate(562 690) scale(1 .36)">
    <circle r="36" fill="var(--stall-chalk)" opacity=".9" />
    {range(8).map((q) => {
      const a = (q * Math.PI) / 4, x = r2(Math.cos(a) * 22), y = r2(Math.sin(a) * 22);
      return <ellipse key={q} cx={x} cy={y} rx="8" ry="15" transform={`rotate(${q * 45 + 90} ${x} ${y})`} fill={q % 2 ? '#E64A8A' : 'var(--stk-flame2)'} />;
    })}
    <circle r="11" fill="var(--stk-gold)" />
    <circle r="4" fill="#7A1F5C" />
  </g>
);
