'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CODE_RE } from '@/lib/fair-constants';
import { characterFor, formatCode, lookFor, normalizeCode } from '@/lib/fair-characters';
import type { LookId } from '@/lib/fair-constants';
import type { Emote, FairData, FairItem } from '@/lib/fair-types';
import { money } from '@/lib/money';
import { PageLoader } from '../PageLoader';
import { Toast, type ToastState } from '../Toast';
import { makerAvatar, visitorAvatar } from './avatar';
import { PHASE_LABEL, hourFromSearch, type DayPhase } from './daytime';
import { createFairEngine, type EngineCallbacks, type FairEngine, type SelfiePose } from './engine';
import { createSound, type Sfx, type Sound } from './sound';
import { isWearable, wearFor } from './wear';
import { claim, claimRandom, codeFromSearch, getToken, withCode } from './identity';
import { LookSheet, MirrorSheet, ShortlistSheet, StallSheet, Sheet } from './FairSheets';
import { MAX_NOTES, MAX_QTY, cartCount, cleanProfile, emptyProfile, loadStore, saveStore, type Profile, type Store } from './profile';
import type { QuestDay } from '@/lib/fair-quest-days';
import { applyEvent, countOf, dayKey, isDone, mergeProgress, questsFor, restoreState, type GameEvent, type QuestState } from './quests';

type SheetState = { kind: 'stall'; idx: number } | { kind: 'open'; label: string } | { kind: 'look' } | { kind: 'shortlist' } | { kind: 'mirror'; view: 'menu' | 'selfie' | 'note' } | null;
const EMOTE_LABEL: Record<Emote, string> = { wave: 'Wave', namaste: 'Namaste', hello: 'Say hello' };

