import { range, r2 } from './geom';

/** A woven soop basket heaped with fruit, the arghya offering. */
export const CSoop = () => (
  <g transform="translate(92 468)">
    <ellipse cx="0" cy="-4" rx="30" ry="6" fill="#D9A55B" />
    <circle cx="-14" cy="-10" r="7" fill="var(--stk-flame2)" />
    <circle cx="-2" cy="-14" r="7" fill="var(--stk-red)" />
    <circle cx="10" cy="-10" r="6.5" fill="var(--stk-marigold2)" />
    <path d="M14 -8Q26 -16 28 -6Q20 -6 14 -8Z" fill="var(--stk-leaf)" />
    <path d="M-30 -4H30Q26 14 0 14Q-26 14 -30 -4Z" fill="#C48A3F" stroke="#8A5A1F" strokeWidth="1" />
    {range(4).map((i) => (
      <path key={i} d={`M${-22 + i * 14} -2L${-18 + i * 12} 12`} stroke="#8A5A1F" strokeWidth="1" />
    ))}
  </g>
);

/** Three tall sugarcane stalks. */
export const CCane = () => (
  <g>
    {[[16, 6], [32, 0], [48, -6]].map(([x, tilt], k) => (
      <g key={k}>
        <line x1={x} y1="668" x2={x + tilt} y2="526" stroke="#7A3E5A" strokeWidth="7" strokeLinecap="round" />
        {range(6).map((j) => (
          <line key={j} x1={r2(x + tilt * (j / 7) - 4)} y1={660 - j * 22} x2={r2(x + tilt * (j / 7) + 4)} y2={660 - j * 22} stroke="#4F2339" strokeWidth="1.4" />
        ))}
        <path d={`M${x + tilt} 528Q${x + tilt - 12} 510 ${x + tilt - 22} 514M${x + tilt} 528Q${x + tilt + 12} 508 ${x + tilt + 22} 512`} stroke="var(--stk-leaf)" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    ))}
  </g>
);

/** A rising sun with soft rays. */
export const CSun = () => (
  <g>
    {range(12).map((i) => {
      const a = (i * Math.PI) / 6;
      return <line key={i} x1={r2(460 + Math.cos(a) * 38)} y1={r2(64 + Math.sin(a) * 38)} x2={r2(460 + Math.cos(a) * 52)} y2={r2(64 + Math.sin(a) * 52)} stroke="var(--stk-flame)" strokeWidth="3" strokeLinecap="round" />;
    })}
    <circle cx="460" cy="64" r="34" fill="var(--stk-flame2)" />
    <circle cx="460" cy="64" r="24" fill="var(--stk-flame)" />
  </g>
);
