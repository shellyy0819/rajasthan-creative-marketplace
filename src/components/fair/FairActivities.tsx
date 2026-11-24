'use client';
import { gaFairActivityStart } from '@/lib/ga-events';
import { useEffect, useRef, useState } from 'react';
import { money } from '@/lib/money';
import type { FairData } from '@/lib/fair-types';
import { Sheet } from './FairSheets';
import { FOLK_SECONDS } from './folk';
import { TUG_SECONDS, tugResult, tugTap, tugTick, type TugResult } from './tug';

/** The things to do at Pushkar during the mela. Each is a sheet that opens when you click its place in the fair or its card in the side panel. */

export function BalloonSheet({ onRide, onClose }: { onRide: () => void; onClose: () => void }) {
  return (
    <Sheet labelId="fair-balloon-h" onClose={onClose}>
      <h2 id="fair-balloon-h">Hot air balloon ride</h2>
      <p className="fair-say">Hot air balloon rides are one of the sights at the Pushkar Camel Fair. Climb into the basket and float over the whole fair for ten seconds.</p>
      <div className="fair-sheet-foot"><button type="button" className="button" onClick={onClose}>Not now</button><button type="button" className="button primary" onClick={onRide}>Take the ride</button></div>
    </Sheet>
  );
}

export function MusicSheet({ muted, onPlay, onClose }: { muted: boolean; onPlay: () => void; onClose: () => void }) {
  return (
    <Sheet labelId="fair-music-h" onClose={onClose}>
      <h2 id="fair-music-h">Folk music</h2>
      <p className="fair-say">Three musicians sit on the stage with a dholak, a kamaicha and a pair of khartals. Ask them to play and the shoppers will come over to listen.</p>
      <p className="fair-note">{muted ? 'Sound is off, so you will see them play but not hear them. Switch sound on from the menu.' : `A tune of about ${FOLK_SECONDS} seconds, made in your browser.`}</p>
      <div className="fair-sheet-foot"><button type="button" className="button" onClick={onClose}>Not now</button><button type="button" className="button primary" onClick={onPlay}>Ask them to play</button></div>
    </Sheet>
  );
}

/** One villager in the tug of war, seen from the side, holding the rope. `face` is the way the rope is (1 right, -1 left); `lean` tips the body back (degrees); `up` raises the arms and `fallen` puts them on their back. */
function Villager({ x, face, lean, top, turban, skin, up, fallen }: { x: number; face: 1 | -1; lean: number; top: string; turban: string; skin: string; up: boolean; fallen: boolean }) {
  const tilt = fallen ? -face * 82 : -face * lean;
  return (
    <g transform={`translate(${x} 132) rotate(${tilt})`}>
      <rect x="-7" y="-30" width="6" height="30" rx="2" fill="var(--stall-chalk)" /><rect x="1" y="-30" width="6" height="30" rx="2" fill="var(--stall-chalk)" />
      <rect x="-10" y="-60" width="20" height="32" rx="5" fill={top} />
      {up ? <path d="M-8 -54 L-13 -80 M8 -54 L13 -80" stroke={skin} strokeWidth="4" strokeLinecap="round" fill="none" /> : <path d={`M0 -54 L${face * 24} -46 M0 -50 L${face * 22} -44`} stroke={skin} strokeWidth="4" strokeLinecap="round" fill="none" />}
      <circle cx={face * 1} cy="-69" r="8" fill={skin} />
      <ellipse cx={face * 1} cy="-75" rx="10" ry="6" fill={turban} /><rect x="-8" y="-73" width="18" height="2" fill="var(--stall-chalk)" />
    </g>
  );
}

