import { range } from './geom';

/** A row of pillar candles on the counter. */
export const NCandles = () => (
  <g>
    {range(5).map((i) => {
      const x = 70 + i * 24, h = 18 + (i % 3) * 8;
      return (
        <g key={i}>
          <rect x={x - 5} y={484 - h} width="10" height={h} rx="2" fill="var(--stall-chalk)" stroke="var(--stk-gold)" strokeWidth=".8" />
          <g className="flame">
            <path d={`M${x} ${480 - h}C${x - 5} ${474 - h} ${x - 2} ${468 - h} ${x} ${462 - h}C${x + 2} ${468 - h} ${x + 5} ${474 - h} ${x} ${480 - h}Z`} fill="var(--stk-flame2)" />
          </g>
        </g>
      );
    })}
  </g>
);

/** Two hanging lamps, one longer than the other. */
export const NHanging = () => (
  <g>
    {([[150, 40], [190, 66]] as const).map(([x, len], k) => (
      <g key={k}>
        <line x1={x} y1="0" x2={x} y2={len} stroke="var(--stall-wood-d)" strokeWidth="1.5" />
        <circle cx={x} cy={len + 18} r="22" fill="var(--stk-flame)" opacity=".2" />
        <path d={`M${x - 12} ${len + 8}H${x + 12}L${x + 8} ${len + 30}H${x - 8}Z`} fill="var(--stk-gold)" stroke="#B8860B" strokeWidth="1" />
        <g className="flame">
          <path d={`M${x} ${len + 26}C${x - 5} ${len + 18} ${x - 2} ${len + 12} ${x} ${len + 4}C${x + 2} ${len + 12} ${x + 5} ${len + 18} ${x} ${len + 26}Z`} fill="var(--stk-flame2)" />
        </g>
      </g>
    ))}
  </g>
);

/** A bowl of sweet prasad with a leaf. */
export const NBowl = () => (
  <g transform="translate(88 472)">
    <path d="M-22 -4H22Q19 14 0 14Q-19 14 -22 -4Z" fill="var(--stk-gold)" stroke="#B8860B" strokeWidth="1" />
    <path d="M-17 -4Q0 -22 17 -4Z" fill="var(--stk-marigold2)" />
    {([[-8, -8], [2, -11], [9, -7]] as const).map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="1.6" fill="var(--stk-snow)" />
    ))}
  </g>
);
