import { StickerLayer } from './theme/StickerLayer';
import { StallCrowd } from './StallCrowd';
import { Fitted, StallBadge, StallBoard } from './StallParts';
import { EVERYDAY } from '@/lib/themes/presets';
import { hasChalkboard, type Placement } from '@/lib/themes/types';

const D = EVERYDAY.config;

/**
 * The Shilpgram look of the home stall: a craft stall in a thatched village hut with painted mud walls and mirror work, the Aravalli hills
 * behind, and the same people walking past and buying (StallCrowd). It is a whole different picture, shown only while a theme that asks for it
 * (the Shilpgram Utsav preset) is live; otherwise the everyday stall (HeroStall) is shown.
 *
 * Same 600 × 720 picture as the everyday stall, with the ground at y 596, the counter top at y 470 and the two makers at x 212 and x 418, so the
 * crowd's walking, wrapping and paying lines up. Every colour is a stall token (.st-f-*, .st-s-*), so it follows light and dark.
 */
export function ShilpgramStall({ sign = D.sign, chalkLabel = D.chalkLabel, chalkTitle = D.chalkTitle, chalkSub = D.chalkSub, stickers = [], chalkHref }: { sign?: string; chalkLabel?: string; chalkTitle?: string; chalkSub?: string; stickers?: Placement[]; chalkHref?: string }) {
  const boardLink = !!chalkHref && hasChalkboard({ chalkLabel, chalkTitle, chalkSub });
  return (
    <svg className="hero-stall hero-stall-shilpgram" viewBox="0 0 600 720" focusable="false" {...(boardLink ? {} : { 'aria-hidden': true })}>
      <defs>
        <pattern id="sg-mand" width="40" height="40" patternUnits="userSpaceOnUse" x="100" y="346"><path d="M20 4L36 20L20 36L4 20Z" fill="none" strokeWidth="2" className="st-s-chalk"/><circle cx="20" cy="20" r="2.6" className="st-f-chalk"/><circle cx="0" cy="0" r="2" className="st-f-chalk"/><circle cx="40" cy="0" r="2" className="st-f-chalk"/><circle cx="0" cy="40" r="2" className="st-f-chalk"/><circle cx="40" cy="40" r="2" className="st-f-chalk"/></pattern>
        <pattern id="sg-mir" width="42" height="56" patternUnits="userSpaceOnUse" x="90" y="494"><circle cx="21" cy="18" r="11" className="st-f-chalk"/><circle cx="21" cy="18" r="7" className="st-f-indigo"/><circle cx="21" cy="18" r="2.4" className="st-f-chalk"/><path d="M21 42l4 4-4 4-4-4z" className="st-f-chalk"/></pattern>
        <pattern id="sg-gar" width="40" height="14" patternUnits="userSpaceOnUse" x="54" y="350"><circle cx="10" cy="7" r="6" className="st-f-mustard"/><circle cx="30" cy="7" r="6" className="st-f-terra"/></pattern>
        <pattern id="sg-dots" width="20" height="8" patternUnits="userSpaceOnUse"><circle cx="10" cy="4" r="2.4" className="st-f-chalk" opacity=".7"/></pattern>
        <path id="st-badge-path" d="M-27 0a27 27 0 1 1 54 0a27 27 0 1 1 -54 0"/>
      </defs>

      {/* sun, birds, the Aravalli hills, trees */}
      <circle cx="300" cy="262" r="170" className="st-f-sun"/>
      <path d="M78 108q8-8 16 0M100 94q8-8 16 0M60 130q6-6 12 0" fill="none" strokeWidth="2" strokeLinecap="round" className="st-s-woodd" opacity=".6"/>
      <path d="M0 470L60 410L130 450L210 380L290 440L370 395L450 445L530 400L600 440V596H0Z" className="st-f-hill2"/>
      <path d="M0 520L80 470L170 510L260 460L350 505L440 465L520 500L600 470V596H0Z" className="st-f-hill"/>
      <path d="M30 420V596" strokeWidth="10" fill="none" className="st-s-woodd"/>
      <circle cx="30" cy="350" r="36" className="st-f-leaf"/><circle cx="64" cy="372" r="28" className="st-f-leaf"/><circle cx="6" cy="384" r="26" className="st-f-leaf"/>
      <path d="M572 430V596" strokeWidth="8" fill="none" className="st-s-woodd"/>
      <circle cx="572" cy="372" r="32" className="st-f-leaf"/><circle cx="546" cy="394" r="24" className="st-f-leaf"/><circle cx="596" cy="396" r="22" className="st-f-leaf"/>

      {/* ground with a row of white dots, like the painted thresholds */}
      <rect x="0" y="596" width="600" height="124" className="st-f-ground"/>
      <rect x="0" y="610" width="600" height="8" fill="url(#sg-dots)"/>

      {/* mud side walls, the back wall painted with folk geometry, posts */}
      <rect x="60" y="346" width="40" height="250" className="st-f-mud"/><rect x="500" y="346" width="40" height="250" className="st-f-mud"/>
      <circle cx="80" cy="400" r="10" className="st-f-chalk"/><circle cx="80" cy="400" r="6.5" className="st-f-indigo"/><circle cx="80" cy="440" r="10" className="st-f-chalk"/><circle cx="80" cy="440" r="6.5" className="st-f-indigo"/>
      <circle cx="520" cy="400" r="10" className="st-f-chalk"/><circle cx="520" cy="400" r="6.5" className="st-f-indigo"/><circle cx="520" cy="440" r="10" className="st-f-chalk"/><circle cx="520" cy="440" r="6.5" className="st-f-indigo"/>
      <rect x="100" y="346" width="400" height="132" className="st-f-mudl"/><rect x="100" y="346" width="400" height="132" fill="url(#sg-mand)"/>
      <rect x="94" y="346" width="12" height="250" className="st-f-woodd"/><rect x="494" y="346" width="12" height="250" className="st-f-woodd"/>

      {/* a terracotta plaque and a miniature painting on the wall, a shelf of pots */}
      <circle cx="150" cy="394" r="28" className="st-f-terra"/><circle cx="150" cy="394" r="21" fill="none" strokeWidth="2" className="st-s-terrad"/><circle cx="150" cy="394" r="12" fill="none" strokeWidth="2" className="st-s-terrad"/>
      <circle cx="145" cy="391" r="2" className="st-f-board"/><circle cx="155" cy="391" r="2" className="st-f-board"/><path d="M144 400q6 4 12 0" fill="none" strokeWidth="2" className="st-s-terrad"/>
      <rect x="452" y="370" width="42" height="48" rx="2" className="st-f-chalk"/><rect x="457" y="375" width="32" height="38" className="st-f-sage"/><circle cx="473" cy="388" r="6" className="st-f-mustard"/><path d="M457 413L468 400L478 408L489 398V413Z" className="st-f-indigo"/>
      <rect x="104" y="428" width="392" height="7" className="st-f-wood"/>
      <path d="M112 428C104 428 104 410 112 404H132C140 410 140 428 132 428Z" className="st-f-indigo"/><path d="M110 414H134" strokeWidth="2" strokeDasharray="2 3" fill="none" className="st-s-chalk"/>
      <path d="M432 428C424 428 424 410 432 404H452C460 410 460 428 452 428Z" className="st-f-terra"/><path d="M430 414H454" strokeWidth="2" strokeDasharray="2 3" fill="none" className="st-s-chalk"/>
      <path d="M462 428a12 12 0 0 1 24 0z" className="st-f-mustard"/>

      {/* kathputli puppets hanging from a rod */}
      <rect x="258" y="350" width="84" height="4" rx="2" className="st-f-woodd"/>
      <path d="M276 354V372M324 354V370" strokeWidth="1" fill="none" className="st-s-woodd"/>
      <circle cx="276" cy="380" r="7" className="st-f-skin"/><path d="M269 378Q276 366 283 378z" className="st-f-terra"/>
      <path d="M265 424L276 392L287 424Z" className="st-f-indigo"/><path d="M267 404L262 414M285 404L290 414" strokeWidth="2.4" strokeLinecap="round" fill="none" className="st-s-mustard"/><path d="M270 424H282" strokeWidth="2" className="st-s-mustard"/>
      <circle cx="324" cy="378" r="7" className="st-f-skin2"/><path d="M316 376Q324 364 332 376z" className="st-f-mustard"/>
      <path d="M313 424L324 390L335 424Z" className="st-f-terra"/><path d="M315 402L310 412M333 402L338 412" strokeWidth="2.4" strokeLinecap="round" fill="none" className="st-s-chalk"/><path d="M318 424H330" strokeWidth="2" className="st-s-chalk"/>

      {/* the woman maker, in a saree: the pallu over her shoulder and over her head (a little shorter than the man) */}
      <g transform="translate(212 478) scale(.9) translate(-212 -478)"><g className="st-bob b1">
        <path d="M186 478V418Q186 394 212 394Q238 394 238 418V478Z" className="st-f-terra"/>
        <path d="M205 396L212 408L219 396z" className="st-f-skin"/>
        <path d="M188 404L202 394L240 446V472L226 472L188 426Z" className="st-f-indigo"/>
        <path d="M202 394L240 446M188 404L188 426L226 472" fill="none" strokeWidth="2.4" strokeLinecap="round" className="st-s-mustard"/>
        <circle cx="204" cy="414" r="1.6" className="st-f-chalk"/><circle cx="214" cy="428" r="1.6" className="st-f-chalk"/><circle cx="224" cy="442" r="1.6" className="st-f-chalk"/><circle cx="232" cy="456" r="1.6" className="st-f-chalk"/>
        <path d="M186 440V478M194 446V478M202 452V478" strokeWidth="1.4" fill="none" className="st-s-terrad" opacity=".55"/>
        <rect x="206" y="382" width="12" height="14" className="st-f-skin"/>
        <path d="M194 380Q190 342 212 340Q234 342 230 380Q233 394 238 410L226 406Q223 392 219 386L205 386Q201 392 198 406L186 410Q191 394 194 380Z" className="st-f-indigo"/>
        <path d="M194 380Q190 342 212 340Q234 342 230 380" fill="none" strokeWidth="2.4" className="st-s-mustard"/>
        <circle cx="212" cy="372" r="12" className="st-f-skin"/>
        <path d="M199 369Q198 353 212 352Q226 353 225 369Q220 361 212 361Q204 361 199 369Z" className="st-f-indigo"/>
        <path d="M199 369Q198 353 212 352Q226 353 225 369" fill="none" strokeWidth="2" className="st-s-mustard"/>
        <circle cx="212" cy="364.4" r="1.4" className="st-f-terrad"/>
        <ellipse cx="207.5" cy="371.5" rx="1.7" ry="1.4" className="st-f-hair"/><ellipse cx="216.5" cy="371.5" rx="1.7" ry="1.4" className="st-f-hair"/>
        <path d="M204.4 368.2q3.1-2 6.2 0M213.4 368.2q3.1-2 6.2 0" fill="none" strokeWidth="1" strokeLinecap="round" className="st-s-hair"/>
        <path d="M212 373v3.4" strokeWidth="1" strokeLinecap="round" fill="none" className="st-s-terrad"/><circle cx="214.2" cy="376.4" r="1.6" fill="none" strokeWidth=".9" className="st-s-mustard"/>
        <path d="M208.5 379.4q3.5 2.6 7 0" fill="none" strokeWidth="1.2" strokeLinecap="round" className="st-s-terrad"/>
        <circle cx="199.5" cy="377" r="2" className="st-f-mustard"/><circle cx="224.5" cy="377" r="2" className="st-f-mustard"/>
      </g></g>
      {/* the man maker: pagri, moustache, sash */}
      <g className="st-bob b2">
        <path d="M392 478V420Q392 396 418 396Q444 396 444 420V478Z" className="st-f-chalk"/>
        <path d="M392 442L444 464V476L392 454Z" className="st-f-mustard"/><path d="M406 398L418 418L430 398" fill="none" strokeWidth="1.6" className="st-s-terrad"/>
        <rect x="412" y="382" width="12" height="16" className="st-f-skin2"/><circle cx="418" cy="370" r="14" className="st-f-skin2"/>
        <path d="M402 366Q400 340 418 338Q436 340 434 366Q426 354 418 354Q410 354 402 366Z" className="st-f-terra"/>
        <path d="M403 358Q418 346 433 358M404 351Q418 340 432 351" fill="none" strokeWidth="1.6" className="st-s-mustard"/><path d="M432 352q10 10 5 26" fill="none" strokeWidth="5" strokeLinecap="round" className="st-s-terra"/>
        <ellipse cx="412.5" cy="369" rx="1.8" ry="1.5" className="st-f-hair"/><ellipse cx="423.5" cy="369" rx="1.8" ry="1.5" className="st-f-hair"/>
        <path d="M409 364.6q3.5-2.4 7 0M420 364.6q3.5-2.4 7 0" fill="none" strokeWidth="1.3" strokeLinecap="round" className="st-s-hair"/>
        <path d="M418 370v5" strokeWidth="1" strokeLinecap="round" fill="none" opacity=".5" className="st-s-hair"/>
        <path d="M409 379q9-7 18 0" fill="none" strokeWidth="2.4" strokeLinecap="round" className="st-s-hair"/><path d="M409 379q-3.4 0-3.4-3.6M427 379q3.4 0 3.4-3.6" fill="none" strokeWidth="1.6" strokeLinecap="round" className="st-s-hair"/>
        <path d="M414.5 383q3.5 2 7 0" fill="none" strokeWidth="1.2" strokeLinecap="round" opacity=".7" className="st-s-hair"/>
        <circle cx="404" cy="375" r="2.4" className="st-f-mustard"/><circle cx="432" cy="375" r="2.4" className="st-f-mustard"/>
      </g>

      {/* the mud counter with mirror work */}
      <rect x="84" y="470" width="432" height="14" rx="3" className="st-f-wood"/>
      <rect x="90" y="484" width="420" height="112" className="st-f-mud"/><rect x="90" y="484" width="420" height="112" fill="url(#sg-mir)"/>
      <rect x="90" y="584" width="420" height="12" className="st-f-terrad"/>

      {/* on the counter: diyas, stacked pots, a plaque, bandhani cloth */}
      <path d="M110 470q0-10 10-10t10 10z" className="st-f-terra"/><path d="M120 452q4 5 0 9q-4-4 0-9z" className="st-f-mustard"/>
      <path d="M138 470q0-10 10-10t10 10z" className="st-f-terra"/><path d="M148 452q4 5 0 9q-4-4 0-9z" className="st-f-mustard"/>
      <path d="M166 470q0-10 10-10t10 10z" className="st-f-terra"/><path d="M176 452q4 5 0 9q-4-4 0-9z" className="st-f-mustard"/>
      <path d="M254 470C246 470 244 448 254 440L256 432H274L276 440C286 448 284 470 276 470Z" className="st-f-terra"/><path d="M250 450H280M251 460H279" strokeWidth="2" strokeDasharray="2 3" fill="none" className="st-s-chalk"/>
      <path d="M286 470C281 470 280 456 286 450H300C306 456 305 470 300 470Z" className="st-f-indigo"/>
      <circle cx="340" cy="446" r="24" transform="rotate(-8 340 446)" className="st-f-terra"/><circle cx="340" cy="446" r="17" fill="none" strokeWidth="2" className="st-s-terrad"/><circle cx="340" cy="446" r="9" fill="none" strokeWidth="2" className="st-s-terrad"/><rect x="332" y="466" width="16" height="4" className="st-f-woodd"/>
      <rect x="446" y="456" width="52" height="14" className="st-f-mustard"/><rect x="450" y="443" width="46" height="13" className="st-f-terra"/><rect x="454" y="430" width="40" height="13" className="st-f-indigo"/>
      <path d="M452 463h6M464 463h6M476 463h6M488 463h6M456 450h6M468 450h6M480 450h6M460 437h6M472 437h6M484 437h6" strokeWidth="2.4" strokeLinecap="round" fill="none" className="st-s-chalk"/>

      {/* the thatched roof, ridge and kalash, the garland, the name board */}
      <path d="M54 346L142 200H458L546 346Z" className="st-f-thatch"/>
      <path d="M86 290H514M104 262H496M122 234H478M70 318H530" strokeWidth="2" strokeDasharray="14 6" fill="none" opacity=".7" className="st-s-thatchd"/>
      <rect x="54" y="344" width="492" height="8" className="st-f-thatchd"/>
      <rect x="128" y="192" width="344" height="14" rx="7" className="st-f-thatchd"/>
      <path d="M290 192V178a10 10 0 0 1 20 0V192z" className="st-f-terra"/><rect x="287" y="190" width="26" height="5" rx="2" className="st-f-terrad"/><circle cx="300" cy="166" r="5" className="st-f-mustard"/><path d="M300 160q-8-8-14-4M300 160q8-8 14-4" fill="none" strokeWidth="2" className="st-s-leaf"/>
      <rect x="54" y="350" width="492" height="14" fill="url(#sg-gar)"/>
      <rect x="212" y="258" width="176" height="40" rx="4" strokeWidth="2" className="st-f-board st-s-mustard"/>
      <path d="M218 264H382M218 292H382" strokeWidth="2" strokeDasharray="1 5" strokeLinecap="round" fill="none" className="st-s-mustard"/>
      <Fitted value={sign} original={D.sign} x={300} y={283} size={14} width={150} textAnchor="middle" fontStyle="italic" className="st-t-chalk"/>

      {/* clay pots and a brass kalash out front */}
      <path d="M12 596C2 580 6 560 24 556H46C64 560 68 580 58 596Z" className="st-f-terra"/>
      <path d="M54 596C44 580 48 560 66 556H88C106 560 110 580 100 596Z" className="st-f-terrad"/>
      <path d="M34 556C28 546 30 532 42 528H62C74 532 76 546 70 556Z" className="st-f-mustard"/>
      <path d="M14 578H56M58 578H98" strokeWidth="2.4" strokeDasharray="2 4" fill="none" className="st-s-chalk"/>
      <path d="M528 596C520 578 526 560 544 556H564C582 560 588 578 580 596Z" className="st-f-mustard"/><rect x="536" y="550" width="36" height="8" rx="3" className="st-f-thatchd"/>
      <path d="M532 576H570M530 586H572" strokeWidth="2" fill="none" className="st-s-terrad"/>
      <circle cx="544" cy="540" r="9" className="st-f-terra"/><circle cx="558" cy="536" r="9" className="st-f-mustard"/><circle cx="551" cy="528" r="9" className="st-f-terra"/><path d="M538 548q-12-8-18-4M566 548q12-8 18-4" fill="none" strokeWidth="3" className="st-s-leaf"/>

      {/* the easel sign stands left of the kalash (and in front of the counter's end); a link when the admin gave it somewhere to go */}
      {hasChalkboard({ chalkLabel, chalkTitle, chalkSub }) && <g transform="translate(-34 0)"><StallBoard {...{ chalkLabel, chalkTitle, chalkSub, chalkHref }} /></g>}
      <StallBadge />

      <text x="300" y="706" textAnchor="middle" className="st-t-ink" fontSize="17" fontStyle="italic">A little more handmade goes a long way.</text>

      <StickerLayer placements={stickers} />

      {/* the same people walk past and buy: drawn last so nothing in the picture covers them */}
      <StallCrowd />
    </svg>
  );
}
