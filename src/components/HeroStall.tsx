import { StickerLayer } from './theme/StickerLayer';
import Link from 'next/link';
import { fitText } from './theme/fit';
import { EVERYDAY } from '@/lib/themes/presets';
import { hasChalkboard, type Placement } from '@/lib/themes/types';

export type StallProps = { sign: string; chalkLabel: string; chalkTitle: string; chalkSub: string; bunting: boolean; stickers: Placement[]; /** When set, the chalkboard is a link to it. */ chalkHref?: string };

const D = EVERYDAY.config;
export const DEFAULT_STALL: StallProps = { sign: D.sign, chalkLabel: D.chalkLabel, chalkTitle: D.chalkTitle, chalkSub: D.chalkSub, bunting: true, stickers: [] };

/** Wording that fits its slot is left exactly as drawn; only different wording is measured and, if it overflows, squeezed to fit. */
function Fitted({ value, original, x, y, size, width, ...rest }: { value: string; original: string; x: number; y: number; size: number; width: number } & React.SVGProps<SVGTextElement>) {
  const f = value === original ? { text: value } : fitText(value, size, width);
  return <text x={x} y={y} fontSize={size} {...(f.textLength ? { textLength: f.textLength, lengthAdjust: 'spacingAndGlyphs' as const } : {})} {...rest}>{f.text}</text>;
}

