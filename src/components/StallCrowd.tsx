import type { CSSProperties, ReactNode } from 'react';
import { StallRange } from './StallRange';

/**
 * The people who move in front of the home stall (HeroStall). All of it is CSS animation, so it needs no script and is in the first HTML;
 * StallRange only tells them how wide the hero section is, so that they can walk across all of it (behind the text).
 *
 * - Two buyers each walk up, stop at the counter and hold up a piece; the maker on the left wraps it, the maker on the right takes their money
 *   (a note travels across and a coin pops up), the parcel slides over, and the buyer walks off with it.
 * - Visitors stroll along the front, never stopping, except the two selfie takers (about ten seconds each, once a loop): a shopper with an armful
 *   of bags, a rich tourist with a camera and hat, a woman in a saree, a man in a kurta and turban, a woman with a long plait, a man looking at a
 *   pot and a woman with a parcel. They come from either side of the section. Nobody stands still for long: the longest stop is a buyer at the
 *   counter (about fifteen seconds), and the makers behind the counter keep wrapping, waving and nodding.
 * - Loops have different lengths and start at different points, so the scene never repeats in step.
 *
 * Everything is drawn from the stall's own colour classes (.st-f-*), so it follows light and dark. With reduced motion the whole layer is hidden
 * (and the Shilpgram stall has none of the standing shoppers).
 *
 * The crowd belongs to the Shilpgram look (ShilpgramStall) only. The everyday stall (HeroStall) has no crowd and keeps its four standing shoppers, so when the
 * Shilpgram theme ends the walking stops and the stall is exactly the one it was before.
 */
type Outfit = 'plain' | 'tourist' | 'saree' | 'kurta';
type Look = {
  shirt: string; pants: string; skin: 's' | 's2' | 'pale';
  hair: 'bun' | 'short' | 'turban' | 'hat';
  outfit?: Outfit;
  /** Shopping bags hanging from one hand (their colours). */
  bags?: string[];
  /** Holding a phone up at arm's length. */
  phone?: boolean; camera?: boolean; shades?: boolean; moustache?: boolean; flowers?: boolean;
  /** A long plait down the back. */
  braid?: boolean;
  /** Holding a piece up to look at it, or carrying a wrapped parcel in front. */
  piece?: boolean; parcel?: boolean;
};
const skinF = (l: Look) => (l.skin === 's' ? 'st-f-skin' : l.skin === 's2' ? 'st-f-skin2' : 'st-f-chalk');
const skinS = (l: Look) => (l.skin === 's' ? 'st-s-skin' : l.skin === 's2' ? 'st-s-skin2' : 'st-s-chalk');
const vars = (v: Record<string, string | number>) => v as CSSProperties;
const Arm = ({ l, d, cls }: { l: Look; d: string; cls?: string }) => <path className={`${cls ?? ''} ${skinS(l)}`.trim()} d={d} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />;

/** Feet on y 660, hips on y 620, centred on x 0: the size of the stall's other shoppers. */
function Legs({ l, walk }: { l: Look; walk: boolean }) {
  const tourist = l.outfit === 'tourist';
  const leg = (x: number, shoe: number, cls?: string) => (
    <g className={walk ? `st-leg ${cls}` : undefined}>
      <rect x={x} y="620" width="7" height={tourist ? 21 : 38} rx="2" className={l.pants} />
      {tourist && <rect x={x} y="640" width="7" height="18" rx="2" className={skinF(l)} />}
      <ellipse cx={shoe} cy="660" rx="7" ry="3" className="st-f-board" />
    </g>
  );
  return <>{leg(-6, -2, 'a')}{leg(1, 5, 'b')}</>;
}

function Outfit({ l }: { l: Look }) {
  switch (l.outfit) {
    case 'saree': return (
      <>
        <path d="M-10 622L-15 655Q0 663 15 655L10 622Z" className={l.shirt} />
        <path d="M-15 655Q0 663 15 655L14.3 650Q0 658 -14.3 650Z" className="st-f-mustard" />
        <path d="M-9 628L-8 572Q0 566 9 572L10 628Z" className={l.shirt} />
        <path d="M-8.5 573Q0 568 8.5 573L9 586H-9Z" className="st-f-terra" />
        <path d="M-8 575L10 624L6.5 628L-9 582Z" className="st-f-mustard" opacity=".92" />
      </>
    );
    case 'kurta': return (
      <>
        <path d="M-10 652L-8 572Q0 566 9 572L11 652Z" className={l.shirt} />
        <path d="M0 571V600" strokeWidth="1.2" fill="none" className="st-s-terrad" />
        <path d="M-8 574L9 622L5.5 626L-9 581Z" className="st-f-mustard" opacity=".95" />
      </>
    );
    default: return <path d="M-9 628L-8 572Q0 566 9 572L10 628Z" className={l.shirt} />;
  }
}

