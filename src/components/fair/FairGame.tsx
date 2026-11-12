'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CODE_ALPHABET, CODE_RE } from '@/lib/fair-constants';
import { characterFor, formatCode, normalizeCode, randomCode } from '@/lib/fair-characters';
import type { Emote, FairData, FairItem } from '@/lib/fair-types';
import { money } from '@/lib/money';
import { PageLoader } from '../PageLoader';
import { Toast, type ToastState } from '../Toast';
import { makerAvatar, visitorAvatar } from './avatar';
import { createFairEngine, type EarOn, type EngineCallbacks, type FairEngine, type SelfiePose } from './engine';
import { MirrorSheet, ShortlistSheet, StallSheet, Sheet } from './FairSheets';
import { MAX_NOTES, MAX_QTY, cartCount, cleanProfile, emptyProfile, loadStore, saveStore, type Profile, type Store } from './profile';
import { applyEvent, countOf, dayKey, isDone, questsFor, restoreState, type GameEvent, type QuestState } from './quests';

type SheetState = { kind: 'stall'; idx: number } | { kind: 'open' } | { kind: 'shortlist' } | { kind: 'mirror'; view: 'menu' | 'selfie' | 'note' } | null;
const EMOTE_LABEL: Record<Emote, string> = { wave: 'Wave', namaste: 'Namaste', hello: 'Say hello' };