/** The tug of war as a picture: two teams on the sand pulling a rope with a red ribbon on it. The teams lean and heave, and the whole scene slides towards the side that is winning. */
function TugScene({ pos, clock, heave, result }: { pos: number; clock: number; heave: boolean; result: TugResult }) {
  const shift = pos * 26, wave = (i: number) => Math.sin(clock * 9 + i * 1.3) * 2.5;
  const village = [{ top: '#b3262e', skin: 'var(--stall-skin-2)' }, { top: 'var(--stall-chalk)', skin: 'var(--stall-skin)' }, { top: '#35506f', skin: 'var(--stall-skin-2)' }, { top: '#405746', skin: 'var(--stall-skin)' }];
  const yours = [{ top: '#c66b43', skin: 'var(--stall-skin)' }, { top: '#405746', skin: 'var(--stall-skin-2)' }, { top: '#35506f', skin: 'var(--stall-skin)' }, { top: '#d9a441', skin: 'var(--stall-skin-2)' }];
  const mine = 9 + (heave ? 9 : 0) + Math.max(0, pos) * 5, theirs = 9 + Math.max(0, -pos) * 7;
  const markX = 200 + pos * 120, sag = 6 + Math.sin(clock * 6) * 1.2;
  const label = result === 'won' ? 'Your team has pulled the village team over the line.' : result === 'lost' ? 'The village team has pulled your team over the line.' : pos > .08 ? 'Your team is pulling the rope your way.' : pos < -.08 ? 'The village team is pulling the rope their way.' : 'Both teams are pulling evenly.';
  return (
    <svg className="fair-tugscene" viewBox="0 0 400 170" role="img" aria-label={label}>
      <rect width="400" height="170" fill="var(--cream)" />
      <path d="M0 96 L70 56 L120 86 L190 40 L260 84 L320 52 L400 90 L400 120 L0 120 Z" fill="var(--sage)" opacity=".35" />
      <path d="M0 22 H400" stroke="var(--stall-wood-d)" strokeWidth="1.2" fill="none" />
      {Array.from({ length: 13 }, (_, i) => <path key={i} d={`M${i * 33 - 8} 22 h16 l-8 17 z`} fill={['var(--orange)', 'var(--stall-mustard)', 'var(--stall-indigo)'][i % 3]} />)}
      <ellipse cx="200" cy="134" rx="196" ry="26" fill="var(--stall-mustard)" opacity=".5" />
      <path d="M200 70 V146" stroke="var(--ink-soft)" strokeWidth="1.5" strokeDasharray="4 4" opacity=".6" />
      <path d="M80 118 V146 M320 118 V146" stroke="var(--stall-wood-d)" strokeWidth="2.5" />
      {village.map((v, i) => <Villager key={`v${i}`} x={44 + i * 29 + shift} face={1} lean={theirs + wave(i)} top={v.top} skin={v.skin} turban="var(--stall-indigo)" up={result === 'lost'} fallen={result === 'won'} />)}
      {yours.map((v, i) => <Villager key={`y${i}`} x={344 - i * 29 + shift} face={-1} lean={mine + wave(i + 4)} top={v.top} skin={v.skin} turban="var(--stall-mustard)" up={result === 'won'} fallen={result === 'lost'} />)}
      <path d={`M10 86 Q200 ${86 + sag} 390 86`} stroke="var(--stall-chalk)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d={`M10 86 Q200 ${86 + sag} 390 86`} stroke="var(--stall-wood)" strokeWidth="1.2" strokeDasharray="3 3" fill="none" />
      <path d={`M${markX - 7} ${86 + sag * .6} h14 l-7 22 z`} fill="#b3262e" />
      <text x="8" y="164" fontSize="11" fontWeight="600" fill="var(--muted)">Village team</text>
      <text x="392" y="164" fontSize="11" fontWeight="600" textAnchor="end" fill="var(--muted)">Your team</text>
    </svg>
  );
}