export function HeroStall({ sign = D.sign, chalkLabel = D.chalkLabel, chalkTitle = D.chalkTitle, chalkSub = D.chalkSub, bunting = true, stickers = [], chalkHref }: Partial<StallProps>) {
  // A link must stay reachable by keyboard and screen readers, so the picture is only hidden from them when the board is not a link.
  const boardLink = !!chalkHref && hasChalkboard({ chalkLabel, chalkTitle, chalkSub });
  return (
    <svg className="hero-stall" viewBox="0 0 600 720" focusable="false" {...(boardLink ? {} : { 'aria-hidden': true })}>
      <defs>
      <pattern id="st-blk" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="15" cy="15" r="7" className="st-f-mustard"/>
      <circle cx="15" cy="15" r="2.6" className="st-f-green"/>
      <circle cx="0" cy="0" r="3" className="st-f-chalk"/><circle cx="30" cy="0" r="3" className="st-f-chalk"/>
      <circle cx="0" cy="30" r="3" className="st-f-chalk"/><circle cx="30" cy="30" r="3" className="st-f-chalk"/>
      </pattern>
      <path id="st-badge-path" d="M-27 0a27 27 0 1 1 54 0a27 27 0 1 1 -54 0"/>
      <clipPath id="st-rc1"><circle cx="276" cy="306" r="24"/></clipPath>
      <clipPath id="st-rc2"><circle cx="314" cy="316" r="14"/></clipPath>
      </defs>

      {/* backdrop arches */}
      <path d="M14 720V310A286 286 0 0 1 586 310V720Z" className="st-f-sand"/>
      <path d="M70 720V330A230 230 0 0 1 530 330V720Z" className="st-f-sage" opacity=".35"/>

      {/* bunting */}
      <path d="M0 18Q300 64 600 18" fill="none" strokeWidth="1.5" className="st-s-woodd"/>
      {bunting && <g>
      <path d="M27 23h18l-9 20z" className="st-f-terra"/><path d="M87 30h18l-9 20z" className="st-f-mustard"/>
      <path d="M147 35h18l-9 20z" className="st-f-sage"/><path d="M207 38h18l-9 20z" className="st-f-indigo"/>
      <path d="M267 41h18l-9 20z" className="st-f-terra"/><path d="M327 41h18l-9 20z" className="st-f-mustard"/>
      <path d="M387 39h18l-9 20z" className="st-f-sage"/><path d="M447 35h18l-9 20z" className="st-f-indigo"/>
      <path d="M507 29h18l-9 20z" className="st-f-terra"/><path d="M555 23h18l-9 20z" className="st-f-mustard"/>
      </g>}

      {/* ground */}
      <rect x="0" y="596" width="600" height="124" className="st-f-ground"/>

      {/* back wall */}
      <rect x="84" y="150" width="432" height="328" className="st-f-paper"/>
      <rect x="84" y="150" width="432" height="328" fill="none" strokeWidth="1" className="st-s-line"/>

      {/* posts */}
      <rect x="74" y="150" width="12" height="446" className="st-f-woodd"/>
      <rect x="514" y="150" width="12" height="446" className="st-f-woodd"/>

      {/* shelf 1 */}
      <rect x="84" y="330" width="432" height="8" className="st-f-wood"/>
      {/* blue vase */}
      <path d="M122 330C106 330 104 290 118 276L120 262H140L142 276C156 290 154 330 138 330Z" className="st-f-indigo"/>
      <rect x="116" y="257" width="28" height="6" rx="2" className="st-f-mustard"/>
      <path d="M109 298H151M111 312H149" strokeWidth="2" strokeDasharray="3 3" fill="none" className="st-s-chalk"/>
      <circle cx="130" cy="285" r="3" className="st-f-chalk"/>
      {/* terracotta pot */}
      <path d="M180 330C172 312 176 292 192 286H218C234 292 238 312 230 330Z" className="st-f-terra"/>
      <rect x="186" y="281" width="38" height="7" rx="3" className="st-f-terrad"/>
      <path d="M178 310l7-6 7 6 7-6 7 6 7-6 7 6 7-6 6 5" strokeWidth="2.5" fill="none" className="st-s-mustard"/>
      {/* resin art coasters */}
      <g clipPath="url(#st-rc1)">
      <rect x="252" y="282" width="48" height="48" className="st-f-indigo"/>
      <path d="M252 306C262 296 270 316 282 304S296 300 300 308V330H252Z" className="st-f-sage"/>
      <path d="M252 314C264 306 272 322 286 312S296 314 300 316" fill="none" strokeWidth="3" className="st-s-chalk"/>
      <circle cx="262" cy="292" r="1.6" className="st-f-mustard"/><circle cx="288" cy="290" r="1.6" className="st-f-mustard"/>
      <circle cx="270" cy="322" r="1.6" className="st-f-mustard"/><circle cx="292" cy="324" r="1.6" className="st-f-mustard"/>
      </g>
      <circle cx="276" cy="306" r="24" fill="none" strokeWidth="2" className="st-s-chalk" opacity=".6"/>
      <g clipPath="url(#st-rc2)">
      <rect x="300" y="302" width="28" height="28" className="st-f-terra"/>
      <path d="M300 318C306 310 312 324 320 316S326 314 328 318V330H300Z" className="st-f-mustard"/>
      <circle cx="308" cy="310" r="1.4" className="st-f-chalk"/><circle cx="322" cy="308" r="1.4" className="st-f-chalk"/>
      </g>
      <circle cx="314" cy="316" r="14" fill="none" strokeWidth="1.5" className="st-s-chalk" opacity=".6"/>
      {/* embroidery hoops */}
      <circle cx="262" cy="264" r="16" className="st-f-chalk" strokeWidth="4" style={{ stroke: 'var(--stall-wood)' }}/>
      <g className="st-f-terra">
      <circle cx="262" cy="253" r="3.2"/><circle cx="267" cy="256.5" r="3.2"/><circle cx="265" cy="262.5" r="3.2"/>
      <circle cx="259" cy="262.5" r="3.2"/><circle cx="257" cy="256.5" r="3.2"/>
      </g>
      <circle cx="262" cy="258" r="2.4" className="st-f-mustard"/>
      <path d="M262 266V276" fill="none" strokeWidth="1.5" className="st-s-green"/>
      <path d="M262 272q6-5 9-2q-4 4-9 2z" className="st-f-green"/>
      <circle cx="301" cy="260" r="11" className="st-f-chalk" strokeWidth="3" style={{ stroke: 'var(--stall-wood)' }}/>
      <path d="M293 262l4-5 4 5 4-5 4 5" fill="none" strokeWidth="1.5" strokeDasharray="2 1.5" className="st-s-terra"/>
      <circle cx="297" cy="268" r="1.3" className="st-f-indigo"/><circle cx="305" cy="268" r="1.3" className="st-f-indigo"/>
      {/* price tag */}
      <g transform="translate(228 302) rotate(10)">
      <line x1="0" y1="-10" x2="0" y2="0" strokeWidth="1" className="st-s-ink"/>
      <rect x="-4" y="0" width="40" height="18" rx="3" className="st-f-chalk"/>
      <text x="2" y="14" className="st-hand st-t-ink" fontSize="11">₹450</text>
      </g>

      {/* shelf 2 */}
      <rect x="84" y="410" width="432" height="8" className="st-f-wood"/>
      {/* basket */}
      <path d="M96 410L104 372H156L164 410Z" className="st-f-wood"/>
      <path d="M100 382H160M99 392H161M98 402H162" strokeWidth="2" fill="none" className="st-s-woodd"/>
      <path d="M108 372C108 346 152 346 152 372" strokeWidth="4" fill="none" className="st-s-woodd"/>
      <rect x="102" y="370" width="56" height="5" className="st-f-mustard"/>
      {/* stacked bowls */}
      <path d="M210 410L216 398H270L276 410Z" className="st-f-indigo"/>
      <path d="M214 398L220 386H266L272 398Z" className="st-f-terra"/>
      <path d="M218 386L223 376H263L268 386Z" className="st-f-sage"/>
      <path d="M216 404h54" strokeWidth="2" strokeDasharray="2 4" className="st-s-chalk"/>
      {/* crochet: mushroom amigurumi + yarn balls */}
      <rect x="303" y="394" width="18" height="16" rx="3" className="st-f-chalk"/>
      <path d="M306 399v8M312 399v8M318 399v8" fill="none" strokeWidth="1.5" strokeDasharray="2 2" className="st-s-woodd" opacity=".5"/>
      <path d="M288 396a24 22 0 0 1 48 0Z" className="st-f-terra"/>
      <path d="M292 394q20-6 40 0" fill="none" strokeWidth="1.5" strokeDasharray="3 2" className="st-s-terrad" opacity=".6"/>
      <circle cx="300" cy="386" r="3" className="st-f-chalk"/><circle cx="312" cy="380" r="3" className="st-f-chalk"/><circle cx="324" cy="388" r="3" className="st-f-chalk"/>
      <circle cx="122" cy="366" r="9" className="st-f-sage"/>
      <path d="M114 363q8 6 16 0M114 368q8 5 16 0" fill="none" strokeWidth="1.3" className="st-s-chalk"/>
      <circle cx="140" cy="364" r="9" className="st-f-mustard"/>
      <path d="M132 361q8 6 16 0M132 366q8 5 16 0" fill="none" strokeWidth="1.3" className="st-s-terrad"/>
      {/* folded cloths */}
      <g>
      <rect x="344" y="398" width="92" height="12" rx="2" className="st-f-indigo"/>
      <rect x="348" y="386" width="84" height="12" rx="2" className="st-f-terra"/>
      <rect x="346" y="374" width="88" height="12" rx="2" className="st-f-mustard"/>
      <rect x="350" y="362" width="80" height="12" rx="2" className="st-f-sage"/>
      <path d="M356 404h72M358 392h68M356 380h72" strokeWidth="2" strokeDasharray="2 5" className="st-s-chalk"/>
      </g>

      {/* hanging cloth rod + cloths */}
      <line x1="330" y1="240" x2="508" y2="240" strokeWidth="4" strokeLinecap="round" className="st-s-woodd"/>
      <circle cx="330" cy="240" r="5" className="st-f-woodd"/><circle cx="508" cy="240" r="5" className="st-f-woodd"/>
      <g className="st-sway">
      <rect x="344" y="242" width="46" height="82" className="st-f-mustard"/>
      <rect x="344" y="308" width="46" height="16" className="st-f-terra"/>
      <circle cx="367" cy="262" r="6" className="st-f-chalk"/><circle cx="367" cy="262" r="2.5" className="st-f-terra"/>
      <circle cx="367" cy="284" r="6" className="st-f-chalk"/><circle cx="367" cy="284" r="2.5" className="st-f-terra"/>
      <path d="M346 326h42" strokeWidth="4" strokeDasharray="2 3" className="st-s-mustard"/>
      </g>
      <g className="st-sway b">
      <rect x="398" y="242" width="46" height="62" className="st-f-indigo"/>
      <path d="M421 254l9 10-9 10-9-10zM421 278l9 10-9 10-9-10z" className="st-f-chalk"/>
      <path d="M400 306h42" strokeWidth="4" strokeDasharray="2 3" className="st-s-sage"/>
      </g>
      <g className="st-sway c">
      <rect x="452" y="242" width="46" height="86" className="st-f-terra"/>
      <rect x="452" y="262" width="46" height="8" className="st-f-sage"/>
      <rect x="452" y="300" width="46" height="8" className="st-f-sage"/>
      <circle cx="475" cy="284" r="7" fill="none" strokeWidth="2" className="st-s-chalk"/>
      <path d="M454 330h42" strokeWidth="4" strokeDasharray="2 3" className="st-s-terrad"/>
      </g>

      {/* awning */}
      <path d="M96 112H492L526 150H62Z" className="st-f-green"/>
      <g>
      <path d="M62 150H120V206a29 29 0 0 1-58 0Z" className="st-f-terra"/>
      <path d="M120 150H178V206a29 29 0 0 1-58 0Z" className="st-f-mustard"/>
      <path d="M178 150H236V206a29 29 0 0 1-58 0Z" className="st-f-terra"/>
      <path d="M236 150H294V206a29 29 0 0 1-58 0Z" className="st-f-mustard"/>
      <path d="M294 150H352V206a29 29 0 0 1-58 0Z" className="st-f-terra"/>
      <path d="M352 150H410V206a29 29 0 0 1-58 0Z" className="st-f-mustard"/>
      <path d="M410 150H468V206a29 29 0 0 1-58 0Z" className="st-f-terra"/>
      <path d="M468 150H526V206a29 29 0 0 1-58 0Z" className="st-f-mustard"/>
      </g>
      <path d="M62 150H526" strokeWidth="2" className="st-s-terrad" opacity=".5"/>

      {/* hanging name board */}
      <line x1="214" y1="104" x2="214" y2="113" strokeWidth="2" className="st-s-woodd"/>
      <line x1="374" y1="104" x2="374" y2="113" strokeWidth="2" className="st-s-woodd"/>
      <rect x="194" y="66" width="200" height="38" rx="5" className="st-f-board"/>
      <rect x="199" y="71" width="190" height="28" rx="3" fill="none" strokeWidth="1" className="st-s-mustard" opacity=".7"/>
      <Fitted value={sign} original={D.sign} x={294} y={90} size={13} width={176} textAnchor="middle" fontStyle="italic" className="st-t-chalk"/>

      {/* sellers */}
      <path d="M166 478C164 424 172 398 188 398C204 398 212 424 210 478Z" className="st-f-indigo"/>
      <path d="M172 402Q190 412 206 440L198 446Q188 424 170 414Z" className="st-f-mustard"/>
      <rect x="184" y="388" width="8" height="12" className="st-f-skin"/>
      <circle cx="188" cy="380" r="12" className="st-f-skin"/>
      <path d="M176 378Q176 364 188 364Q200 364 200 378Q194 371 188 372Q182 371 176 378Z" className="st-f-hair"/>
      <circle cx="188" cy="361" r="6" className="st-f-hair"/>
      <circle cx="188" cy="375" r="1.3" className="st-f-terra"/>
      <circle cx="184" cy="380" r="1.1" className="st-f-hair"/><circle cx="192" cy="380" r="1.1" className="st-f-hair"/>
      <path d="M184 385q4 3 8 0" fill="none" strokeWidth="1.2" className="st-s-terrad"/>
      <path d="M206 410L214 440" strokeWidth="5" strokeLinecap="round" fill="none" className="st-s-skin"/>
      <g className="st-wave"><path d="M170 408L158 386" strokeWidth="5" strokeLinecap="round" fill="none" className="st-s-skin"/><circle cx="157" cy="383" r="4" className="st-f-skin"/></g>
      <path d="M408 478C406 424 414 400 430 400C446 400 454 424 452 478Z" className="st-f-green"/>
      <path d="M423 400L430 412L437 400" fill="none" strokeWidth="2" className="st-s-chalk"/>
      <rect x="426" y="391" width="8" height="11" className="st-f-skin2"/>
      <path d="M414 446L428 420M446 446L432 420" fill="none" strokeWidth="5" strokeLinecap="round" className="st-s-skin2"/>
      <circle cx="430" cy="418" r="4" className="st-f-skin2"/>
      <g className="st-nod">
      <circle cx="430" cy="381" r="12" className="st-f-skin2"/>
      <path d="M416 378Q416 361 430 361Q444 361 444 378Q437 371 430 372Q423 371 416 378Z" className="st-f-terra"/>
      <path d="M417 371Q430 366 443 371" fill="none" strokeWidth="2" className="st-s-mustard"/>
      <path d="M443 372q8 4 6 14" fill="none" strokeWidth="4" strokeLinecap="round" className="st-s-terra"/>
      <path d="M424 387q6-3 12 0" fill="none" strokeWidth="1.8" className="st-s-hair"/>
      <circle cx="425" cy="381" r="1.1" className="st-f-hair"/><circle cx="435" cy="381" r="1.1" className="st-f-hair"/>
      </g>
      {/* counter items (bottom y 478) */}
      {/* potter's wheel */}
      <rect x="112" y="466" width="90" height="12" rx="2" className="st-f-wood"/>
      <ellipse cx="157" cy="462" rx="42" ry="6" className="st-f-woodd"/>
      <path d="M140 462C130 440 138 420 150 412H166C178 420 184 440 174 462Z" className="st-f-terra"/>
      <path d="M137 446c14 6 28 6 41 0" strokeWidth="2" fill="none" className="st-s-terrad"/>
      {/* brush tray */}
      <rect x="236" y="468" width="100" height="10" rx="2" className="st-f-wood"/>
      <path d="M255 440l-3-24M259 440l1-28M263 440l5-22" strokeWidth="2.5" strokeLinecap="round" className="st-s-ink"/>
      <rect x="248" y="438" width="22" height="30" rx="2" className="st-f-sage"/>
      <path d="M291 450l-2-20M296 450l3-18" strokeWidth="2.5" strokeLinecap="round" className="st-s-terrad"/>
      <rect x="282" y="448" width="22" height="20" rx="2" className="st-f-mustard"/>
      <circle cx="319" cy="461" r="7" className="st-f-terra"/><circle cx="332" cy="463" r="5" className="st-f-indigo"/>
      {/* sewing machine */}
      <rect x="342" y="468" width="62" height="10" rx="2" className="st-f-woodd"/>
      <rect x="346" y="464" width="32" height="4" className="st-f-terra"/>
      <rect x="388" y="434" width="14" height="34" rx="3" className="st-f-indigo"/>
      <rect x="346" y="434" width="50" height="13" rx="6" className="st-f-indigo"/>
      <rect x="346" y="444" width="14" height="18" rx="3" className="st-f-indigo"/>
      <rect x="352" y="438" width="30" height="2" rx="1" className="st-f-chalk" opacity=".5"/>
      <path d="M352 462v4" strokeWidth="1" className="st-s-ink"/>
      <circle cx="402" cy="440" r="7" className="st-f-chalk" strokeWidth="1.5" style={{ stroke: 'var(--stall-terra-d)' }}/>
      <rect x="366" y="424" width="9" height="10" rx="1" className="st-f-mustard"/>
      <path d="M370 424q-10 4-18 20" fill="none" strokeWidth="1" className="st-s-terrad"/>
      {/* UPI QR stand */}
      <rect x="474" y="444" width="26" height="34" rx="2" className="st-f-chalk"/>
      <text x="487" y="454" textAnchor="middle" fontSize="6" fontWeight="600" className="st-t-ink">UPI</text>
      <rect x="478" y="458" width="7" height="7" className="st-f-board"/><rect x="489" y="458" width="7" height="7" className="st-f-board"/><rect x="478" y="469" width="7" height="7" className="st-f-board"/>
      <rect x="479.5" y="459.5" width="4" height="4" className="st-f-chalk"/><rect x="490.5" y="459.5" width="4" height="4" className="st-f-chalk"/><rect x="479.5" y="470.5" width="4" height="4" className="st-f-chalk"/>
      <rect x="490" y="470" width="3" height="3" className="st-f-board"/><rect x="495" y="466" width="3" height="3" className="st-f-board"/><rect x="493" y="474" width="3" height="3" className="st-f-board"/>

      {/* counter */}
      <rect x="64" y="478" width="472" height="14" rx="3" className="st-f-chalk"/>
      <rect x="70" y="492" width="460" height="100" className="st-f-green"/>
      <rect x="70" y="502" width="460" height="60" fill="url(#st-blk)"/>
      <rect x="70" y="580" width="460" height="12" className="st-f-terra"/>

      {/* outside pots */}
      <ellipse cx="38" cy="536" rx="26" ry="22" className="st-f-green"/>
      <circle cx="26" cy="520" r="9" className="st-f-mustard"/><circle cx="41" cy="514" r="9" className="st-f-terra"/>
      <circle cx="52" cy="526" r="8" className="st-f-mustard"/><circle cx="33" cy="533" r="8" className="st-f-terra"/>
      <path d="M14 548H62L56 596H20Z" className="st-f-terrad"/>
      <rect x="12" y="544" width="52" height="8" rx="3" className="st-f-terra"/>
      <path d="M552 596C548 576 552 560 566 556H586C598 562 600 580 596 596Z" className="st-f-indigo"/>
      <rect x="556" y="552" width="36" height="7" rx="3" className="st-f-mustard"/>
      <path d="M544 596C540 584 544 574 554 572H560L558 596Z" className="st-f-terra"/>

      {/* shoppers */}
      <g transform="translate(140 0)"><g className="st-bob b1">
      <rect x="-8" y="620" width="7" height="38" rx="2" className="st-f-sage"/><rect x="1" y="620" width="7" height="38" rx="2" className="st-f-sage"/>
      <ellipse cx="-5" cy="660" rx="6" ry="3" className="st-f-board"/><ellipse cx="5" cy="660" rx="6" ry="3" className="st-f-board"/>
      <path d="M-14 628L-11 572Q0 566 11 572L14 628Z" className="st-f-terra"/>
      <path d="M-12 574Q0 580 12 574L13 606Q0 614 -13 606Z" className="st-f-mustard"/>
      <rect x="-3" y="563" width="6" height="8" className="st-f-skin"/>
      <circle cx="0" cy="553" r="11.5" className="st-f-hair"/><circle cx="0" cy="538" r="5" className="st-f-hair"/><path d="M-1 563Q-5 588 1 606" fill="none" strokeWidth="4" strokeLinecap="round" className="st-s-hair"/>
      <path d="M-11 578L-16 606" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="st-s-skin"/><path d="M11 578L17 604" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="st-s-skin"/><rect x="14" y="603" width="18" height="20" rx="2" className="st-f-chalk"/><rect x="14" y="611" width="18" height="4" className="st-f-terra"/><path d="M18 603Q23 594 28 603" fill="none" strokeWidth="1.5" className="st-s-woodd"/>
      </g></g>
      <g transform="translate(250 0)"><g className="st-bob b2">
      <rect x="-6" y="620" width="7" height="38" rx="2" className="st-f-chalk"/><rect x="1" y="620" width="7" height="38" rx="2" className="st-f-chalk"/>
      <ellipse cx="-2" cy="660" rx="7" ry="3" className="st-f-board"/><ellipse cx="6" cy="660" rx="7" ry="3" className="st-f-board"/>
      <path d="M-9 628L-8 572Q0 566 9 572L10 628Z" className="st-f-indigo"/>
      
      <rect x="-3" y="563" width="6" height="8" className="st-f-skin2"/>
      <circle cx="0" cy="553" r="11" className="st-f-skin2"/>
      <path d="M10 552L15.5 557L10 559.5Z" className="st-f-skin2"/>
      <path d="M-11 556Q-13 540 0 540Q10 540 11 549Q4 546 -3 548Q-7 551 -8 558Z" className="st-f-hair"/>
      <circle cx="-1" cy="556" r="2" className="st-f-skin2" opacity=".7"/>
      <circle cx="5" cy="552" r="1" className="st-f-hair"/>
      <path d="M7 561q2 1 4 0" fill="none" strokeWidth="1" className="st-s-terrad"/>
      <g className="st-inspect"><path d="M6 578L26 570L28 554" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="st-s-skin2"/><path d="M23 556Q21 546 25 542H31Q35 546 33 556Z" className="st-f-terra"/><rect x="24" y="540" width="8" height="3" rx="1" className="st-f-mustard"/></g>
      </g></g>
      <g transform="translate(345 0)"><g className="st-bob b3">
      <g transform="scale(-1 1)">
      <rect x="-6" y="620" width="7" height="38" rx="2" className="st-f-indigo"/><rect x="1" y="620" width="7" height="38" rx="2" className="st-f-indigo"/>
      <ellipse cx="-2" cy="660" rx="7" ry="3" className="st-f-board"/><ellipse cx="6" cy="660" rx="7" ry="3" className="st-f-board"/>
      <path d="M-9 628L-8 572Q0 566 9 572L10 628Z" className="st-f-chalk"/>
      <path d="M-8 574Q4 588 10 576L12 610Q2 604 -4 590Z" className="st-f-terra"/>
      <rect x="-3" y="563" width="6" height="8" className="st-f-skin2"/>
      <circle cx="0" cy="553" r="11" className="st-f-skin2"/>
      <path d="M10 552L15.5 557L10 559.5Z" className="st-f-skin2"/>
      <path d="M-11 556Q-13 540 0 540Q10 540 11 549Q4 546 -3 548Q-7 551 -8 558Z" className="st-f-hair"/><circle cx="-9" cy="542" r="5" className="st-f-hair"/>
      <circle cx="-1" cy="556" r="2" className="st-f-skin2" opacity=".7"/>
      <circle cx="5" cy="552" r="1" className="st-f-hair"/>
      <path d="M7 561q2 1 4 0" fill="none" strokeWidth="1" className="st-s-terrad"/>
      <path d="M2 578L16 598" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="st-s-skin2"/><rect x="13" y="596" width="16" height="14" className="st-f-mustard"/><path d="M21 596V610M13 603H29" strokeWidth="2" fill="none" className="st-s-terrad"/>
      </g>
      </g></g>
      <g transform="translate(435 0)"><g className="st-bob b1">
      <rect x="-8" y="620" width="7" height="38" rx="2" className="st-f-indigo"/><rect x="1" y="620" width="7" height="38" rx="2" className="st-f-indigo"/>
      <ellipse cx="-5" cy="660" rx="6" ry="3" className="st-f-board"/><ellipse cx="5" cy="660" rx="6" ry="3" className="st-f-board"/>
      <path d="M-14 628L-11 572Q0 566 11 572L14 628Z" className="st-f-terra"/>
      <path d="M0 574V626" strokeWidth="1" className="st-s-terrad" opacity=".5"/>
      <rect x="-3" y="563" width="6" height="8" className="st-f-skin"/>
      <circle cx="0" cy="553" r="11" className="st-f-hair"/><circle cx="-11" cy="555" r="2" className="st-f-skin"/><circle cx="11" cy="555" r="2" className="st-f-skin"/>
      <path d="M-11 578L-16 606" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="st-s-skin"/><path d="M11 578L22 566L24 552" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="st-s-skin"/><rect x="21" y="540" width="7" height="12" rx="1.5" className="st-f-board"/><path d="M32 546q5 6 0 12M36 543q8 9 0 18" fill="none" strokeWidth="1.3" className="st-s-mustard st-blink"/>
      </g></g>
      {/* easel sign: drawn only when it has words, and a link when the admin gave it somewhere to go */}
      {hasChalkboard({ chalkLabel, chalkTitle, chalkSub }) && (() => {
        const board = (
          <>
        <line x1="500" y1="586" x2="490" y2="660" strokeWidth="3" className="st-s-woodd"/><line x1="524" y1="586" x2="534" y2="660" strokeWidth="3" className="st-s-woodd"/>
        <rect x="480" y="548" width="64" height="44" rx="3" className="st-f-board"/>
        <rect x="480" y="548" width="64" height="44" rx="3" fill="none" strokeWidth="2" className="st-s-woodd"/>
        <Fitted value={chalkLabel.toUpperCase()} original={D.chalkLabel.toUpperCase()} x={512} y={562} size={6} width={54} textAnchor="middle" fontWeight="600" letterSpacing="1.5" className="st-t-mustard"/>
        <Fitted value={chalkTitle} original={D.chalkTitle} x={512} y={575} size={8} width={54} textAnchor="middle" fontWeight="600" className="st-t-chalk"/>
        <Fitted value={chalkSub} original={D.chalkSub} x={512} y={585} size={6.5} width={54} textAnchor="middle" className="st-t-chalk" opacity=".85"/>
          </>
        );
        if (!chalkHref) return <g>{board}</g>;
        const label = [chalkLabel, chalkTitle, chalkSub].filter(Boolean).join('. ');
        return chalkHref.startsWith('/')
          ? <Link href={chalkHref} className="st-board-link" aria-label={label}>{board}</Link>
          : <a href={chalkHref} className="st-board-link" aria-label={label} target="_blank" rel="noopener noreferrer">{board}</a>;
      })()}
      {/* badge */}
      <g transform="translate(550 92)">
      <circle r="38" className="st-f-chalk"/>
      <circle r="38" fill="none" strokeWidth="1" className="st-s-terrad" opacity=".5"/>
      <g className="st-spin">
      <text fontSize="7.5" fontWeight="600" letterSpacing="1.4" className="st-t-terrad">
      <textPath href="#st-badge-path" textLength="160">MADE BY HAND · MADE IN INDIA ·</textPath>
      </text>
      </g>
      <g className="st-f-terra">
      <circle r="4" cx="0" cy="-8"/><circle r="4" cx="8" cy="-2"/><circle r="4" cx="5" cy="7"/>
      <circle r="4" cx="-5" cy="7"/><circle r="4" cx="-8" cy="-2"/>
      </g>
      <circle r="3" className="st-f-mustard"/>
      </g>

      {/* caption */}
      <text x="300" y="706" textAnchor="middle" className="st-t-ink" fontSize="17" fontStyle="italic">A little more handmade goes a long way.</text>

      <StickerLayer placements={stickers} />
    </svg>
  );
}