function Head({ l }: { l: Look }) {
  return (
    <>
      <rect x="-3" y="563" width="6" height="8" className={skinF(l)} />
      <circle cx="0" cy="553" r="11" className={skinF(l)} {...(l.skin === 'pale' ? { stroke: 'none' } : {})} />
      {l.skin === 'pale' && <circle cx="0" cy="553" r="11" fill="none" strokeWidth="1" className="st-s-woodd" opacity=".35" />}
      <path d="M10 552L15.5 557L10 559.5Z" className={skinF(l)} />
      {l.hair === 'bun' && <><path d="M-11 556Q-13 540 0 540Q10 540 11 549Q4 546 -3 548Q-7 551 -8 558Z" className="st-f-hair" /><circle cx="-9" cy="542" r="5" className="st-f-hair" />
        {l.flowers && <g className="st-f-mustard"><circle cx="-12" cy="541" r="1.8" /><circle cx="-9" cy="537" r="1.8" /><circle cx="-6" cy="541" r="1.8" /></g>}</>}
      {l.hair === 'short' && <path d="M-11 553Q-12 540 0 540Q11 540 11 551Q4 546 -2 547Q-8 548 -11 553Z" className="st-f-hair" />}
      {l.hair === 'turban' && <>
        <path d="M-13 551Q-13 532 0 532Q13 532 13 551Q6 543 0 544Q-6 543 -13 551Z" className="st-f-terra" />
        <path d="M-12.5 547Q0 538 12.5 547" fill="none" strokeWidth="2" className="st-s-mustard" />
        <path d="M-9 536Q0 531 9 536" fill="none" strokeWidth="1.5" className="st-s-terrad" />
        <path d="M-13 549q-5 8 -2 16" fill="none" strokeWidth="4" strokeLinecap="round" className="st-s-terra" /></>}
      {l.hair === 'hat' && <>
        <path d="M-8 543Q-8 530 1 530Q10 530 10 543Z" className="st-f-mustard" />
        <ellipse cx="1" cy="543.5" rx="19" ry="4" className="st-f-mustard" />
        <path d="M-8 541.5H10" strokeWidth="2.2" className="st-s-terrad" /></>}
      {l.moustache && <path d="M3 560q4-3.5 9 0" fill="none" strokeWidth="1.6" strokeLinecap="round" className="st-s-hair" />}
      {l.shades && <><rect x="1.5" y="549" width="11" height="4.6" rx="1.8" className="st-f-board" /><path d="M-9 551H2" strokeWidth="1.2" className="st-s-ink" /></>}
      <circle cx="5" cy="552" r="1" className={`st-f-hair${l.shades ? ' st-hide' : ''}`} />
      {!l.shades && <path d="M7 561q2 1 4 0" fill="none" strokeWidth="1" className="st-s-terrad" />}
    </>
  );
}

const Bags = ({ colours }: { colours: string[] }) => (
  <g className="st-bags">
    {colours.map((c, i) => (
      <g key={i}>
        <path d={`M${5 + i * 4.5} ${607 + (i % 2) * 3}q3-8 7 0`} fill="none" strokeWidth="1.3" className="st-s-woodd" />
        <rect x={4 + i * 4.5} y={607 + (i % 2) * 3} width="12" height={14 + (i % 3) * 2} rx="1.5" className={c} />
        <path d={`M${4 + i * 4.5} ${612 + (i % 2) * 3}h12`} strokeWidth="1" className="st-s-chalk" opacity=".5" />
      </g>
    ))}
  </g>
);

