/* The group pictures shown for crochet, painting, food, resin and every other kind of listing without photos: four people doing the activity together, in a themed room. Each function returns the part of the picture in front of the shared sun and arch (ClassArt draws those). `u` makes the ids of the reusable people unique on a page. Animation lives in ClassArt.css. */
import type { CSSProperties } from 'react';

const css = (o: Record<string, string | number>) => o as CSSProperties;

export function CrochetScene({ u }: { u: string }) {
  return (
    <>
      <defs>
      <g id={`${u}-body`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 -50 L0 -96" stroke="currentColor" strokeWidth="26"/>
      <circle cx="0" cy="-114" r="11" fill="var(--stall-skin)" stroke="none"/>
      <path d="M-11 -116 Q-11 -130 0 -130 Q11 -130 11 -116 Q4 -123 -11 -116Z" fill="var(--stall-wood-d)" stroke="none"/>
      <circle cx="-7" cy="-131" r="5" fill="var(--stall-wood-d)" stroke="none"/>
      </g>
      <g id={`${u}-arms`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-9 -90 Q-24 -74 -14 -56 M9 -90 Q24 -74 14 -56" stroke="currentColor" strokeWidth="8"/>
      <g transform="translate(0 -62) rotate(45)">
      <rect x="-8" y="-8" width="16" height="16" rx="2" stroke="var(--stall-mustard)" strokeWidth="4"/>
      <rect x="-3" y="-3" width="6" height="6" rx="1" stroke="var(--orange)" strokeWidth="3"/>
      </g>
      <path d="M14 -56 L30 -76" stroke="var(--stall-wood-d)" strokeWidth="3"/>
      <circle cx="-14" cy="-56" r="5" fill="var(--stall-skin)" stroke="none"/>
      <circle cx="14" cy="-56" r="5" fill="var(--stall-skin)" stroke="none"/>
      </g>
      <g id={`${u}-cup`}>
      <path d="M-9 0 L-7 -15 H7 L9 0Z" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="2"/>
      <path d="M-7.5 -9 H7.5 L8.2 -2 H-8.2Z" fill="var(--stall-wood-d)"/>
      <path d="M9 -12 q8 0 8 6 q0 6 -8 6" fill="none" stroke="var(--sand-line)" strokeWidth="2"/>
      </g>
      </defs>
      <g>
      <path d="M130 0 V70 M200 0 V86 M270 0 V70" fill="none" stroke="var(--stall-wood-d)" strokeWidth="2"/>
      <circle className="rr-glow" style={css({ '--d': '0', fill: 'var(--stall-mustard)' })} cx="130" cy="86" r="24"/>
      <circle className="rr-glow" style={css({ '--d': '-1', fill: 'var(--stall-mustard)' })} cx="200" cy="102" r="24"/>
      <circle className="rr-glow" style={css({ '--d': '-2', fill: 'var(--stall-mustard)' })} cx="270" cy="86" r="24"/>
      <path d="M116 84 A14 14 0 0 1 144 84Z" fill="var(--stall-mustard)"/>
      <path d="M186 100 A14 14 0 0 1 214 100Z" fill="var(--orange)"/>
      <path d="M256 84 A14 14 0 0 1 284 84Z" fill="var(--stall-mustard)"/>
      <rect x="96" y="146" width="208" height="6" rx="2" fill="var(--stall-wood)"/>
      <path d="M108 146 L110 132 H124 L126 146Z" fill="var(--stall-terra-d)"/>
      <path d="M117 132 V110 M117 132 Q112 118 103 115 M117 132 Q122 116 132 112" fill="none" strokeLinecap="round" stroke="var(--green)" strokeWidth="3"/>
      <rect x="140" y="124" width="14" height="22" rx="3" fill="var(--stall-indigo)"/>
      <rect x="143" y="120" width="8" height="5" rx="1" fill="var(--stall-wood-d)"/>
      <rect x="158" y="130" width="12" height="16" rx="3" fill="var(--orange)"/>
      <use href={`#${u}-cup`} x="190" y="146"/>
      <use href={`#${u}-cup`} x="214" y="146"/>
      <rect x="240" y="128" width="8" height="18" fill="var(--green)"/>
      <rect x="249" y="124" width="8" height="22" fill="var(--orange)"/>
      <rect x="258" y="130" width="8" height="16" fill="var(--stall-indigo)"/>
      <ellipse cx="288" cy="136" rx="12" ry="10" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="2"/>
      <path d="M299 134 q8 -4 8 -10 M277 132 q-6 0 -7 6" fill="none" stroke="var(--sand-line)" strokeWidth="2.5"/>
      <rect x="283" y="124" width="10" height="3" rx="1.5" fill="var(--stall-wood-d)"/>
      </g>
      <g transform="translate(200 398) scale(1.32) translate(-200 -398)">
      <g className="rr-bob" style={css({ '--d': '0' })}><use href={`#${u}-body`} x="70" y="398" style={css({ color: 'var(--art-warrior)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-0.6' })}><use href={`#${u}-body`} x="146" y="398" style={css({ color: 'var(--stall-indigo)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-1.2' })}><use href={`#${u}-body`} x="254" y="398" style={css({ color: 'var(--green-d)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-1.8' })}><use href={`#${u}-body`} x="330" y="398" style={css({ color: 'var(--art-arms)' })}/></g>
      <rect x="30" y="340" width="340" height="12" rx="3" fill="var(--stall-wood)"/>
      <path d="M44 352 V398 M356 352 V398" fill="none" strokeLinecap="round" stroke="var(--stall-wood-d)" strokeWidth="8"/>
      <path d="M46 346 l6 -4 l6 4 l-6 4z M66 346 l6 -4 l6 4 l-6 4z M86 346 l6 -4 l6 4 l-6 4z M306 346 l6 -4 l6 4 l-6 4z M326 346 l6 -4 l6 4 l-6 4z M346 346 l6 -4 l6 4 l-6 4z" fill="var(--stall-mustard)" opacity="0.9"/>
      <use href={`#${u}-cup`} x="104" y="340"/>
      <use href={`#${u}-cup`} x="296" y="340"/>
      <use href={`#${u}-cup`} x="176" y="340"/>
      <use href={`#${u}-cup`} x="228" y="340"/>
      <g fill="none" strokeLinecap="round" stroke="var(--ink)" strokeWidth="3">
      <path className="rr-steam" style={css({ '--d': '0' })} d="M104 322 q-5 -7 0 -14 t0 -14" opacity="0.4"/>
      <path className="rr-steam" style={css({ '--d': '-1' })} d="M296 322 q-5 -7 0 -14 t0 -14" opacity="0.4"/>
      <path className="rr-steam" style={css({ '--d': '-1.8' })} d="M176 322 q-5 -7 0 -14 t0 -14" opacity="0.4"/>
      <path className="rr-steam" style={css({ '--d': '-2.4' })} d="M228 322 q-5 -7 0 -14 t0 -14" opacity="0.4"/>
      </g>
      <ellipse cx="200" cy="338" rx="20" ry="4" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="2"/>
      <path d="M188 334 Q192 322 200 322 Q208 322 212 334 Q206 330 200 330 Q194 330 188 334Z" fill="var(--stall-mustard)"/>
      <circle cx="46" cy="332" r="9" fill="var(--stall-indigo)"/>
      <circle cx="360" cy="332" r="9" fill="var(--orange)"/>
      <path d="M40 330 Q46 324 52 330 M354 330 Q360 324 366 330" fill="none" stroke="var(--cream)" strokeWidth="1.5" opacity="0.7"/>
      <g className="rr-bob" style={css({ '--d': '0' })}><use href={`#${u}-arms`} x="70" y="398" style={css({ color: 'var(--art-warrior)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-0.6' })}><use href={`#${u}-arms`} x="146" y="398" style={css({ color: 'var(--stall-indigo)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-1.2' })}><use href={`#${u}-arms`} x="254" y="398" style={css({ color: 'var(--green-d)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-1.8' })}><use href={`#${u}-arms`} x="330" y="398" style={css({ color: 'var(--art-arms)' })}/></g>
      </g>
    </>
  );
}

export function PaintingScene({ u }: { u: string }) {
  return (
    <>
      <defs>
      <g id={`${u}-painter`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M40 0 L48 -56 M72 0 L64 -56 M56 0 L56 -52" stroke="var(--stall-wood-d)" strokeWidth="5"/>
      <rect x="32" y="-114" width="48" height="46" rx="2" fill="var(--stall-chalk)" stroke="var(--stall-wood-d)" strokeWidth="4"/>
      <circle cx="62" cy="-98" r="7" fill="var(--c1)" stroke="none"/>
      <path d="M34 -70 Q46 -92 58 -80 T78 -82 V-70Z" fill="var(--c2)" stroke="none"/>
      <path d="M-3 -36 L-8 0 M3 -36 L8 0" stroke="var(--stall-wood-d)" strokeWidth="7"/>
      <path d="M0 -70 L0 -34" stroke="currentColor" strokeWidth="20"/>
      <circle cx="0" cy="-84" r="10" fill="var(--stall-skin)" stroke="none"/>
      <path d="M-10 -85 Q-10 -98 0 -98 Q10 -98 10 -85 Q3 -92 -10 -85Z" fill="var(--stall-wood-d)" stroke="none"/>
      <path d="M-4 -64 Q-20 -52 -16 -38" stroke="currentColor" strokeWidth="7"/>
      <ellipse cx="-20" cy="-38" rx="13" ry="8" fill="var(--stall-wood)" stroke="none"/>
      <circle cx="-25" cy="-40" r="2.5" fill="var(--orange)" stroke="none"/>
      <circle cx="-18" cy="-43" r="2.5" fill="var(--stall-mustard)" stroke="none"/>
      <circle cx="-15" cy="-36" r="2.5" fill="var(--green)" stroke="none"/>
      <g className="rr-stroke">
      <path d="M4 -64 Q30 -76 52 -74" stroke="currentColor" strokeWidth="7"/>
      <path d="M52 -74 L62 -76" stroke="var(--stall-wood-d)" strokeWidth="3"/>
      <path d="M62 -76 L66 -77" stroke="var(--orange)" strokeWidth="5"/>
      <circle cx="52" cy="-74" r="4" fill="var(--stall-skin)" stroke="none"/>
      </g>
      </g>
      </defs>
      <g className="rr-spark" style={css({ '--d': '0' })}><circle cx="96" cy="250" r="3" fill="var(--stall-mustard)"/><circle cx="300" cy="232" r="3" fill="var(--orange)"/></g>
      <g className="rr-spark" style={css({ '--d': '-1' })}><circle cx="190" cy="236" r="3" fill="var(--stall-indigo)"/><circle cx="360" cy="262" r="3" fill="var(--green)"/></g>
      <rect x="12" y="396" width="376" height="9" rx="4.5" fill="var(--green)" opacity="0.9"/>
      <g transform="translate(200 396) scale(1.12) translate(-185 -396)">
      <use href={`#${u}-painter`} x="30" y="396" style={css({ color: 'var(--stall-indigo)', '--c1': 'var(--orange)', '--c2': 'var(--green)', '--d': '0' })}/>
      <use href={`#${u}-painter`} x="110" y="396" style={css({ color: 'var(--art-warrior)', '--c1': 'var(--stall-mustard)', '--c2': 'var(--stall-indigo)', '--d': '-0.4' })}/>
      <use href={`#${u}-painter`} x="190" y="396" style={css({ color: 'var(--green-d)', '--c1': 'var(--stall-indigo)', '--c2': 'var(--orange)', '--d': '-0.8' })}/>
      <use href={`#${u}-painter`} x="270" y="396" style={css({ color: 'var(--art-arms)', '--c1': 'var(--green)', '--c2': 'var(--stall-mustard)', '--d': '-0.2' })}/>
      </g>
    </>
  );
}

export function FoodScene({ u }: { u: string }) {
  return (
    <>
      <defs>
      <g id={`${u}-body`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 -50 L0 -96" stroke="currentColor" strokeWidth="26"/>
      <circle cx="0" cy="-114" r="11" fill="var(--stall-skin)" stroke="none"/>
      <circle cx="-6" cy="-132" r="7" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="2"/>
      <circle cx="6" cy="-132" r="7" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="2"/>
      <circle cx="0" cy="-138" r="8" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="2"/>
      <rect x="-10" y="-128" width="20" height="9" rx="3" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="2"/>
      </g>
      <g id={`${u}-arms`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-9 -90 Q-24 -74 -14 -56 M9 -90 Q24 -74 14 -56" stroke="currentColor" strokeWidth="8"/>
      <circle cx="-14" cy="-56" r="5" fill="var(--stall-skin)" stroke="none"/>
      <circle cx="14" cy="-56" r="5" fill="var(--stall-skin)" stroke="none"/>
      </g>
      </defs>
      <g transform="translate(200 398) scale(1.32) translate(-200 -398)">
      <g className="rr-bob" style={css({ '--d': '0' })}><use href={`#${u}-body`} x="70" y="398" style={css({ color: 'var(--green-d)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-0.6' })}><use href={`#${u}-body`} x="146" y="398" style={css({ color: 'var(--art-warrior)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-1.2' })}><use href={`#${u}-body`} x="254" y="398" style={css({ color: 'var(--stall-indigo)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-1.8' })}><use href={`#${u}-body`} x="330" y="398" style={css({ color: 'var(--art-arms)' })}/></g>
      <rect x="30" y="340" width="340" height="12" rx="3" fill="var(--stall-wood)"/>
      <path d="M44 352 V398 M356 352 V398" fill="none" strokeLinecap="round" stroke="var(--stall-wood-d)" strokeWidth="8"/>
      <path d="M52 340 Q52 324 70 324 Q88 324 88 340Z" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="3"/>
      <ellipse cx="70" cy="324" rx="16" ry="5" fill="var(--sand)"/>
      <rect x="126" y="334" width="40" height="6" rx="2" fill="var(--stall-wood-d)"/>
      <circle cx="136" cy="329" r="6" fill="var(--orange)"/>
      <circle cx="148" cy="328" r="6" fill="var(--green)"/>
      <circle cx="158" cy="330" r="5" fill="var(--stall-mustard)"/>
      <rect x="232" y="334" width="44" height="6" rx="2" fill="var(--stall-wood-d)"/>
      <ellipse cx="254" cy="333" rx="16" ry="4" fill="var(--stall-chalk)"/>
      <rect x="240" y="322" width="28" height="8" rx="4" fill="var(--stall-wood-d)"/>
      <path d="M312 340 Q312 326 330 326 Q348 326 348 340Z" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="3"/>
      <ellipse cx="330" cy="326" rx="14" ry="5" fill="var(--stall-mustard)"/>
      <path d="M176 340 V312 Q176 300 188 300 H212 Q224 300 224 312 V340Z" fill="var(--art-warrior)"/>
      <rect x="172" y="296" width="56" height="8" rx="4" fill="var(--stall-wood-d)"/>
      <path d="M176 322 q-12 0 -12 10 M224 322 q12 0 12 10" fill="none" strokeLinecap="round" stroke="var(--stall-wood-d)" strokeWidth="5"/>
      <g fill="none" strokeLinecap="round" stroke="var(--ink)" strokeWidth="4">
      <path className="rr-steam" style={css({ '--d': '0' })} d="M186 288 q-8 -10 0 -20 t0 -20" opacity="0.4"/>
      <path className="rr-steam" style={css({ '--d': '-1' })} d="M200 288 q-8 -10 0 -20 t0 -20" opacity="0.4"/>
      <path className="rr-steam" style={css({ '--d': '-2' })} d="M214 288 q-8 -10 0 -20 t0 -20" opacity="0.4"/>
      </g>
      <g className="rr-bob" style={css({ '--d': '0' })}><use href={`#${u}-arms`} x="70" y="398" style={css({ color: 'var(--green-d)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-0.6' })}><use href={`#${u}-arms`} x="146" y="398" style={css({ color: 'var(--art-warrior)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-1.2' })}><use href={`#${u}-arms`} x="254" y="398" style={css({ color: 'var(--stall-indigo)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-1.8' })}><use href={`#${u}-arms`} x="330" y="398" style={css({ color: 'var(--art-arms)' })}/></g>
      </g>
    </>
  );
}

export function ResinScene({ u }: { u: string }) {
  return (
    <>
      <defs>
      <g id={`${u}-body`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 -50 L0 -96" stroke="currentColor" strokeWidth="26"/>
      <circle cx="0" cy="-114" r="11" fill="var(--stall-skin)" stroke="none"/>
      <path d="M-11 -116 Q-11 -130 0 -130 Q11 -130 11 -116 Q4 -123 -11 -116Z" fill="var(--stall-wood-d)" stroke="none"/>
      <path d="M-9 -114 H9" stroke="var(--stall-chalk)" strokeWidth="3"/>
      </g>
      <g id={`${u}-arms`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-9 -90 Q-24 -74 -14 -56 M9 -90 Q24 -74 14 -56" stroke="currentColor" strokeWidth="8"/>
      <circle cx="-14" cy="-56" r="5" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="1.5"/>
      <circle cx="14" cy="-56" r="5" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="1.5"/>
      </g>
      </defs>
      <g transform="translate(200 398) scale(1.32) translate(-200 -398)">
      <g className="rr-bob" style={css({ '--d': '0' })}><use href={`#${u}-body`} x="70" y="398" style={css({ color: 'var(--art-warrior)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-0.6' })}><use href={`#${u}-body`} x="146" y="398" style={css({ color: 'var(--stall-indigo)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-1.2' })}><use href={`#${u}-body`} x="254" y="398" style={css({ color: 'var(--green-d)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-1.8' })}><use href={`#${u}-body`} x="330" y="398" style={css({ color: 'var(--art-arms)' })}/></g>
      <rect x="30" y="340" width="340" height="12" rx="3" fill="var(--stall-wood)"/>
      <path d="M44 352 V398 M356 352 V398" fill="none" strokeLinecap="round" stroke="var(--stall-wood-d)" strokeWidth="8"/>
      <ellipse cx="46" cy="338" rx="16" ry="5" fill="var(--sand-line)"/>
      <ellipse cx="46" cy="337" rx="12" ry="3.5" fill="var(--stall-indigo)"/>
      <path className="rr-flow" d="M48 298 Q46 318 46 334" fill="none" strokeLinecap="round" stroke="var(--stall-indigo)" strokeWidth="4"/>
      <path d="M136 340 L138 318 H154 L156 340Z" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="3"/>
      <path d="M137.5 328 H154.5 L156 340 H136Z" fill="var(--stall-indigo)"/>
      <g className="rr-stir"><path d="M148 330 L152 300" fill="none" strokeLinecap="round" stroke="var(--stall-wood-d)" strokeWidth="4"/></g>
      <circle cx="190" cy="326" r="14" fill="var(--green)"/>
      <path d="M180 328 Q190 316 200 326 Q190 336 183 332" fill="none" strokeLinecap="round" stroke="var(--stall-chalk)" strokeWidth="2" opacity="0.8"/>
      <circle cx="214" cy="328" r="12" fill="var(--orange)"/>
      <path d="M207 328 Q214 320 221 328" fill="none" strokeLinecap="round" stroke="var(--stall-chalk)" strokeWidth="2" opacity="0.8"/>
      <path d="M320 340 L318 316 Q318 308 324 306 H336 Q342 308 342 316 L340 340Z" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="3"/>
      <path d="M330 306 Q326 286 312 280 M330 306 Q334 284 348 278" fill="none" strokeLinecap="round" stroke="var(--green)" strokeWidth="5"/>
      <circle cx="362" cy="332" r="9" fill="var(--stall-mustard)"/>
      <g className="rr-bob" style={css({ '--d': '0' })}>
      <use href={`#${u}-arms`} x="146" y="398" style={css({ color: 'var(--stall-indigo)' })}/>
      <use href={`#${u}-arms`} x="330" y="398" style={css({ color: 'var(--art-arms)' })}/>
      </g>
      <g className="rr-bob" style={css({ '--d': '-0.4' })}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" style={css({ color: 'var(--art-warrior)' })}>
      <path d="M61 -8 L61 -8" stroke="none"/>
      <path d="M61 308 Q34 294 16 302" stroke="currentColor" strokeWidth="8"/>
      <path d="M79 308 Q94 324 84 342" stroke="currentColor" strokeWidth="8"/>
      <circle cx="16" cy="302" r="5" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="1.5"/>
      <circle cx="84" cy="342" r="5" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="1.5"/>
      <g transform="translate(12 298) rotate(-50)">
      <path d="M-12 -18 L-9 16 H9 L12 -18Z" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="3"/>
      <path d="M-10.5 0 L-9 14 H9 L10.5 0Z" fill="var(--stall-indigo)" stroke="none"/>
      </g>
      </g>
      </g>
      <g className="rr-bob" style={css({ '--d': '-1.2' })}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" style={css({ color: 'var(--green-d)' })}>
      <path d="M245 308 Q232 324 240 342" stroke="currentColor" strokeWidth="8"/>
      <path d="M263 308 Q284 296 294 276" stroke="currentColor" strokeWidth="8"/>
      <circle cx="240" cy="342" r="5" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="1.5"/>
      <circle cx="294" cy="276" r="5" fill="var(--stall-chalk)" stroke="var(--sand-line)" strokeWidth="1.5"/>
      </g>
      <circle cx="298" cy="262" r="16" fill="var(--green)"/>
      <path d="M287 264 Q298 250 309 262 Q298 274 290 270" fill="none" strokeLinecap="round" stroke="var(--stall-chalk)" strokeWidth="2.5" opacity="0.8"/>
      </g>
      <g className="rr-spark" style={css({ '--d': '0', fill: 'var(--stall-mustard)' })}><circle cx="322" cy="246" r="2.5"/><circle cx="276" cy="244" r="2"/></g>
      <g className="rr-spark" style={css({ '--d': '-1', fill: 'var(--stall-mustard)' })}><circle cx="304" cy="236" r="2"/><circle cx="318" cy="268" r="2.5"/></g>
      </g>
    </>
  );
}

export function GenericScene({ u }: { u: string }) {
  return (
    <>
      <defs>
      <g id={`${u}-body`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 -50 L0 -96" stroke="currentColor" strokeWidth="26"/>
      <circle cx="0" cy="-114" r="11" fill="var(--stall-skin)" stroke="none"/>
      <path d="M-11 -116 Q-11 -130 0 -130 Q11 -130 11 -116 Q4 -123 -11 -116Z" fill="var(--stall-wood-d)" stroke="none"/>
      <circle cx="-7" cy="-131" r="5" fill="var(--stall-wood-d)" stroke="none"/>
      </g>
      <g id={`${u}-arms`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-9 -90 Q-24 -74 -14 -56 M9 -90 Q24 -74 14 -56" stroke="currentColor" strokeWidth="8"/>
      <circle cx="-14" cy="-56" r="5" fill="var(--stall-skin)" stroke="none"/>
      <circle cx="14" cy="-56" r="5" fill="var(--stall-skin)" stroke="none"/>
      </g>
      </defs>
      <g transform="translate(200 398) scale(1.32) translate(-200 -398)">
      <g className="rr-bob" style={css({ '--d': '0' })}><use href={`#${u}-body`} x="70" y="398" style={css({ color: 'var(--art-warrior)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-0.6' })}><use href={`#${u}-body`} x="146" y="398" style={css({ color: 'var(--stall-indigo)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-1.2' })}><use href={`#${u}-body`} x="254" y="398" style={css({ color: 'var(--green-d)' })}/></g>
      <g className="rr-bob" style={css({ '--d': '-1.8' })}><use href={`#${u}-body`} x="330" y="398" style={css({ color: 'var(--art-arms)' })}/></g>
      <rect x="30" y="340" width="340" height="12" rx="3" fill="var(--stall-wood)"/>
      <path d="M44 352 V398 M356 352 V398" fill="none" strokeLinecap="round" stroke="var(--stall-wood-d)" strokeWidth="8"/>
      <ellipse cx="70" cy="339" rx="28" ry="6" fill="var(--stall-wood-d)"/>
      <ellipse className="rr-flow" cx="70" cy="339" rx="24" ry="5" fill="none" stroke="var(--sand-line)" strokeWidth="2"/>
      <path d="M58 339 Q52 322 62 312 H78 Q88 322 82 339Z" fill="var(--stall-terra-d)"/>
      <rect x="130" y="334" width="32" height="6" rx="1" fill="var(--stall-chalk)"/>
      <g className="rr-stir"><path d="M140 332 L152 316 M152 332 L140 316" fill="none" strokeLinecap="round" stroke="var(--ink)" strokeWidth="2.5"/></g>
      <circle cx="140" cy="334" r="3" fill="none" stroke="var(--orange)" strokeWidth="2"/>
      <circle cx="152" cy="334" r="3" fill="none" stroke="var(--orange)" strokeWidth="2"/>
      <rect x="232" y="334" width="44" height="6" rx="1" fill="var(--stall-chalk)"/>
      <path d="M238 334 l5 -4 l5 4 M250 334 l5 -4 l5 4 M262 334 l5 -4 l5 4" fill="none" stroke="var(--orange)" strokeWidth="2"/>
      <g className="rr-stamp"><rect x="246" y="316" width="18" height="14" rx="2" fill="var(--stall-wood-d)"/><circle cx="255" cy="323" r="3.5" fill="var(--cream)"/></g>
      <path d="M190 340 L192 322 H208 L210 340Z" fill="var(--stall-indigo)"/>
      <path d="M200 322 V298 M196 322 Q186 308 184 300" fill="none" strokeLinecap="round" stroke="var(--green)" strokeWidth="4"/>
      <g fill="var(--art-warrior)"><circle cx="200" cy="292" r="6"/><circle cx="200" cy="304" r="6"/><circle cx="194" cy="298" r="6"/><circle cx="206" cy="298" r="6"/><circle cx="184" cy="296" r="4"/><circle cx="184" cy="304" r="4"/><circle cx="179" cy="300" r="4"/><circle cx="189" cy="300" r="4"/></g>
      <circle cx="200" cy="298" r="4" fill="var(--stall-mustard)"/>
      <circle cx="184" cy="300" r="2.5" fill="var(--stall-mustard)"/>
      <g className="rr-bob" style={css({ '--d': '0' })}>
      <use href={`#${u}-arms`} x="70" y="398" style={css({ color: 'var(--art-warrior)' })}/>
      <use href={`#${u}-arms`} x="146" y="398" style={css({ color: 'var(--stall-indigo)' })}/>
      <use href={`#${u}-arms`} x="254" y="398" style={css({ color: 'var(--green-d)' })}/>
      </g>
      <g className="rr-bob" style={css({ '--d': '-0.4' })} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M339 308 Q312 294 296 286" stroke="var(--art-arms)" strokeWidth="8"/>
      <path d="M321 308 Q306 324 316 342" stroke="var(--art-arms)" strokeWidth="8"/>
      <circle cx="316" cy="342" r="5" fill="var(--stall-skin)" stroke="none"/>
      <circle cx="296" cy="284" r="5" fill="var(--stall-skin)" stroke="none"/>
      <path d="M286 280 Q282 264 290 256 H304 Q312 264 308 280Z" fill="var(--stall-mustard)" stroke="none"/>
      <path d="M284 268 H310" stroke="var(--orange)" strokeWidth="3"/>
      </g>
      <g className="rr-spark" style={css({ '--d': '0', fill: 'var(--stall-mustard)' })}><circle cx="318" cy="250" r="2.5"/><circle cx="278" cy="248" r="2"/></g>
      <g className="rr-spark" style={css({ '--d': '-1', fill: 'var(--orange)' })}><circle cx="296" cy="240" r="2"/><circle cx="316" cy="270" r="2.5"/></g>
      </g>
    </>
  );
}
