import { quad, range, r2 } from './geom';

const FLAG_COLOURS = ['var(--stk-red)', 'var(--stk-gold)', 'var(--stk-leaf)', 'var(--stk-flame2)'];

/** Pennant garland strung across the top of the stall. */
export const GFlags = () => (
  <g>
    <path d="M0 18Q300 60 600 18" fill="none" stroke="var(--stall-wood-d)" strokeWidth="1.5" />
    {range(14, 1).map((i) => {
      const p = quad([0, 18], [300, 60], [600, 18], i / 15);
      return <polygon key={i} points={`${r2(p.x - 9)},${p.y} ${r2(p.x + 9)},${p.y} ${p.x},${r2(p.y + 20)}`} fill={FLAG_COLOURS[i % 4]} />;
    })}
  </g>
);

const GRAINS: [number, number][] = [[80, 474], [92, 466], [104, 474], [88, 456], [98, 452], [76, 482], [110, 482], [94, 480]];

/** A hill of grain and sweets, the annakut offering. */
export const GMound = () => (
  <g>
    <path d="M62 484Q92 420 122 484Z" fill="var(--stk-marigold2)" stroke="var(--stk-marigold)" strokeWidth="1.5" />
    {GRAINS.map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="3.2" fill={i % 2 ? 'var(--stk-flame2)' : 'var(--stk-snow)'} />
    ))}
    <line x1="92" y1="436" x2="92" y2="420" stroke="var(--stall-wood-d)" strokeWidth="1.5" />
    <polygon points="92,420 106,424 92,430" fill="var(--stk-red)" />
  </g>
);

/** A row of food bowls along the ground. */
export const GBowls = () => (
  <g>
    {range(5).map((i) => {
      const cx = 78 + i * 62;
      return (
        <g key={i}>
          <path d={`M${cx - 20} 670H${cx + 20}Q${cx + 17} 692 ${cx} 692Q${cx - 17} 692 ${cx - 20} 670Z`} fill="var(--stk-clay)" />
          <ellipse cx={cx} cy="670" rx="20" ry="4" fill="#8F3E1D" />
          <path d={`M${cx - 15} 670Q${cx} 650 ${cx + 15} 670Z`} fill={i % 2 ? 'var(--stk-marigold2)' : 'var(--stk-flame2)'} />
        </g>
      );
    })}
  </g>
);