/** A person, walking (legs and arms swing, the body bounces) or standing. `frontArm` replaces the front arm (a buyer holding up a piece). */
function Figure({ l, walk, frontArm, flash }: { l: Look; walk: boolean; frontArm?: ReactNode; flash?: boolean }) {
  const holding = l.bags?.length;
  return (
    <g className={walk ? 'st-step' : 'st-idle'}>
      <Legs l={l} walk={walk} />
      <Outfit l={l} />
      <Head l={l} />
      {l.braid && <path d="M-1 563Q-6 588 0 608" fill="none" strokeWidth="4" strokeLinecap="round" className="st-s-hair" />}
      {l.camera && <><path d="M-4 572Q-9 590 -1 593" fill="none" strokeWidth="1.5" className="st-s-ink" /><rect x="-3" y="589" width="15" height="10" rx="2" className="st-f-board" /><circle cx="5" cy="594" r="3.4" className="st-f-chalk" /><circle cx="5" cy="594" r="1.6" className="st-f-board" /></>}
      <Arm l={l} d="M-8 578L-11 604" {...(walk ? { cls: 'st-arm a' } : {})} />
      {frontArm ?? (l.phone
        ? <>
            <Arm l={l} d="M8 578L26 566L34 548" />
            <rect x="30" y="531" width="9" height="16" rx="1.6" className="st-f-board" /><rect x="31.4" y="533" width="6.2" height="11" rx="1" className="st-f-chalk" opacity=".85" />
            {flash && <circle className="st-cy sf-flash st-f-mustard" cx="38" cy="531" r="5.5" />}
          </>
        : l.piece
          ? <>
              <Arm l={l} d="M8 578L26 570L28 554" />
              <path d="M23 556Q21 546 25 542H31Q35 546 33 556Z" className="st-f-terra" /><rect x="24" y="540" width="8" height="3" rx="1" className="st-f-mustard" />
            </>
        : l.parcel
          ? <>
              <Arm l={l} d="M8 578L16 598" />
              <rect x="13" y="596" width="16" height="14" className="st-f-mustard" /><path d="M21 596V610M13 603H29" strokeWidth="2" fill="none" className="st-s-terrad" />
            </>
        : holding
          ? <><Arm l={l} d="M8 578L12 604" /><Bags colours={l.bags!} /></>
          : <Arm l={l} d="M8 578L12 604" {...(walk ? { cls: 'st-arm b' } : {})} />)}
    </g>
  );
}

const Walker = ({ l }: { l: Look }) => <Figure l={l} walk />;

/** A buyer at the counter: standing, a piece held up first, then the arm comes down. */
function Standing({ l }: { l: Look }) {
  return (
    <Figure l={l} walk={false} frontArm={
      <>
        <g className="st-cy show-down"><Arm l={l} d="M8 578L12 604" /></g>
        <g className="st-cy show-item">
          <Arm l={l} d="M8 578L26 570L28 554" />
          <path d="M23 556Q21 546 25 542H31Q35 546 33 556Z" className="st-f-terra" /><rect x="24" y="540" width="8" height="3" rx="1" className="st-f-mustard" />
        </g>
      </>
    } />
  );
}

/** One purchase, start to finish. `sx` is where the buyer stops at the counter; `t` and `d` are the loop length and where in it the page starts. */
function Purchase({ l, sx, t, d }: { l: Look; sx: number; t: string; d: string }) {
  return (
    <g className="st-deal" style={vars({ '--sx': sx, '--T': t, '--D': d })}>
      <g transform={`translate(${sx} 0)`}>
        <g className="st-cy buyer">
          <g className="st-cy show-walk"><Walker l={l} /></g>
          <g className="st-cy show-stand"><Standing l={l} /></g>
          {/* the money, from the buyer's hand to the maker on the right */}
          <g className="st-cy note"><rect x="-8" y="-5" width="16" height="10" rx="1.5" className="st-f-mustard" /><circle r="2.6" className="st-f-terrad" /></g>
          {/* the wrapped parcel: made on the counter, slid over, then carried off */}
          <g className="st-cy parcel">
            <rect x="-12" y="-19" width="24" height="19" rx="2" className="st-f-chalk" /><rect x="-12" y="-19" width="24" height="19" rx="2" fill="none" strokeWidth="1" className="st-s-woodd" />
            <path d="M0 -19V0M-12 -9.5H12" strokeWidth="2.5" className="st-s-terra" /><circle cx="0" cy="-20.5" r="3" className="st-f-terra" />
          </g>
        </g>
      </g>
      {/* the maker on the left wraps it */}
      <g className="st-cy show-wrap">
        <g className="st-wrap"><path className="st-s-skin" d="M204 412L212 468" strokeWidth="5" strokeLinecap="round" fill="none" /><circle cx="212" cy="469" r="4" className="st-f-skin" /></g>
      </g>
      {/* the maker on the right reaches out for the money, and a coin pops up when it is paid */}
      <g className="st-cy show-take"><path className="st-s-skin2" d="M420 414L410 456" strokeWidth="5" strokeLinecap="round" fill="none" /><circle cx="410" cy="457" r="4" className="st-f-skin2" /></g>
      <g className="st-cy coin"><circle cx="430" cy="340" r="10" className="st-f-mustard" /><text x="430" y="344.5" textAnchor="middle" fontSize="12" fontWeight="700" className="st-t-hair">₹</text></g>
    </g>
  );
}