/** The walk-around exhibition: the canvas on the left, the maker you are nearest, your player code, quests and other visitors on the right. */
export function FairGame({ data }: { data: FairData }) {
  const real = data.source === 'real';
  const makerIds = useMemo(() => new Set(data.makers.map(m => m.id)), [data]);
  const items = useMemo(() => new Map<string, { item: FairItem; maker: typeof data.makers[number] }>(data.makers.flatMap(m => m.items.map(i => [i.key, { item: i, maker: m }] as const))), [data]);
  const day = useMemo(() => dayKey(), []);
  const quests = useMemo(() => questsFor(data, day), [data, day]);
  const mirrorMaker = data.makers.find(m => m.mirror) ?? null;
  const earrings = useMemo(() => (mirrorMaker?.items ?? []).filter(i => i.art === 'drop' || i.art === 'chandbali'), [mirrorMaker]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FairEngine | null>(null);
  const storeRef = useRef<Store>({ current: '', profiles: {} });
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState('');
  const [profile, setProfile] = useState<Profile>(emptyProfile());
  const [qs, setQs] = useState<QuestState>({ day, progress: {} });
  const qsRef = useRef(qs);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [tryOn, setTryOn] = useState<string | null>(null);
  const [nearIdx, setNearIdx] = useState(0);
  const [here, setHere] = useState(0);
  const [hint, setHint] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const [codeError, setCodeError] = useState('');
  const codeRef = useRef(code); codeRef.current = code;
  const pendingEmote = useRef<Emote | null>(null);
  const notify = useCallback((text: string, kind: 'success' | 'error' = 'success') => setToast({ id: Date.now() + Math.random(), kind, text }), []);
  const closeToast = useCallback(() => setToast(null), []);

  const character = useMemo(() => (code ? characterFor(code) : null), [code]);
  const lit = quests.filter(q => isDone(qs, q)).length, allDone = quests.length > 0 && lit === quests.length;

  /* ---------- who is playing ---------- */
  const load = useCallback((c: string, store: Store) => {
    const p = cleanProfile(store.profiles[c], makerIds, new Set(items.keys()));
    const state = restoreState(p.quests, day);
    qsRef.current = state; setQs(state); setProfile(p); setCode(c); setTryOn(null); setSheet(null);
  }, [makerIds, items, day]);
  useEffect(() => {
    const store = loadStore(typeof localStorage === 'undefined' ? null : localStorage);
    storeRef.current = store;
    load(CODE_RE.test(store.current) ? store.current : randomCode(CODE_ALPHABET), store);
    setReady(true);
  }, [load]);
  useEffect(() => { // remember this visitor on this device
    if (!ready || !code) return;
    storeRef.current = { current: code, profiles: { ...storeRef.current.profiles, [code]: { ...profile, quests: qs } } };
    saveStore(typeof localStorage === 'undefined' ? null : localStorage, storeRef.current);
  }, [ready, code, profile, qs]);
  const switchTo = (raw: string) => {
    const c = normalizeCode(raw);
    if (c.length !== 6) { setCodeError('A code has 6 letters or numbers, like ABC-123.'); return; }
    if (!CODE_RE.test(c)) { setCodeError('Codes never use O, I, L, 0 or 1. Check it and try again.'); return; }
    setCodeError('');
    if (c === code) { notify(`You are already ${characterFor(c).name}.`); return; }
    load(c, storeRef.current); notify(`You are now ${characterFor(c).name}, code ${formatCode(c)}.`);
  };

  /* ---------- the game ---------- */
  const record = useCallback((e: GameEvent) => {
    const r = applyEvent(qsRef.current, quests, e);
    if (!r.completed.length && r.state === qsRef.current) return;
    qsRef.current = r.state; setQs(r.state);
    const done = quests.filter(q => isDone(r.state, q)).length;
    if (r.completed.length) notify(done === quests.length ? 'All three quests done! You earned a marigold garland.' : `Quest done: ${r.completed[0].title}`);
  }, [quests, notify]);
  const visit = useCallback((id: string, name: string) => {
    setProfile(p => (p.met.includes(id) ? p : { ...p, met: [...p.met, id] }));
    if (!profile.met.includes(id)) notify(`Stamp collected: ${name}`);
    record({ type: 'visit', makerId: id });
  }, [profile.met, record, notify]);
  const handlers = useRef<EngineCallbacks>({ onNearest() {}, onOpenStall() {}, onOpenMirror() {}, onToast() {}, onEvent() {}, onMoved() {} });
  handlers.current = {
    onNearest: i => setNearIdx(i),
    onOpenStall: slot => { if (!slot.maker) setSheet({ kind: 'open' }); else { visit(slot.maker.id, slot.maker.name); setSheet({ kind: 'stall', idx: slot.idx }); } },
    onOpenMirror: view => setSheet({ kind: 'mirror', view }),
    onToast: t => notify(t),
    onEvent: record,
    onMoved: () => setHint(false),
  };
  useEffect(() => {
    if (!ready || !canvasRef.current) return;
    const eng = createFairEngine(canvasRef.current, data, {
      onNearest: i => handlers.current.onNearest(i), onOpenStall: s => handlers.current.onOpenStall(s), onOpenMirror: v => handlers.current.onOpenMirror(v),
      onToast: t => handlers.current.onToast(t), onEvent: e => handlers.current.onEvent(e), onMoved: () => handlers.current.onMoved(),
    }, { reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches });
    engineRef.current = eng; eng.setIdentity(codeRef.current);
    return () => { eng.destroy(); engineRef.current = null; };
  }, [ready, data]);
  useEffect(() => { if (code) engineRef.current?.setIdentity(code); }, [code]);
  useEffect(() => { engineRef.current?.setPaused(sheet !== null); }, [sheet]);
  useEffect(() => { engineRef.current?.setMet(profile.met); }, [profile.met, ready]);
  const earItem = useMemo(() => {
    const key = tryOn ?? earrings.find(e => profile.shortlist[e.key])?.key ?? null;
    return key ? items.get(key)?.item ?? null : null;
  }, [tryOn, earrings, profile.shortlist, items]);
  useEffect(() => {
    const ear: EarOn = earItem && (earItem.art === 'drop' || earItem.art === 'chandbali') ? { art: earItem.art, color: earItem.color ?? '#4fb6b8' } : null;
    engineRef.current?.setState({ ear, notes: profile.notes.length, lit, garland: allDone });
  }, [earItem, profile.notes.length, lit, allDone, ready]);

  /* ---------- other visitors ---------- */
  useEffect(() => {
    if (!ready) return;
    let stop = false, timer: ReturnType<typeof setTimeout> | undefined;
    const beat = async () => {
      const eng = engineRef.current;
      if (eng && !document.hidden && codeRef.current) {
        const { x, y, facing } = eng.pose(), emote = pendingEmote.current; pendingEmote.current = null;
        try {
          const r = await fetch('/api/fair/presence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: codeRef.current, x, y, facing, ...(emote ? { emote } : {}) }) });
          if (r.ok) { const d = await r.json() as { visitors: Parameters<FairEngine['setVisitors']>[0]; count: number }; if (!stop) { eng.setVisitors(d.visitors); setHere(d.count); } }
          else if (emote) pendingEmote.current = emote;
        } catch { if (emote) pendingEmote.current = emote; }
      }
      if (!stop) timer = setTimeout(beat, 2500);
    };
    beat();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [ready]);
  const sendEmote = (e: Emote) => { engineRef.current?.emote(e); pendingEmote.current = e; };

  /* ---------- shortlist, notes, mirror ---------- */
  const addItem = (item: FairItem) => {
    setProfile(p => ({ ...p, shortlist: { ...p.shortlist, [item.key]: Math.min(MAX_QTY, (p.shortlist[item.key] ?? 0) + 1) } }));
    record({ type: 'shortlist', itemKey: item.key, pricePaise: item.pricePaise });
  };
  const changeQty = (key: string, d: number) => setProfile(p => {
    const q = Math.max(0, Math.min(MAX_QTY, (p.shortlist[key] ?? 0) + d)), next = { ...p.shortlist };
    if (q) next[key] = q; else delete next[key];
    return { ...p, shortlist: next };
  });
  const addNote = (text: string, rating: number) => { setProfile(p => ({ ...p, notes: [...p.notes, { text, rating, t: Date.now() }].slice(-MAX_NOTES) })); record({ type: 'note' }); notify('Note pinned on the mirror wall. Thank you!'); };
  const tryEarrings = (key: string | null) => { setTryOn(key); if (key) record({ type: 'tryon', itemKey: key }); };
  const paintSelfie = useCallback((cv: HTMLCanvasElement, pose: SelfiePose) => engineRef.current?.paintSelfie(cv, pose), []);
  const onSelfie = useCallback(() => record({ type: 'selfie' }), [record]);
  const closeSheet = useCallback(() => setSheet(null), []);

  const near = data.makers[0] ? (data.makers.find((_, i) => i === nearIdx)?.id ? engineRef.current?.slots[nearIdx]?.maker ?? data.makers[0] : data.makers[0]) : null;
  const total = cartCount(profile.shortlist);
  const stallMaker = sheet?.kind === 'stall' ? engineRef.current?.slots[sheet.idx]?.maker ?? null : null;

  if (!ready || !character) return <div className="fair-loading"><PageLoader show label="Setting up your player…" /></div>;
  return (
    <div className="fair">
      <Toast toast={toast} onClose={closeToast} />
      <div className="fair-layout">
        <section className="fair-stage" aria-label="The fair">
          <canvas ref={canvasRef} className="fair-canvas" tabIndex={0} role="application" aria-label="The fair. Use the arrow keys or W A S D to walk. Press Enter next to a stall to shop there, or M next to the mirror." />
          {hint && <div className="fair-hint">Click the fair, then walk with the arrow keys · or click where to go</div>}
          <button type="button" className="button fair-shortlist" onClick={() => setSheet({ kind: 'shortlist' })} aria-haspopup="dialog">Shortlist <span className="fair-count" aria-label={`${total} items`}>{total}</span></button>
        </section>

        <aside className="fair-side">
          {near && (
            <section className="fair-card fair-now" aria-live="polite">
              <div className="fair-who">
                <span className="fair-avatar" dangerouslySetInnerHTML={{ __html: makerAvatar(near.look) }} />
                <div><h2>{near.name}</h2><p className="fair-meta">{near.city} · {near.category}{profile.met.includes(near.id) && <span className="fair-tag">Met</span>}</p></div>
              </div>
              <p>{near.items.length} {near.items.length === 1 ? 'thing' : 'things'} on the counter, from {money(Math.min(...near.items.map(i => i.pricePaise)))}.</p>
              <div className="fair-acts">
                <button type="button" className="button primary" onClick={() => engineRef.current?.walkToSlot(nearIdx)}>Walk to this stall</button>
                <button type="button" className="button" onClick={() => engineRef.current?.watchCraft(nearIdx)}>Watch them work</button>
              </div>
            </section>
          )}

          <section className="fair-card" aria-labelledby="fair-here-h">
            <h3 id="fair-here-h">In the fair now</h3>
            <p className="fair-here">{here > 1 ? `${here} people here now, including you.` : 'Just you for the moment.'}</p>
            <div className="fair-acts" role="group" aria-label="Say something to the others">
              {(Object.keys(EMOTE_LABEL) as Emote[]).map(e => <button key={e} type="button" className="button" onClick={() => sendEmote(e)}>{EMOTE_LABEL[e]}</button>)}
            </div>
          </section>

          <section className="fair-card" aria-labelledby="fair-quest-h">
            <h3 id="fair-quest-h">Today&apos;s quests</h3>
            <ul className="fair-quests">
              {quests.map(q => { const done = isDone(qs, q); return (
                <li key={q.id} className={done ? 'done' : ''}>
                  <span className="fair-check" aria-hidden="true">{done ? '✓' : ''}</span>
                  <span><b>{q.title}</b><small>{done ? 'Done' : q.target > 1 ? `${countOf(qs, q)} of ${q.target}. ${q.hint}` : q.hint}</small></span>
                </li>
              ); })}
            </ul>
            <p className="fair-note">{allDone ? 'All done. You are wearing a marigold garland today.' : 'Each quest lights a diya on the rangoli. Finish all three for a marigold garland.'}</p>
          </section>

          <section className="fair-card fair-player" aria-labelledby="fair-player-h">
            <h3 id="fair-player-h">Your player</h3>
            <div className="fair-who">
              <span className="fair-avatar" dangerouslySetInnerHTML={{ __html: visitorAvatar(character) }} />
              <div>
                <b className="fair-name">{character.name}</b>
                <div className="fair-codeline"><code>{formatCode(code)}</code>
                  <button type="button" className="button" onClick={() => { const t = formatCode(code); navigator.clipboard?.writeText(t).then(() => notify(`Code ${t} copied. Enter it anywhere to be ${character.name} again.`), () => notify(`Your code is ${t}`)); }}>Copy</button>
                </div>
              </div>
            </div>
            <form className="admin-form fair-codeform" noValidate onSubmit={e => { e.preventDefault(); const f = e.currentTarget; switchTo(String(new FormData(f).get('code') ?? '')); if (CODE_RE.test(normalizeCode(String(new FormData(f).get('code') ?? '')))) f.reset(); }}>
              <label><span className="lbl">Play with a code</span>
                <span className="fair-row"><input name="code" placeholder="ABC-123" maxLength={7} autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-describedby="fair-code-err" onChange={() => setCodeError('')} /><button type="submit" className="button primary">Play</button></span>
              </label>
              <p id="fair-code-err" role="alert" className="admin-error">{codeError}</p>
            </form>
            <button type="button" className="button" onClick={() => { const c = randomCode(CODE_ALPHABET); load(c, storeRef.current); notify(`New code. You are now ${characterFor(c).name}, code ${formatCode(c)}.`); }}>Get a new random code</button>
            <p className="fair-note">One code is one person. Enter a different code and a different character takes over the fair. Progress is saved in this browser.</p>
          </section>

          <section className="fair-card" aria-labelledby="fair-makers-h">
            <h3 id="fair-makers-h">Makers at the fair</h3>
            <ul className="fair-chips">
              {Array.from({ length: 8 }, (_, i) => data.makers[i] ?? null).map((m, i) => (
                <li key={m?.id ?? `open-${i}`}>
                  <button type="button" className={`fair-chip${m && profile.met.includes(m.id) ? ' met' : ''}${m ? '' : ' open'}`} aria-current={m && near?.id === m.id ? 'true' : undefined} onClick={() => engineRef.current?.walkToSlot(i)}>
                    <span className="fair-dot" aria-hidden="true">✓</span>
                    <span>{m ? m.name : 'Open stall'}<small>{m ? `${m.city} · ${m.category}` : 'Waiting for a maker'}</small></span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="fair-track" aria-hidden="true"><div style={{ width: `${data.makers.length ? profile.met.length / data.makers.length * 100 : 0}%` }} /></div>
            <p className="fair-note">{profile.met.length} of {data.makers.length} makers met. Step up to a counter to get a stamp; each one lights a flag on the bunting.</p>
          </section>
        </aside>
      </div>
      <p className="fair-foot">{real ? 'These stalls show sellers on Craftofy right now. Your shortlist stays on this page; open a product to contact the maker.' : 'Sample makers: the makers, products, prices and shoppers here are invented for the game, not real listings.'}</p>

      {sheet?.kind === 'stall' && stallMaker && (
        <StallSheet maker={stallMaker} real={real} shortlist={profile.shortlist} onAdd={addItem} onClose={closeSheet}
          onWatch={() => { setSheet(null); engineRef.current?.watchCraft(sheet.idx); }} onOpenShortlist={() => setSheet({ kind: 'shortlist' })} />
      )}
      {sheet?.kind === 'shortlist' && <ShortlistSheet data={data} shortlist={profile.shortlist} onChange={changeQty} onClose={closeSheet} />}
      {sheet?.kind === 'open' && (
        <Sheet labelId="fair-open-h" onClose={closeSheet}>
          <h2 id="fair-open-h">An open stall</h2>
          <p className="fair-say">This one is waiting for a maker. If you make things by hand, your name, your craft and your products could be standing here.</p>
          <div className="fair-sheet-foot"><button type="button" className="button" onClick={closeSheet}>Close</button><a className="button primary" href="/sell">Sell on Craftofy</a></div>
        </Sheet>
      )}
      {sheet?.kind === 'mirror' && mirrorMaker && (
        <MirrorSheet maker={mirrorMaker} view={sheet.view} setView={v => setSheet({ kind: 'mirror', view: v })} tryOn={tryOn} onTry={tryEarrings} earrings={earrings}
          onAdd={addItem} shortlist={profile.shortlist} notes={profile.notes} onNote={addNote} onSelfie={onSelfie} paint={paintSelfie} onClose={closeSheet} />
      )}
    </div>
  );
}