/** A tug of war against the village team: tap Pull as fast as you can. The rope marker moves towards your side with every tap and back towards theirs all the time. */
export function SportsSheet({ onFinish, onClose, onStart }: { onFinish: (won: boolean) => void; onClose: () => void; onStart?: () => void }) {
  const [pos, setPos] = useState(0), [elapsed, setElapsed] = useState(0), [running, setRunning] = useState(false), [result, setResult] = useState<TugResult>(null), [cool, setCool] = useState(false);
  const live = useRef({ pos: 0, elapsed: 0, tap: 0 }), over = useRef(false), doneRef = useRef(onFinish); doneRef.current = onFinish;
  const sync = () => {
    const { pos: p, elapsed: e } = live.current; setPos(p); setElapsed(e);
    const r = tugResult(p, e);
    if (r && !over.current) { over.current = true; setRunning(false); setResult(r); setCool(true); doneRef.current(r === 'won'); }   // once: the timer may tick again before the screen has caught up
  };
  useEffect(() => { if (!cool) return; const id = setTimeout(() => setCool(false), 1200); return () => clearTimeout(id); }, [cool]);   // a tap meant for Pull must not land on Play again
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = setInterval(() => { const now = performance.now(), dt = (now - last) / 1000; last = now; live.current.elapsed += dt; live.current.pos = tugTick(live.current.pos, dt, live.current.elapsed); sync(); }, 50);
    return () => clearInterval(id);
  }, [running]);
  const start = () => { gaFairActivityStart('tug_of_war'); onStart?.(); live.current = { pos: 0, elapsed: 0, tap: 0 }; over.current = false; setPos(0); setElapsed(0); setResult(null); setRunning(true); };
  const pull = () => { if (!running) return; live.current.pos = tugTap(live.current.pos); live.current.tap = performance.now(); sync(); };
  const side = Math.abs(pos) < .08 ? 'The rope is level.' : pos > 0 ? 'The rope is on your side.' : 'The rope is on the village side.';
  return (
    <Sheet labelId="fair-sports-h" onClose={onClose}>
      <h2 id="fair-sports-h">Rural sports: tug of war</h2>
      <p className="fair-say">Villagers at the fair hold a tug of war every evening. Join the team on the right and tap Pull as fast as you can. Drag the red ribbon over your line, or have it on your side when the {TUG_SECONDS} seconds run out.</p>
      <div className="fair-tug" aria-live="polite">
        <TugScene pos={pos} clock={elapsed} heave={running && performance.now() - live.current.tap < 220} result={result} />
        <p className="fair-note">{result === 'won' ? 'You pulled the village team over the line!' : result === 'lost' ? 'The village team pulled you over. Try again?' : running ? `${side} ${Math.max(0, Math.ceil(TUG_SECONDS - elapsed))} s left.` : `Ready? You have ${TUG_SECONDS} seconds.`}</p>
      </div>
      <div className="fair-sheet-foot">
        <button type="button" className="button" onClick={onClose}>Close</button>
        {running ? <button key="pull" type="button" className="button primary fair-pull" onClick={pull}>Pull!</button> : <button key="start" type="button" className="button primary" disabled={cool} onClick={start}>{result ? 'Play again' : 'Start'}</button>}
      </div>
    </Sheet>
  );
}

/** The handicraft market is the stalls themselves: a list of them with a way to walk to each. */
export function MarketSheet({ data, onVisit, onShortlist, onClose }: { data: FairData; onVisit: (idx: number) => void; onShortlist: () => void; onClose: () => void }) {
  return (
    <Sheet labelId="fair-market-h" onClose={onClose}>
      <h2 id="fair-market-h">Handicraft market</h2>
      <p className="fair-say">Every stall in the fair is part of the market, with the work made by hand by the person standing behind the counter.</p>
      <ul className="fair-market">
        {data.stalls.map((st, i) => st.maker && (
          <li key={st.maker.id}>
            <span><b>{st.maker.name}</b><small>{st.maker.city} · {st.maker.category} · from {money(Math.min(...st.maker.items.map(it => it.pricePaise)))}</small></span>
            <button type="button" className="button" onClick={() => onVisit(i)}>Visit stall</button>
          </li>
        ))}
      </ul>
      <div className="fair-sheet-foot"><button type="button" className="button" onClick={onClose}>Close</button><button type="button" className="button primary" onClick={onShortlist}>Open my shortlist</button></div>
    </Sheet>
  );
}