/** Someone walking across the whole section, left to right or right to left, never stopping. `lane`: in front, or a little further back (smaller). */
function Passer({ l, dir, t, d, lane = 'front' }: { l: Look; dir: 'r' | 'l'; t: string; d: string; lane?: 'front' | 'back' }) {
  const place = lane === 'front' ? 'translate(0 26)' : 'translate(0 8) translate(0 660) scale(.92) translate(0 -660)';
  return (
    <g transform={place}>
      <g className={`st-pass ${dir}`} style={vars({ '--T': t, '--D': d })}>
        <g transform={dir === 'l' ? 'scale(-1 1)' : undefined}><Walker l={l} /></g>
      </g>
    </g>
  );
}

/** Walks in, stops part-way along, takes a few selfies (the flash goes off), and walks on. */
function SelfieTaker({ l, t, d }: { l: Look; t: string; d: string }) {
  return (
    <g transform="translate(0 26)">
      <g className="st-pass sf" style={vars({ '--T': t, '--D': d })}>
        <g className="st-cy sf-walk"><Walker l={l} /></g>
        <g className="st-cy sf-stand"><Figure l={l} walk={false} flash /></g>
      </g>
    </g>
  );
}

const MUSTARD_BUN: Look = { shirt: 'st-f-mustard', pants: 'st-f-green', skin: 's', hair: 'bun' };
const SAGE_SHORT: Look = { shirt: 'st-f-sage', pants: 'st-f-woodd', skin: 's2', hair: 'short' };
/** Selfie taker: bright top, phone up. */
const SELFIE: Look = { shirt: 'st-f-terra', pants: 'st-f-indigo', skin: 's', hair: 'short', phone: true };
/** An armful of shopping: four bags from one hand. */
const SHOPPER: Look = { shirt: 'st-f-indigo', pants: 'st-f-chalk', skin: 's', hair: 'bun', bags: ['st-f-terra', 'st-f-mustard', 'st-f-sage', 'st-f-board'] };
/** The rich tourist: straw hat, sunglasses, camera, linen shirt and shorts, a bag from each hand's worth of shops. */
const TOURIST: Look = { shirt: 'st-f-chalk', pants: 'st-f-wood', skin: 'pale', hair: 'hat', outfit: 'tourist', camera: true, shades: true, bags: ['st-f-board', 'st-f-mustard', 'st-f-terra'] };
const SAREE: Look = { shirt: 'st-f-indigo', pants: 'st-f-skin', skin: 's', hair: 'bun', outfit: 'saree', flowers: true };
/** The four who used to stand by the stall, now strolling: a woman with a long plait, a man looking at a pot, a woman carrying a parcel, and a second selfie taker. */
const PLAIT: Look = { shirt: 'st-f-mustard', pants: 'st-f-terra', skin: 's', hair: 'bun', braid: true };
const POT_MAN: Look = { shirt: 'st-f-indigo', pants: 'st-f-chalk', skin: 's2', hair: 'short', piece: true };
const PARCEL_WOMAN: Look = { shirt: 'st-f-chalk', pants: 'st-f-indigo', skin: 's2', hair: 'bun', parcel: true };
const SELFIE_2: Look = { shirt: 'st-f-sage', pants: 'st-f-woodd', skin: 's2', hair: 'bun', phone: true };
const KURTA: Look = { shirt: 'st-f-chalk', pants: 'st-f-chalk', skin: 's2', hair: 'turban', outfit: 'kurta', moustache: true };

export function StallCrowd() {
  return (
    <g className="st-crowd">
      <StallRange />
      <Purchase l={MUSTARD_BUN} sx={195} t="30s" d="-7s" />
      <Purchase l={SAGE_SHORT} sx={298} t="34s" d="-19s" />
      <Passer l={KURTA} dir="r" t="46s" d="-11s" lane="back" />
      <Passer l={SHOPPER} dir="l" t="40s" d="-26s" />
      <Passer l={TOURIST} dir="r" t="52s" d="-34s" />
      <Passer l={SAREE} dir="l" t="44s" d="-3s" lane="back" />
      <SelfieTaker l={SELFIE} t="48s" d="-17s" />
      <Passer l={PLAIT} dir="r" t="42s" d="-29s" lane="back" />
      <Passer l={POT_MAN} dir="l" t="50s" d="-8s" />
      <Passer l={PARCEL_WOMAN} dir="r" t="38s" d="-15s" />
      <SelfieTaker l={SELFIE_2} t="56s" d="-40s" />
    </g>
  );
}