/** The walk-around exhibition: the canvas on the left, the maker you are nearest, your player code, quests and other visitors on the right. */
export function FairGame({ data, diyas = true }: { data: FairData; diyas?: boolean }) {
  const real = data.source === 'real';
  const makerIds = useMemo(() => new Set(data.makers.map(m => m.id)), [data]);
  const items = useMemo(() => new Map<string, { item: FairItem; maker: typeof data.makers[number] }>(data.makers.flatMap(m => m.items.map(i => [i.key, { item: i, maker: m }] as const))), [data]);
  const day = useMemo(() => dayKey(), []);
  const quests = useMemo(() => questsFor(data, day), [data, day]);
  const mirrorMaker = data.makers.find(m => m.mirror) ?? null;
  const wearables = useMemo(() => (mirrorMaker?.items ?? []).filter(isWearable), [mirrorMaker]);

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
  const tokenRef = useRef('');
  const [claiming, setClaiming] = useState(false);
  const [history, setHistory] = useState<QuestDay[]>([]);
  const fairRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false), [fakeFull, setFakeFull] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false), [panel, setPanel] = useState(true), [overview, setOverview] = useState(false);
  const [phase, setPhase] = useState<DayPhase | null>(null);
  const lookRef = useRef<LookId | null>(null);
  const soundRef = useRef<Sound | null>(null);
  const [muted, setMuted] = useState(false), [crowd, setCrowd] = useState(0);
  const play = useCallback((n: Sfx) => soundRef.current?.sfx(n), []);
  const pendingEmote = useRef<Emote | null>(null);
  const lostCodeRef = useRef<() => Promise<void>>(async () => undefined);
  const notify = useCallback((text: string, kind: 'success' | 'error' = 'success') => setToast({ id: Date.now() + Math.random(), kind, text }), []);
  const closeToast = useCallback(() => setToast(null), []);

  const look = profile.look; lookRef.current = look;
  useEffect(() => { // sound: made in the browser, switched on by the first click or key press (browsers require that)
    const snd = createSound(typeof localStorage === 'undefined' ? null : localStorage);
    soundRef.current = snd; setMuted(snd.muted);
    const unlock = () => snd.unlock();
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); snd.destroy(); soundRef.current = null; };
  }, []);
  const toggleSound = () => { const snd = soundRef.current; if (!snd) return; snd.unlock(); const next = !snd.muted; snd.setMuted(next); setMuted(next); if (!next) snd.sfx('look'); };

  const character = useMemo(() => (code ? characterFor(code, look) : null), [code, look]);
  const lit = quests.filter(q => isDone(qs, q)).length, allDone = quests.length > 0 && lit === quests.length;

  /* ---------- who is playing ---------- */
  const load = useCallback((c: string, store: Store) => {
    const p = cleanProfile(store.profiles[c], makerIds, new Set(items.keys()));
    const state = restoreState(p.quests, day);
    qsRef.current = state; setQs(state); setProfile(p); setCode(c); setTryOn(null); setSheet(null);
  }, [makerIds, items, day]);
  useEffect(() => { // pick who is playing: the code in the link, else the one saved here, else a new one; it must be free or already ours
    let cancelled = false;
    (async () => {
      const storage = typeof localStorage === 'undefined' ? null : localStorage;
      const store = loadStore(storage); storeRef.current = store;
      const token = getToken(storage); tokenRef.current = token;
      const fromLink = codeFromSearch(window.location.search), saved = CODE_RE.test(store.current) ? store.current : null;
      let chosen: string | null = null, linkTaken = false;
      for (const c of [fromLink, saved]) {
        if (!c || chosen || c === (chosen as string | null)) continue;
        if (await claim(c, token) !== 'taken') chosen = c; else if (c === fromLink) linkTaken = true;
      }
      if (!chosen) chosen = await claimRandom(token);
      if (cancelled) return;
      load(chosen, store); setReady(true);
      if (linkTaken) notify('The code in this link is already taken, so you got a new one.', 'error');
    })();
    return () => { cancelled = true; };
  }, [load, notify]);
  useEffect(() => { // keep the code in the address bar, so the link can be saved or shared
    if (!ready || !code) return;
    try { window.history.replaceState(window.history.state, '', withCode(window.location.href, code)); } catch { /* some embedded views block it */ }
  }, [ready, code]);
  useEffect(() => { // remember this visitor on this device
    if (!ready || !code) return;
    storeRef.current = { current: code, profiles: { ...storeRef.current.profiles, [code]: { ...profile, quests: qs } } };
    saveStore(typeof localStorage === 'undefined' ? null : localStorage, storeRef.current);
  }, [ready, code, profile, qs]);
  useEffect(() => { // this code's quests are kept on the server: bring back today's progress and the earlier days
    if (!ready || !code || !tokenRef.current) return;
    let stale = false;
    (async () => {
      try {
        const r = await fetch('/api/fair/quests/history', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, token: tokenRef.current }) });
        if (!r.ok || stale) return;
        const { days } = await r.json() as { days: QuestDay[] };
        if (stale) return;
        setHistory(days.filter(d => d.day !== day));
        const merged = mergeProgress(qsRef.current, days.find(d => d.day === day)?.progress);
        if (merged !== qsRef.current) { qsRef.current = merged; setQs(merged); }
      } catch { /* offline: this device's copy is still there */ }
    })();
    return () => { stale = true; setHistory([]); };
  }, [ready, code, day]);
  useEffect(() => { // save today's progress under the code, a moment after it changes
    if (!ready || !code || !tokenRef.current || !Object.keys(qs.progress).length) return;
    const id = setTimeout(() => {
      fetch('/api/fair/quests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, token: tokenRef.current, day, quests: quests.map(q => ({ id: q.id, title: q.title, target: q.target })), progress: qs.progress }) }).catch(() => undefined);
    }, 800);
    return () => clearTimeout(id);
  }, [ready, code, qs, quests, day]);
  /** Becomes `c` if it is free (or already ours): a code is first come, first served. */
  const takeCode = async (c: string, announce: (name: string) => string): Promise<boolean> => {
    if (await claim(c, tokenRef.current) === 'taken') return false;
    load(c, storeRef.current); notify(announce(characterFor(c).name)); return true;
  };
  const switchTo = async (raw: string): Promise<boolean> => {
    const c = normalizeCode(raw);
    if (c.length !== 6) { setCodeError('A code has 6 letters or numbers, like ABC-123.'); return false; }
    if (!CODE_RE.test(c)) { setCodeError('Codes never use O, I, L, 0 or 1. Check it and try again.'); return false; }
    setCodeError('');
    if (c === code) { notify(`You are already ${characterFor(c).name}.`); return false; }
    setClaiming(true);
    const ok = await takeCode(c, name => `You are now ${name}, code ${formatCode(c)}.`);
    setClaiming(false);
    if (!ok) { setCodeError('Code already taken. Try another one.'); play('error'); }
    return ok;
  };
  const newRandom = async () => {
    setClaiming(true);
    const c = await claimRandom(tokenRef.current);
    load(c, storeRef.current); notify(`New code. You are now ${characterFor(c).name}, code ${formatCode(c)}.`); setClaiming(false);
  };
  /** Someone else got our code (it was released after 30 quiet days, say): carry on as someone new. */
  const lostCode = async () => { const c = await claimRandom(tokenRef.current); load(c, storeRef.current); notify('Someone else is using your code now, so you got a new one.', 'error'); };

  lostCodeRef.current = lostCode;

  /* ---------- the game ---------- */
  const record = useCallback((e: GameEvent) => {
    const r = applyEvent(qsRef.current, quests, e);
    if (!r.completed.length && r.state === qsRef.current) return;
    qsRef.current = r.state; setQs(r.state);
    const done = quests.filter(q => isDone(r.state, q)).length;
    if (r.completed.length) { notify(done === quests.length ? 'All three quests done! You earned a marigold garland.' : `Quest done: ${r.completed[0].title}`); play(done === quests.length ? 'garland' : 'quest'); }
  }, [quests, notify, play]);
  const visit = useCallback((id: string, name: string) => {
    setProfile(p => (p.met.includes(id) ? p : { ...p, met: [...p.met, id] }));
    if (!profile.met.includes(id)) { notify(`Stamp collected: ${name}`); play('stamp'); }
    record({ type: 'visit', makerId: id });
  }, [profile.met, record, notify, play]);
  const handlers = useRef<EngineCallbacks>({ onNearest() {}, onOpenStall() {}, onOpenMirror() {}, onToast() {}, onEvent() {}, onMoved() {}, onPhase() {}, onCrowd() {}, onSfx() {}, onCraft() {} });
  handlers.current = {
    onNearest: i => setNearIdx(i),
    onOpenStall: slot => { if (!slot.maker) setSheet({ kind: 'open', label: slot.label }); else { visit(slot.maker.id, slot.maker.name); setSheet({ kind: 'stall', idx: slot.idx }); } },
    onOpenMirror: view => setSheet({ kind: 'mirror', view }),
    onToast: t => notify(t),
    onEvent: record,
    onMoved: () => setHint(false),
    onPhase: p => setPhase(p),
    onCrowd: n => setCrowd(n),
    onSfx: e => play(e === 'step' ? 'step' : e),
    onCraft: k => soundRef.current?.craft(k),
  };
  useEffect(() => {
    if (!ready || !canvasRef.current) return;
    const eng = createFairEngine(canvasRef.current, data, {
      onNearest: i => handlers.current.onNearest(i), onOpenStall: s => handlers.current.onOpenStall(s), onOpenMirror: v => handlers.current.onOpenMirror(v),
      onToast: t => handlers.current.onToast(t), onEvent: e => handlers.current.onEvent(e), onMoved: () => handlers.current.onMoved(), onPhase: p => handlers.current.onPhase(p), onCrowd: n => handlers.current.onCrowd(n), onSfx: e => handlers.current.onSfx(e), onCraft: k => handlers.current.onCraft(k),
    }, { reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches, hour: hourFromSearch(window.location.search) });
    engineRef.current = eng; eng.setIdentity(codeRef.current, lookRef.current);
    return () => { eng.destroy(); engineRef.current = null; };
  }, [ready, data]);
  useEffect(() => { if (code) engineRef.current?.setIdentity(code, lookRef.current); }, [code]);
  useEffect(() => { engineRef.current?.setLook(look); }, [look, ready]);
  useEffect(() => { engineRef.current?.setOverview(overview); }, [overview, ready]);
  useEffect(() => { engineRef.current?.setPaused(sheet !== null); }, [sheet]);
  useEffect(() => { engineRef.current?.setMet(profile.met); }, [profile.met, ready]);
  const wearItem = useMemo(() => {
    const key = tryOn ?? wearables.find(e => profile.shortlist[e.key])?.key ?? null;
    return key ? items.get(key)?.item ?? null : null;
  }, [tryOn, wearables, profile.shortlist, items]);
  useEffect(() => {
    engineRef.current?.setState({ wear: wearFor(wearItem), notes: profile.notes.length, lit, garland: allDone, diyas });
  }, [wearItem, profile.notes.length, lit, allDone, diyas, ready]);

  useEffect(() => { if (phase) soundRef.current?.ambience(phase, crowd + Math.max(0, here - 1)); }, [phase, crowd, here]);
  useEffect(() => { if (sheet) play('open'); }, [sheet, play]);

  /* ---------- full screen and the side panel ---------- */
  const isFull = full || fakeFull;
  const isFullRef = useRef(false); isFullRef.current = isFull;
  useEffect(() => { engineRef.current?.setFill(isFull); }, [isFull, ready]);
  useEffect(() => {
    const onChange = () => { const on = document.fullscreenElement === fairRef.current; setFull(on); if (!on) setPanel(true); };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(() => { // where the browser has no fullscreen (iPhone Safari), the fair fills the window instead
    if (!fakeFull) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { setFakeFull(false); setPanel(true); } };
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [fakeFull]);
  const toggleFull = async () => {
    const el = fairRef.current;
    if (isFull) { if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined); setFakeFull(false); setPanel(true); }
    else {
      setPanel(false);
      if (el?.requestFullscreen) { try { await el.requestFullscreen(); } catch { setFakeFull(true); } } else setFakeFull(true);
    }
    requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
  };

  /* ---------- other visitors ---------- */
  useEffect(() => {
    if (!ready) return;
    let stop = false, timer: ReturnType<typeof setTimeout> | undefined;
    const beat = async () => {
      const eng = engineRef.current;
      if (eng && !document.hidden && codeRef.current) {
        const { x, y, facing } = eng.pose(), emote = pendingEmote.current; pendingEmote.current = null;
        try {
          const r = await fetch('/api/fair/presence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: codeRef.current, token: tokenRef.current, x, y, facing, ...(lookRef.current ? { look: lookRef.current } : {}), ...(emote ? { emote } : {}) }) });
          if (r.ok) { const d = await r.json() as { visitors: Parameters<FairEngine['setVisitors']>[0]; count: number }; if (!stop) { eng.setVisitors(d.visitors); setHere(d.count); } }
          else if (r.status === 409) { if (!stop) await lostCodeRef.current(); }
          else if (emote) pendingEmote.current = emote;
        } catch { if (emote) pendingEmote.current = emote; }
      }
      if (!stop) timer = setTimeout(beat, 2500);
    };
    beat();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [ready]);
  const sendEmote = (e: Emote) => { engineRef.current?.emote(e); pendingEmote.current = e; play('emote'); };

  /* ---------- shortlist, notes, mirror ---------- */
  const addItem = (item: FairItem) => {
    setProfile(p => ({ ...p, shortlist: { ...p.shortlist, [item.key]: Math.min(MAX_QTY, (p.shortlist[item.key] ?? 0) + 1) } }));
    record({ type: 'shortlist', itemKey: item.key, pricePaise: item.pricePaise }); play('add');
  };
  const changeQty = (key: string, d: number) => { play(d > 0 ? 'add' : 'remove'); setProfile(p => {
    const q = Math.max(0, Math.min(MAX_QTY, (p.shortlist[key] ?? 0) + d)), next = { ...p.shortlist };
    if (q) next[key] = q; else delete next[key];
    return { ...p, shortlist: next };
  }); };
  /** Sends the note to the Craftofy team; only when that worked is it pinned on the wall. Returns a message when it did not. */
  const addNote = async (text: string, rating: number): Promise<string | null> => {
    try {
      const r = await fetch('/api/fair/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, token: tokenRef.current, stall: mirrorMaker?.name ?? 'The fair', text, rating, source: data.source }) });
      if (r.status === 409) { void lostCode(); return 'Your code is no longer yours. Open the mirror again to leave your note.'; }
      if (!r.ok) return ((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Your note could not be sent. Please try again.';
    } catch { return 'Network error. Your note was not sent, please try again.'; }
    setProfile(p => ({ ...p, notes: [...p.notes, { text, rating, t: Date.now() }].slice(-MAX_NOTES) })); record({ type: 'note' });
    notify('Thank you! Your note was sent to the Craftofy team and pinned on the mirror wall.'); play('note');
    return null;
  };
  const tryEarrings = (key: string | null) => { setTryOn(key); if (key) record({ type: 'tryon', itemKey: key }); };
  const paintSelfie = useCallback((cv: HTMLCanvasElement, pose: SelfiePose) => engineRef.current?.paintSelfie(cv, pose), []);
  const onSelfie = useCallback(() => record({ type: 'selfie' }), [record]);
  const closeSheet = useCallback(() => setSheet(null), []);

  const near = data.makers[0] ? (data.makers.find((_, i) => i === nearIdx)?.id ? engineRef.current?.slots[nearIdx]?.maker ?? data.makers[0] : data.makers[0]) : null;
  const total = cartCount(profile.shortlist);
  const stallMaker = sheet?.kind === 'stall' ? engineRef.current?.slots[sheet.idx]?.maker ?? null : null;

  if (!ready || !character) return <div className="fair-loading"><PageLoader show label="Setting up your player…" /></div>;
  return (
    <div ref={fairRef} className={`fair${isFull ? ' is-full' : ''}`}>
      <Toast toast={toast} onClose={closeToast} />
      <div className={`fair-layout${panel ? '' : ' panel-hidden'}`}>
        <section className="fair-stage" aria-label="The fair">
          <canvas ref={canvasRef} className="fair-canvas" tabIndex={0} role="application" aria-label="The fair. Use the arrow keys or W A S D to walk. Press Enter next to a stall to shop there, or M next to the mirror." />
          {hint && <div className="fair-hint">Click the fair, then walk with the arrow keys · or click where to go</div>}
          {phase && <span className={`fair-time ${phase}`} role="status"><span className="fair-time-icon" aria-hidden="true" />{PHASE_LABEL[phase]}</span>}
          <div className="fair-toolbar" role="toolbar" aria-label="Fair controls" onKeyDown={e => { if (e.key === 'Escape') setMenuOpen(false); }}>
            <button type="button" className="button fair-burger" aria-expanded={menuOpen} aria-controls="fair-menu" aria-label="Menu" onClick={() => setMenuOpen(o => !o)}>
              <span className="fair-burger-bars" aria-hidden="true" /> Menu{total > 0 && <span className="fair-count" aria-label={`${total} items in shortlist`}>{total}</span>}
            </button>
            {menuOpen && (
              <div id="fair-menu" className="fair-menu" onClick={() => setMenuOpen(false)}>
                <button type="button" className="button" onClick={() => setSheet({ kind: 'shortlist' })} aria-haspopup="dialog">Shortlist <span className="fair-count" aria-label={`${total} items`}>{total}</span></button>
                <button type="button" className="button" aria-pressed={overview} onClick={() => setOverview(o => !o)}>{overview ? 'Follow me' : 'Overview'}</button>
                <button type="button" className="button" aria-pressed={panel} aria-controls="fair-panel" onClick={() => setPanel(p => !p)}>{panel ? 'Hide panel' : 'Show panel'}</button>
                <button type="button" className="button" aria-pressed={!muted} onClick={toggleSound}>{muted ? 'Sound off' : 'Sound on'}</button>
                <button type="button" className="button" aria-pressed={isFull} onClick={() => { void toggleFull(); }}>{isFull ? 'Exit full screen' : 'Full screen'}</button>
              </div>
            )}
          </div>
        </section>

        <aside id="fair-panel" className="fair-side" hidden={!panel} aria-label="Fair panel">
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
            <p className="fair-note">{allDone ? 'All done. You are wearing a marigold garland today.' : (diyas ? 'Each quest lights a diya on the rangoli. Finish all three for a marigold garland.' : 'Finish all three for a marigold garland.')} Your progress is saved under your code, so come back with the same code to see it any day.</p>
            {history.length > 0 && (
              <details className="fair-history">
                <summary>Earlier days ({history.length}) · {history.reduce((n, d) => n + d.quests.filter(q => (d.progress[q.id]?.length ?? 0) >= q.target).length, 0)} quests done in all</summary>
                <ul>
                  {history.map(d => { const finished = d.quests.filter(q => (d.progress[q.id]?.length ?? 0) >= q.target).length; return (
                    <li key={d.day}>
                      <b>{new Date(`${d.day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</b> · {finished} of {d.quests.length} done
                      <small>{d.quests.map(q => `${(d.progress[q.id]?.length ?? 0) >= q.target ? '✓' : '○'} ${q.title}`).join(' · ')}</small>
                    </li>
                  ); })}
                </ul>
              </details>
            )}
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
            <button type="button" className="button" onClick={() => setSheet({ kind: 'look' })} aria-haspopup="dialog">My look</button>
            <form className="admin-form fair-codeform" noValidate onSubmit={async e => { e.preventDefault(); const f = e.currentTarget; if (claiming) return; if (await switchTo(String(new FormData(f).get('code') ?? ''))) f.reset(); }}>
              <label><span className="lbl">Play with a code</span>
                <span className="fair-row"><input name="code" placeholder="ABC-123" maxLength={7} autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-describedby="fair-code-err" onChange={() => setCodeError('')} /><button type="submit" className="button primary" disabled={claiming} aria-busy={claiming}>Play</button></span>
              </label>
              <p id="fair-code-err" role="alert" className="admin-error">{codeError}</p>
            </form>
            <button type="button" className="button" disabled={claiming} aria-busy={claiming} onClick={() => { void newRandom(); }}>Get a new random code</button>
            <p className="fair-note">One code is one person, and codes are first come, first served: if someone already has a code, pick another. Your code is in the address bar, so you can save the link. Progress is saved in this browser.</p>
          </section>

          <section className="fair-card" aria-labelledby="fair-makers-h">
            <h3 id="fair-makers-h">Makers at the fair</h3>
            <ul className="fair-chips">
              {data.stalls.map((st, i) => { const m = st.maker; return (
                <li key={m?.id ?? `open-${i}`}>
                  <button type="button" className={`fair-chip${m && profile.met.includes(m.id) ? ' met' : ''}${m ? '' : ' open'}`} aria-current={m && near?.id === m.id ? 'true' : undefined} onClick={() => engineRef.current?.walkToSlot(i)}>
                    <span className="fair-dot" aria-hidden="true">✓</span>
                    <span>{m ? m.name : st.label === 'Open stall' ? 'Open stall' : `Open: ${st.label}`}<small>{m ? `${m.city} · ${m.category}` : st.label === 'Open stall' ? 'Waiting for a maker' : `Waiting for a ${st.label.toLowerCase()} maker`}</small></span>
                  </button>
                </li>
              ); })}
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
      {sheet?.kind === 'look' && <LookSheet current={character.id} startsWith={lookFor(code)} onPick={id => { play('look'); setProfile(p => ({ ...p, look: id })); const c = characterFor(code, id); notify(id ? `You now look like ${c.name}.` : `Back to ${c.name}, the look your code starts with.`); }} onClose={closeSheet} />}
      {sheet?.kind === 'shortlist' && <ShortlistSheet data={data} shortlist={profile.shortlist} onChange={changeQty} onClose={closeSheet} />}
      {sheet?.kind === 'open' && (
        <Sheet labelId="fair-open-h" onClose={closeSheet}>
          <h2 id="fair-open-h">{sheet.label === 'Open stall' ? 'An open stall' : `${sheet.label}: open`}</h2>
          <p className="fair-say">{sheet.label === 'Open stall' ? 'This one is waiting for a maker.' : `This stall is waiting for a maker of ${sheet.label.toLowerCase()}.`} If you make things by hand, your name, your craft and your products could be standing here.</p>
          <div className="fair-sheet-foot"><button type="button" className="button" onClick={closeSheet}>Close</button><a className="button primary" href="/sell">Sell on Craftofy</a></div>
        </Sheet>
      )}
      {sheet?.kind === 'mirror' && mirrorMaker && (
        <MirrorSheet maker={mirrorMaker} view={sheet.view} setView={v => setSheet({ kind: 'mirror', view: v })} tryOn={tryOn} onTry={tryEarrings} wearables={wearables}
          onAdd={addItem} shortlist={profile.shortlist} notes={profile.notes} onNote={addNote} onSelfie={onSelfie} onShutter={() => play('shutter')} paint={paintSelfie} onClose={closeSheet} />
      )}
    </div>
  );
}
