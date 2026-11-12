import { characterFor, formatCode, hash32, type Character, type HairStyle, type Headwear } from '@/lib/fair-characters';
import { isLookId, type LookId } from '@/lib/fair-constants';
import type { CraftKind, Emote, Facing, FairData, FairVisitor } from '@/lib/fair-types';
import { artDataUri } from './art';
import { CRAFT_LABEL, CRAFT_SECONDS, HOLD, drawCounterCraft, drawHand, type HandPose, type Job } from './crafts';
import type { GameEvent } from './quests';
import { canvasFamily, readColors, type Colors } from './theme';
import { MAX_CROWD, crowdAt, hourOf, phaseAt, skyAt, type DayPhase } from './daytime';
import type { Wear } from './wear';
import { NODES, RECTS, START, STALL_SCALE as SS, WORLD_H, WORLD_W, buildSlots, cameraAxis, clampWalk, route, walkable, type Pt, type Slot } from './world';

/** Everything the fair does on the canvas: drawing, walking, shoppers, other visitors, craft moments, the mirror. React owns the panels around it. */
export type EngineCallbacks = {
  /** The stall with a maker that is closest to you changed (drives the side card). */
  onNearest(slotIdx: number): void;
  onOpenStall(slot: Slot): void;
  onOpenMirror(view: 'menu' | 'selfie' | 'note'): void;
  onToast(text: string): void;
  onEvent(e: GameEvent): void;
  /** You started moving for the first time. */
  onMoved(): void;
  /** The time of day changed (from the visitor's own clock). */
  onPhase(p: DayPhase): void;
  /** How many shoppers are wandering the fair right now. */
  onCrowd(n: number): void;
  /** Something happened in the fair that has a sound: your footsteps, someone arriving, someone else's emote. */
  onSfx(e: 'step' | 'join' | 'emote' | 'crowd'): void;
  /** A craft moment started (with its kind) or ended (null). */
  onCraft(kind: CraftKind | null): void;
};
export type EngineState = { wear: Wear | null; notes: number; lit: number; garland: boolean; diyas: boolean };
export type SelfiePose = 'smile' | 'wave';
export type FairEngine = {
  destroy(): void;
  setIdentity(code: string, look?: LookId | null): void;
  /** Change how you look (one of the ten looks), or null for the look your code starts with. */
  setLook(look: LookId | null): void;
  /** The whole fair at once (true), or the close camera that follows you (false, the default). */
  setOverview(on: boolean): void;
  /** Full screen: use the whole height of the stage instead of the shape of the fair. */
  setFill(on: boolean): void;
  setState(s: Partial<EngineState>): void;
  /** Ids of the makers this visitor has met today; their flags light up on the bunting. */
  setMet(ids: string[]): void;
  setVisitors(v: FairVisitor[]): void;
  setPaused(p: boolean): void;
  walkToSlot(idx: number, arrive?: () => void): void;
  watchCraft(idx: number): void;
  emote(e: Emote): void;
  pose(): { x: number; y: number; facing: Facing };
  paintSelfie(cv: HTMLCanvasElement, pose: SelfiePose): void;
  slots: Slot[];
};

type Look = { top: string; skinHex?: string; skin?: string; pants: string; hairStyle?: HairStyle; headwear?: Headwear; beard?: boolean; bindi?: boolean; bag?: boolean; acc?: string };
type View = 'front' | 'back' | 'side';
type Walker = Look & { x: number; y: number; facing: Facing; moving: boolean; seed: number; state?: 'walk' | 'browse'; garland?: boolean; ear?: { art: 'drop' | 'chandbali'; color: string } | null; phone?: boolean; waveL?: boolean };
type Shopper = Walker & { name: string; timer: number; path: Pt[]; say: string; sayUntil: number; stall: Slot | null; active: boolean; alpha: number; leaving: boolean };
type Sprite = Walker & { code: string; name: string; lookId: string | null; tx: number; ty: number; seq: number; say: string; sayUntil: number; seen: number };
type Ent =
  | { type: 'stall'; slot: Slot; x: number; y: number; box: number[] }
  | { type: 'maker'; slot: Slot; x: number; y: number; box: number[] }
  | { type: 'shopper'; sh: Shopper; x: number; y: number; box: number[] }
  | { type: 'sprite'; sp: Sprite; x: number; y: number; box: number[] }
  | { type: 'mirror'; x: number; y: number; box: number[] }
  | { type: 'me'; x: number; y: number; box: number[] };
type Badge = { i: number; x: number; y: number; r: number };

/** How big a maker's hands are drawn next to their face (the head is 25 units across). */
const HAND_SCALE = .36;
/** Wrist to fingertips at that size. */
const REACH = 13;
const TAU = Math.PI * 2, SPEED = 190, KEY: Record<string, 'l' | 'r' | 'u' | 'd'> = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', a: 'l', d: 'r', w: 'u', s: 'd', A: 'l', D: 'r', W: 'u', S: 'd' };
const SAY: Record<Emote, string> = { wave: 'Hi!', namaste: 'Namaste', hello: 'Hello!' };
const NPC: Array<Pick<Shopper, 'name' | 'top' | 'pants' | 'skin' | 'bag' | 'acc' | 'hairStyle' | 'headwear' | 'beard' | 'bindi' | 'x' | 'y'>> = [
  { name: 'Meera', top: '#c66b43', pants: '#35506f', skin: 'skin', bag: true, acc: '#d9a441', x: 300, y: 310 },
  { name: 'Aarav', top: '#405746', pants: '#575a4d', skin: 'skin2', x: 760, y: 352 },
  { name: 'Kavya', top: '#d9a441', pants: '#35506f', skin: 'skin', hairStyle: 'long', acc: '#fbf7ef', x: 540, y: 690 },
  { name: 'Rohan', top: '#35506f', pants: '#8a5f3c', skin: 'skin2', bag: true, x: 200, y: 700 },
  { name: 'Isha', top: '#b3262e', pants: '#2b3a31', skin: 'skin', hairStyle: 'braid', acc: '#d9a441', x: 880, y: 300 },
  { name: 'Priya', top: '#7a4e8f', pants: '#35506f', skin: 'skin', hairStyle: 'bun', acc: '#e58aa6', bindi: true, x: 420, y: 700 },
  { name: 'Arjun', top: '#fbf7ef', pants: '#575a4d', skin: 'skin2', headwear: { kind: 'pagdi', color: '#d9a441' }, beard: true, x: 660, y: 330 },
  { name: 'Sana', top: '#4fb6b8', pants: '#8a5f3c', skin: 'skin', hairStyle: 'bob', bag: true, x: 120, y: 330 },
  { name: 'Dev', top: '#405746', pants: '#2b3a31', skin: 'skin2', headwear: { kind: 'cap', color: '#c66b43' }, x: 960, y: 690 },
];

export function createFairEngine(canvas: HTMLCanvasElement, data: FairData, cb: EngineCallbacks, opts: { reducedMotion?: boolean; hour?: number | null } = {}): FairEngine {
  const main = canvas.getContext('2d');
  const reduce = !!opts.reducedMotion;
  const slots = buildSlots(data.stalls);
  if (!main) return { destroy() {}, setIdentity() {}, setLook() {}, setOverview() {}, setFill() {}, setState() {}, setMet() {}, setVisitors() {}, setPaused() {}, walkToSlot() {}, watchCraft() {}, emote() {}, pose: () => ({ x: START.x, y: START.y, facing: 'up' }), paintSelfie() {}, slots };
  const mainCtx: CanvasRenderingContext2D = main;
  let ctx: CanvasRenderingContext2D = mainCtx, OFF: HTMLCanvasElement | null = null;
  let C: Colors = readColors(), fam = canvasFamily();
  const F = (w: number | string, px: number) => `${w} ${px}px ${fam}`;
  const refreshTheme = () => { C = readColors(); fam = canvasFamily(); };
  const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', refreshTheme);
  const mo = new MutationObserver(refreshTheme); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const col = (name: string) => (name === 'skin' ? C.skin : name === 'skin-2' || name === 'skin2' ? C.skin2 : (C as unknown as Record<string, string>)[name] ?? C.ink);

  /* ---------- state ---------- */
  let W = 800, H = 600, DPR = 1, S = 1, Z = 1, focusV = 0, focusRef: Slot | null = null, cam = { x: 0, y: 0 };
  let fill = false, overview = false, zoomMix = 1, snapCam = true, mini: { x: number; y: number; w: number; h: number; k: number } | null = null;
  const camF = { x: START.x, y: START.y };
  let craftV = 0;
  let me: Character = characterFor('AAAAAA'), meCode = 'AAAAAA', paused = false, raf = 0, last = 0, moved = false;
  let st: EngineState = { wear: null, notes: 0, lit: 0, garland: false, diyas: true };
  const player: Walker & { path: Pt[]; arrive: (() => void) | null } = { x: START.x, y: START.y, facing: 'up', moving: false, seed: 0, top: '', pants: '', path: [], arrive: null };
  const ptr = { x: -1, y: -1, inside: false, type: 'mouse', down: false };
  const keys = { l: 0, r: 0, u: 0, d: 0 };
  let hits: Ent[] = [], hovered: Ent | null = null, press: Ent | null = null, holdT = 0, badges: Badge[] = [], badgePress = -1, badgeSeen = false, nearest = -1;
  let craft: { slot: Slot; start: number } | null = null;
  let mySay = '', mySayUntil = 0, metIds = new Set<string>();
  const sprites = new Map<string, Sprite>();
  const mirrorSlot = slots.find(s => s.maker?.mirror) ?? null;
  const MIRROR = mirrorSlot ? { x: mirrorSlot.cx + 64 * SS, y: mirrorSlot.base - 118 * SS } : null;
  const hasEarrings = !!mirrorSlot?.maker?.items.some(i => i.art === 'drop' || i.art === 'chandbali');

  const imgs: Record<string, HTMLImageElement> = {};
  for (const m of data.makers) for (const it of m.items) { const im = new Image(); im.src = artDataUri(it.art, it.color); imgs[it.key] = im; }

  const clock = { fixed: opts.hour ?? null, hour: opts.hour ?? hourOf(new Date()), at: 0 };
  const startCrowd = crowdAt(clock.hour);
  const shoppers: Shopper[] = NPC.map((n, i) => ({ ...n, active: i < startCrowd, alpha: i < startCrowd ? 1 : 0, leaving: false, seed: i * 1.7, facing: 'down' as Facing, moving: false, state: 'browse' as const, timer: 1 + i, path: [], say: '', sayUntil: 0, stall: null }));
  const stocked = slots.filter(s => s.maker);

  /* ---------- helpers ---------- */
  const inBox = (w: Pt, b: number[]) => w.x >= b[0] && w.x <= b[0] + b[2] && w.y >= b[1] && w.y <= b[1] + b[3];
  const toWorld = (sx: number, sy: number): Pt => ({ x: (sx + cam.x) / Z, y: (sy + cam.y) / Z });
  const eyes = (x: number, y: number, gap: number, r: number, dx: number) => { ctx.fillStyle = C.hair; ctx.beginPath(); ctx.arc(x - gap + dx, y, r, 0, TAU); ctx.arc(x + gap + dx, y, r, 0, TAU); ctx.fill(); };
  const arch = (x: number, base: number, w: number, h: number) => { ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - h + w / 2); ctx.arc(x + w / 2, base - h + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, base); ctx.closePath(); };
  const nearInfo = () => {
    let best: { s: Slot; d: number } | null = null, nearSlot: Slot | null = null;
    for (const s of slots) {
      const dx = Math.abs(player.x - s.cx), dy = player.y - s.base;
      if (dx < 92 && dy > 0 && dy < 100) nearSlot = s;
      if (s.maker) { const d = Math.hypot(player.x - s.cx, player.y - (s.base + 40)); if (!best || d < best.d) best = { s, d }; }
    }
    const mirrorNear = !!(MIRROR && mirrorSlot) && Math.abs(player.x - MIRROR!.x) < 56 && player.y - mirrorSlot!.base > 0 && player.y - mirrorSlot!.base < 110;
    return { nearSlot, nearest: best?.s ?? null, mirrorNear };
  };

  /* ---------- drawing: floor, bunting, diyas ---------- */
  function drawGround() {
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = C.cream; for (let x = -20; x < WORLD_W; x += 190) { arch(x + 10, 250, 170, 200); ctx.fill(); }
    ctx.fillStyle = C.sage; ctx.globalAlpha = .3; for (let x = 60; x < WORLD_W; x += 240) { arch(x, 250, 150, 170); ctx.fill(); } ctx.globalAlpha = 1;
    ctx.fillStyle = C.ground; ctx.fillRect(0, 250, WORLD_W, WORLD_H - 250);
    ctx.fillStyle = C.cream; ctx.globalAlpha = .8; RECTS.forEach(r => { ctx.beginPath(); ctx.roundRect(r.x, r.y - 6, r.w, r.h + 12, 10); ctx.fill(); }); ctx.globalAlpha = 1;
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.setLineDash([8, 10]);
    ctx.beginPath(); ctx.moveTo(NODES[0].x, NODES[0].y); NODES.slice(1).forEach(n => ctx.lineTo(n.x, n.y)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(525, 340); ctx.scale(1, .42); const R = 74;
    for (let i = 0; i < 12; i++) { ctx.save(); ctx.rotate(i * TAU / 12); ctx.fillStyle = i % 2 ? C.mustard : C.orange; ctx.globalAlpha = .55; ctx.beginPath(); ctx.ellipse(0, -R * .66, R * .15, R * .34, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.globalAlpha = 1; ctx.strokeStyle = C.green; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(0, 0, R * .2, 0, TAU); ctx.fill(); ctx.fillStyle = C.mustard; ctx.beginPath(); ctx.arc(0, 0, R * .08, 0, TAU); ctx.fill(); ctx.restore();
  }
  /** One diya on the rangoli per quest done today. */
  function drawDiyas(t: number) {
    if (!st.diyas) return;   // Diwali is over: the diyas are put away
    [[-96, 354], [0, 392], [96, 354]].forEach(([dx, dy], i) => {
      const x = 525 + dx, y = dy, lit = i < st.lit;
      ctx.fillStyle = C.terraD; ctx.beginPath(); ctx.ellipse(x, y, 13, 6, 0, 0, Math.PI); ctx.fill(); ctx.fillStyle = C.orange; ctx.beginPath(); ctx.ellipse(x, y, 13, 4, 0, 0, TAU); ctx.fill();
      if (lit) { const f = reduce ? 1 : .85 + .15 * Math.sin(t * 9 + i * 2); ctx.fillStyle = 'rgba(255,196,60,.28)'; ctx.beginPath(); ctx.arc(x, y - 10, 20 * f, 0, TAU); ctx.fill(); ctx.fillStyle = C.mustard; ctx.beginPath(); ctx.ellipse(x, y - 9, 3.4, 8 * f, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fffdf9'; ctx.beginPath(); ctx.ellipse(x, y - 7, 1.4, 3.6, 0, 0, TAU); ctx.fill(); }
      else { ctx.strokeStyle = C.muted; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x, y - 8); ctx.stroke(); }
    });
  }
  function drawBunting(t: number) {
    ctx.strokeStyle = C.woodD; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-10, 8); ctx.quadraticCurveTo(WORLD_W / 2, 36, WORLD_W + 10, 8); ctx.stroke();
    const cols = [C.orange, C.mustard, C.sage, C.indigo], met = metIds;
    const names = data.makers;
    for (let i = 0, x = 20; x < WORLD_W; i++, x += 36) {
      const u = x / WORLD_W, y = 8 + (1 - Math.pow(2 * u - 1, 2)) * 14, who = names.length ? names[i % names.length] : null, lit = !!who && met.has(who.id);
      ctx.save(); ctx.translate(x, y); ctx.rotate(reduce ? 0 : Math.sin(t * 2 + i) * .06);
      ctx.fillStyle = lit ? cols[i % 4] : C.cream; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(0, 19); ctx.closePath(); ctx.fill();
      if (!lit) { ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke(); } ctx.restore();
    }
  }

  /* ---------- drawing: maker, mirror, stall ---------- */
  /**
   * An arm from the shoulder at sx to a hand whose fingertips touch hp. The elbow stays by the body, the wrist sits one hand-length back from the fingertips,
   * and the fingers always carry on in the direction the forearm is going: if the pose would have them point back the way the arm came, the hand is turned round.
   */
  function drawArm(sx: number, hp: HandPose, skin: string, bangle: string) {
    const place = (ang: number) => { const wx = hp.x - Math.cos(ang) * REACH, wy = hp.y - Math.sin(ang) * REACH; return { wx, wy, ex: sx * 1.25, ey: Math.min(-47, (-60 + wy) / 2 + 5) }; };
    let ang = hp.ang, g = place(ang);
    if ((g.wx - g.ex) * Math.cos(ang) + (g.wy - g.ey) * Math.sin(ang) < 0) { ang = Math.atan2(g.wy - g.ey, g.wx - g.ex); g = place(ang); }
    ctx.strokeStyle = skin; ctx.lineWidth = 4.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, -60); ctx.quadraticCurveTo(g.ex, g.ey, g.wx, g.wy); ctx.stroke();
    drawHand(ctx, g.wx, g.wy, ang, skin, bangle, hp.curl, hp.mirror ?? false, HAND_SCALE);
  }
  function drawMaker(slot: Slot, att: number, t: number, work?: (c: CanvasRenderingContext2D) => Job) {
    const m = slot.maker!, L = m.look, seed = hash32(m.id) % 7, look = slot.look;
    const bob = reduce ? 0 : Math.sin(t * 2 + seed) * 1.1, nod = work ? 3.5 + (reduce ? 0 : Math.sin(t * 3) * .8) : reduce ? 0 : att * Math.sin(t * 5) * 1.6, skin = L.skin === 'skin' ? C.skin : C.skin2, hairC = C.hair;
    // Long hair hangs at the back: behind the neck and the shoulders, so it is drawn before the body.
    if (L.long) { ctx.save(); ctx.translate(0, -90 + bob + nod); ctx.fillStyle = hairC; ctx.beginPath(); ctx.roundRect(-14, -6, 28, 34, 10); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = col(L.top); ctx.beginPath(); ctx.moveTo(-27, -36); ctx.lineTo(-23, -64); ctx.quadraticCurveTo(0, -74, 23, -64); ctx.lineTo(27, -36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col(L.acc); ctx.beginPath(); ctx.moveTo(-23, -64); ctx.quadraticCurveTo(-6, -58, 10, -40); ctx.lineTo(18, -40); ctx.quadraticCurveTo(0, -62, -12, -69); ctx.closePath(); ctx.fill();
    // The head (and the hair that hangs behind it) is drawn before the work, so hair never covers what the maker is making.
    const head = () => {
      ctx.save(); ctx.translate(0, -90 + bob + nod);
      ctx.fillStyle = skin; ctx.fillRect(-4, 0, 8, 28 - bob - nod);   // the neck moves with the head, so there is never a gap under the chin
      ctx.beginPath(); ctx.arc(0, 0, 12.5, 0, TAU); ctx.fill();
      ctx.fillStyle = hairC; ctx.beginPath(); ctx.arc(0, -1, 13, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(7, -6, 0, -5); ctx.quadraticCurveTo(-7, -6, -13, -1); ctx.fill();
      if (L.bun) { ctx.beginPath(); ctx.arc(0, -15, 6, 0, TAU); ctx.fill(); }
      if (work) { ctx.strokeStyle = C.hair; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; for (const dx of [-4.3, 4.3]) { ctx.beginPath(); ctx.arc(dx, .4, 1.9, .12 * Math.PI, .88 * Math.PI); ctx.stroke(); } }   // eyes down on the work
      else eyes(0, 1, 4.3, 1.3, look * 1.6);
      ctx.strokeStyle = C.terraD; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(work ? 0 : look, 4 + (work ? 0 : att), work ? 2.8 : 3.6, .15 * Math.PI, .85 * Math.PI); ctx.stroke();
      ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(0, -5, 1.3, 0, TAU); ctx.fill(); ctx.restore();
    };
    if (work) {
      // at work: the craft sits on the counter in front of them, and both arms reach down to it with proper hands
      head();
      const RAISE = 8;   // the work sits on top of the counter edge, not behind it
      ctx.save(); ctx.translate(0, -RAISE); const j0 = work(ctx); ctx.restore();
      const job: Job = { left: { ...j0.left, y: j0.left.y - RAISE }, right: { ...j0.right, y: j0.right.y - RAISE } }, bangle = col(L.acc);
      drawArm(-22, job.left, skin, bangle); drawArm(22, job.right, skin, bangle);
    } else {
      const wx = 30 + (reduce ? 0 : Math.sin(t * 9) * 5), wy = -104 + (reduce ? 0 : Math.sin(t * 9 + 1) * 2);
      const wkx = 14 + (reduce ? 0 : Math.sin(t * 3 + seed) * 4), wky = -46 + (reduce ? 0 : Math.cos(t * 3 + seed) * 2);
      const ax = wkx + (wx - wkx) * att, ay = wky + (wy - wky) * att, lx = -17 + (reduce ? 0 : Math.sin(t * 3 + 2) * 3);
      // the right hand rests on the counter and lifts into a wave when you are near; the left hand rests on the counter
      const bangle = col(L.acc), WAVE: HandPose = { x: ax, y: ay - 3, ang: -1.45 + (reduce ? 0 : Math.sin(t * 9) * .3) * att, curl: [.08, .08, .14, .2, .12], mirror: true };
      drawArm(22, att > .08 ? WAVE : { x: ax, y: ay, ang: 1.9, curl: HOLD, mirror: true }, skin, bangle);
      drawArm(-22, { x: lx, y: -46, ang: 1.2, curl: HOLD }, skin, bangle);
      if (m.craft === 'crochet') { ctx.fillStyle = C.sage; ctx.beginPath(); ctx.arc(-34, -44, 8, 0, TAU); ctx.fill(); ctx.strokeStyle = C.chalk; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-34, -44, 4, 0, Math.PI * 1.5); ctx.stroke(); ctx.strokeStyle = C.woodD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax - 2, ay + 2); ctx.lineTo(ax - 14, ay - 8); ctx.stroke(); }
      else if (att > .2) { const sp = reduce ? 1 : .6 + .4 * Math.sin(t * 8); ctx.fillStyle = C.mustard; ctx.globalAlpha = att; ctx.beginPath(); ctx.arc(ax + 7, ay - 6, 2.4 * sp, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    }
    if (!work) head();
  }
  const earOn = () => (st.wear?.kind === 'ear' ? st.wear : null);
  const outfit = () => (st.wear?.kind === 'outfit' ? st.wear : null);
  const topOf = () => outfit()?.top ?? me.top, accOf = () => outfit()?.acc ?? me.acc;
  const earrings = (x: number, y: number, ear: { art: 'drop' | 'chandbali'; color: string }, d: number, k = 1) => [-d, d].forEach(dx => {
    ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.arc(x + dx, y, 1.7 * k, 0, TAU); ctx.fill();
    ctx.fillStyle = ear.art === 'drop' ? ear.color : '#b3262e'; ctx.beginPath(); ctx.arc(x + dx, y + 6 * k, 3.1 * k, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fbf7ef'; ctx.beginPath(); ctx.arc(x + dx, y + 12 * k, 2.2 * k, 0, TAU); ctx.fill();
  });
  function drawMirror(slot: Slot) {
    // Your reflection follows where you actually stand: slide along the counter and it slides across the glass, step closer and it grows.
    const cx = 64, cy = -118, rx = 25, ry = 64, mxw = slot.cx + cx * SS, dxw = player.x - mxw, dy = player.y - slot.base;
    const vis = Math.max(0, 1 - Math.abs(dxw) / 230) * Math.max(0, Math.min(1, 1.1 - dy / 300));
    const ox = Math.max(-rx * 1.3, Math.min(rx * 1.3, dxw / SS * .4)), sc = Math.max(.72, Math.min(1.18, 1.25 - dy / 330));
    ctx.fillStyle = C.woodD; ctx.beginPath(); ctx.roundRect(cx - rx - 4, cy - ry - 4, rx * 2 + 8, ry * 2 + 8, rx + 4); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx - rx, cy - ry, rx * 2, ry * 2, rx); ctx.clip();
    const g = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry); g.addColorStop(0, C.white); g.addColorStop(1, C.sage); ctx.fillStyle = g; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    if (vis > .02) {
      const x = cx + ox, front = player.facing !== 'down', wave = front && slot.att > .5, hy = cy - 16;
      ctx.save(); ctx.translate(x, cy + 10); ctx.scale(sc, sc); ctx.translate(-x, -(cy + 10)); ctx.globalAlpha = vis;
      ctx.fillStyle = me.pants; ctx.fillRect(x - 17, cy + 32, 34, ry);
      if (front) hairBack(me, x, hy, 12.5, 'front', C.hair);   // hair hangs behind the body
      ctx.fillStyle = topOf(); ctx.beginPath(); ctx.moveTo(x - 30, cy + 44); ctx.quadraticCurveTo(x - 28, cy - 2, x, cy - 3); ctx.quadraticCurveTo(x + 28, cy - 2, x + 30, cy + 44); ctx.closePath(); ctx.fill();
      if (front) { ctx.fillStyle = accOf(); ctx.beginPath(); ctx.moveTo(x - 24, cy + 2); ctx.quadraticCurveTo(x - 6, cy + 6, x + 10, cy + 40); ctx.lineTo(x + 21, cy + 40); ctx.quadraticCurveTo(x + 2, cy + 2, x - 16, cy - 2); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = me.skin; ctx.lineWidth = 5; ctx.lineCap = 'round';
      if (wave) { ctx.beginPath(); ctx.moveTo(x + 26, cy + 6); ctx.lineTo(x + 35 + (reduce ? 0 : Math.sin(Date.now() / 110) * 4), hy - 8); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(x + 27, cy + 6); ctx.lineTo(x + 31, cy + 40); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(x - 27, cy + 6); ctx.lineTo(x - 31, cy + 40); ctx.stroke();
      ctx.fillStyle = me.skin; ctx.fillRect(x - 4, hy + 8, 8, 12);
      if (!front) hairBack(me, x, hy, 12.5, 'back', C.hair);
      ctx.fillStyle = me.skin; ctx.beginPath(); ctx.arc(x, hy, 12.5, 0, TAU); ctx.fill();
      ctx.fillStyle = C.hair; ctx.beginPath();
      if (front) { ctx.arc(x, hy - 1, 13, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(x + 6, hy - 6, x, hy - 5); ctx.quadraticCurveTo(x - 6, hy - 6, x - 13, hy - 1); } else ctx.arc(x, hy, 13, 0, TAU);
      ctx.fill();
      hairFront(me, x, hy, 12.5, front ? 'front' : 'back', C.hair);
      if (front) { eyes(x, hy + 1, 4.2, 1.2, 0); ctx.strokeStyle = C.terraD; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, hy + 4, 3.4, .15 * Math.PI, .85 * Math.PI); ctx.stroke(); }
      const ear = earOn(); if (ear) earrings(x, hy + 3, ear, 12.8, 1.05);
      ctx.restore();
    }
    const gx = cx + Math.sin(player.x * .01) * rx * 1.1; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = .28;
    ctx.beginPath(); ctx.moveTo(gx - 4, cy - ry); ctx.lineTo(gx + 5, cy - ry); ctx.lineTo(gx - 9, cy + ry); ctx.lineTo(gx - 18, cy + ry); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore();
    ctx.strokeStyle = C.mustard; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(cx - rx - 4, cy - ry - 4, rx * 2 + 8, ry * 2 + 8, rx + 4); ctx.stroke();
  }
  function drawNotes() { // feedback notes pinned on the wall beside the mirror
    const n = Math.min(st.notes, 4), cols = ['#f2d27a', '#e8a0a0', '#a9d3b0', '#a9c4e8'];
    for (let i = 0; i < n; i++) { ctx.save(); ctx.translate(-82 + (i % 2) * 22, -168 + Math.floor(i / 2) * 24); ctx.rotate(i % 2 ? .08 : -.07);
      ctx.fillStyle = cols[i]; ctx.fillRect(-9, -9, 18, 18); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(-6, -3, 12, 1.5); ctx.fillRect(-6, 1, 9, 1.5); ctx.restore(); }
  }
  function drawStallBody(slot: Slot) {
    const open = slot.open, m = slot.maker;
    const aw1 = open ? C.line : C.green, aw2 = open ? C.cream : C.orange, aw3 = open ? C.line : C.mustard;
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(0, 3, 124, 11, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(0, -slot.hov * 7);
    ctx.fillStyle = C.woodD; ctx.fillRect(-106, -214, 10, 214); ctx.fillRect(96, -214, 10, 214);
    if (slot.hov > .01) { ctx.shadowColor = C.mustard; ctx.shadowBlur = 26 * slot.hov; }
    ctx.fillStyle = C.white; ctx.fillRect(-96, -190, 192, 152); ctx.shadowBlur = 0;
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(-96, -190, 192, 152);
    ctx.fillStyle = C.wood; ctx.fillRect(-96, -112, 192, 6);
    if (open || !m) {
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.strokeRect(-70, -152, 140, 36); ctx.setLineDash([]);
      ctx.fillStyle = C.muted; ctx.font = F(500, 13); ctx.textAlign = 'center'; ctx.fillText('your craft here', 0, -130);
      ctx.fillStyle = C.wood; ctx.fillRect(-14, -62, 28, 5); ctx.fillRect(-12, -57, 3, 20); ctx.fillRect(9, -57, 3, 20);
    } else {
      const its = m.items, n = its.length, sz = 38, gap = 14, tot = n * sz + (n - 1) * gap;
      its.forEach((it, i) => { const im = imgs[it.key]; if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -tot / 2 + i * (sz + gap), -112 - sz, sz, sz); });
      if (m.mirror) { drawMirror(slot); drawNotes(); }
      const working = craft && craft.slot === slot ? craft : null;
      drawMaker(slot, slot.att, nowT, working ? c2 => drawCounterCraft(c2, m.craft, Math.min(1, (nowMs - working.start) / 1000 / CRAFT_SECONDS), nowT, C, reduce) : undefined);
    }
    ctx.fillStyle = C.chalk; ctx.beginPath(); ctx.roundRect(-110, -44, 220, 10, 3); ctx.fill();
    ctx.fillStyle = open ? C.cream : C.green; ctx.fillRect(-104, -34, 208, 34);
    if (!open) { ctx.fillStyle = C.mustard; for (let x = -92; x <= 92; x += 26) { ctx.beginPath(); ctx.arc(x, -20, 5, 0, TAU); ctx.fill(); } ctx.fillStyle = C.orange; ctx.fillRect(-104, -6, 208, 6); }
    else { ctx.fillStyle = C.line; ctx.fillRect(-104, -6, 208, 6); }
    ctx.fillStyle = aw1; ctx.beginPath(); ctx.moveTo(-84, -248); ctx.lineTo(84, -248); ctx.lineTo(118, -212); ctx.lineTo(-118, -212); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? aw3 : aw2; const x = -118 + i * 39.33; ctx.beginPath(); ctx.moveTo(x, -212); ctx.lineTo(x + 39.33, -212); ctx.lineTo(x + 39.33, -192); ctx.arc(x + 19.66, -192, 19.66, 0, Math.PI); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = C.woodD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-50, -248); ctx.lineTo(-50, -256); ctx.moveTo(50, -248); ctx.lineTo(50, -256); ctx.stroke();
    ctx.fillStyle = C.board; ctx.beginPath(); ctx.roundRect(-84, -286, 168, 32, 5); ctx.fill();
    ctx.strokeStyle = C.mustard; ctx.globalAlpha = .6; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(-80, -282, 160, 24, 3); ctx.stroke(); ctx.globalAlpha = 1;
    const label = open || !m ? (slot.label === 'Open stall' ? 'Open stall' : `${slot.label} · open`) : m.name; let fs = 14; ctx.font = F(600, fs);
    const tw = ctx.measureText(label).width; if (tw > 150) { fs = Math.max(8, fs * 150 / tw); ctx.font = F(600, fs); }
    ctx.fillStyle = C.chalk; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, -269); ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  /* ---------- drawing: people ---------- */
  /** Hair that sits behind the face: long hair, a bob, or the braid seen from behind. cx, cy and r are the head's centre and radius. */
  function hairBack(p: Look, cx: number, cy: number, r: number, view: View, hair: string) {
    const k = r / 12; ctx.fillStyle = hair;
    if (p.hairStyle === 'long') { ctx.beginPath(); ctx.roundRect(cx - 13 * k, cy - 8 * k, (view === 'side' ? 20 : 26) * k, 34 * k, 9 * k); ctx.fill(); }
    else if (p.hairStyle === 'bob') { ctx.beginPath(); ctx.roundRect(cx - 13 * k, cy - 8 * k, (view === 'side' ? 20 : 26) * k, 20 * k, 8 * k); ctx.fill(); }
    else if (p.hairStyle === 'braid' && view === 'back') { ctx.beginPath(); ctx.roundRect(cx - 3.5 * k, cy + 2 * k, 7 * k, 38 * k, 3.5 * k); ctx.fill(); ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(cx, cy + 38 * k, 3 * k, 0, TAU); ctx.fill(); }
  }
  /** What sits on top of and in front of the face: a bun, a turban or cap, a beard, a bindi, a braid over the shoulder. */
  function hairFront(p: Look, cx: number, cy: number, r: number, view: View, hair: string) {
    const k = r / 12, hw = p.headwear;
    if (p.hairStyle === 'bun' && !hw) { ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(cx, cy - 15 * k, 6 * k, 0, TAU); ctx.fill(); }
    if (p.hairStyle === 'braid' && view !== 'back') { ctx.fillStyle = hair; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx + (10 + i * .6) * k, cy + (8 + i * 8) * k, 3.2 * k, 0, TAU); ctx.fill(); } ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(cx + 12.2 * k, cy + 34 * k, 2.4 * k, 0, TAU); ctx.fill(); }
    if (p.beard && view === 'front') {
      ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(cx - 10 * k, cy + 1 * k); ctx.quadraticCurveTo(cx, cy + 17 * k, cx + 10 * k, cy + 1 * k); ctx.quadraticCurveTo(cx, cy + 7 * k, cx - 10 * k, cy + 1 * k); ctx.fill();
      ctx.strokeStyle = hair; ctx.lineWidth = 2 * k; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - 5 * k, cy + 5 * k); ctx.quadraticCurveTo(cx, cy + 3 * k, cx + 5 * k, cy + 5 * k); ctx.stroke();
    } else if (p.beard && view === 'side') { ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(cx + 6 * k, cy + 6 * k, 6 * k, 5 * k, 0, 0, TAU); ctx.fill(); }
    if (hw?.kind === 'pagdi') {
      ctx.fillStyle = hw.color; ctx.beginPath(); ctx.ellipse(cx, cy - 8 * k, 15 * k, 10 * k, 0, 0, TAU); ctx.fill(); ctx.fillRect(cx - 13.5 * k, cy - 7 * k, 27 * k, 4.5 * k);
      ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.arc(cx, cy - 5 * k, 13 * k, 0.2, Math.PI - 0.2); ctx.moveTo(cx - 11 * k, cy - 12 * k); ctx.quadraticCurveTo(cx, cy - 17 * k, cx + 11 * k, cy - 12 * k); ctx.stroke();
      if (view !== 'back') { ctx.fillStyle = '#fbf7ef'; ctx.beginPath(); ctx.arc(cx, cy - 10 * k, 2 * k, 0, TAU); ctx.fill(); }
    } else if (hw?.kind === 'cap') {
      ctx.fillStyle = hw.color; ctx.beginPath(); ctx.arc(cx, cy - 4 * k, 13 * k, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(cx - 14 * k, cy - 5.5 * k, 28 * k, 3 * k);
    }
    if (p.bindi && view === 'front') { ctx.fillStyle = '#b3262e'; ctx.beginPath(); ctx.arc(cx, cy - 5 * k, 1.5 * k, 0, TAU); ctx.fill(); }
  }
  function drawPerson(p: Walker, t: number, look: number) {
    const f = p.facing, side = f === 'left' || f === 'right', mv = p.moving, ph = t * 8 + p.seed, sw = mv && !reduce ? Math.sin(ph) : 0, bob = mv && !reduce ? -Math.abs(Math.cos(ph)) * 2.2 : 0;
    const skin = p.skinHex ?? col(p.skin ?? 'skin'), hair = '#2a211c', top = p.top, pants = p.pants;
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(0, 1, 20, 5, 0, 0, TAU); ctx.fill();
    ctx.save(); if (f === 'left') ctx.scale(-1, 1); ctx.translate(0, bob);
    ctx.fillStyle = pants;
    if (side) { ctx.fillRect(-5 + sw * 6, -46, 8, 46); ctx.fillRect(-3 - sw * 6, -46, 8, 46); }
    else { const lh = 46 - Math.max(0, sw) * 4, rh = 46 - Math.max(0, -sw) * 4; ctx.fillRect(-9, -lh, 8, lh); ctx.fillRect(1, -rh, 8, rh); }
    ctx.fillStyle = C.board; ctx.beginPath(); if (side) { ctx.ellipse(-1 + sw * 6, 0, 7, 3.5, 0, 0, TAU); ctx.ellipse(1 - sw * 6, 0, 7, 3.5, 0, 0, TAU); } else { ctx.ellipse(-5, 0, 6, 3.5, 0, 0, TAU); ctx.ellipse(5, 0, 6, 3.5, 0, 0, TAU); } ctx.fill();
    // Hair that hangs down is drawn behind the body; seen from behind it falls over the back, so it stays in front there.
    const view: View = f === 'up' ? 'back' : side ? 'side' : 'front';
    if (view !== 'back') hairBack(p, side ? 1 : 0, -106, 12, view, hair);
    const tw = side ? 11 : 15; ctx.fillStyle = top; ctx.beginPath(); ctx.moveTo(-tw, -46); ctx.lineTo(-tw + 3, -88); ctx.quadraticCurveTo(0, -95, tw - 3, -88); ctx.lineTo(tw, -46); ctx.closePath(); ctx.fill();
    if (p.acc && f !== 'up') { ctx.fillStyle = p.acc; ctx.beginPath(); ctx.moveTo(-tw + 3, -88); ctx.quadraticCurveTo(-2, -80, 6, -50); ctx.lineTo(tw, -50); ctx.quadraticCurveTo(2, -84, -tw + 8, -91); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = skin; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const browse = p.state === 'browse', lift = browse && !reduce ? Math.sin(t * 3 + p.seed) * 3 : 0;
    if (side) { ctx.beginPath(); ctx.moveTo(0, -84); ctx.lineTo(sw * 9, -56); ctx.stroke(); if (browse) { ctx.beginPath(); ctx.moveTo(0, -84); ctx.lineTo(16, -80 + lift); ctx.stroke(); } }
    else {
      ctx.beginPath(); ctx.moveTo(-tw + 3, -84); if (p.waveL) ctx.lineTo(-tw - 10, -102 + (reduce ? 0 : Math.sin(ph) * 3)); else ctx.lineTo(-tw - 3 - sw * 3, -56); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tw - 3, -84); if (browse) ctx.lineTo(tw + 9, -86 + lift); else if (p.phone) ctx.lineTo(19, -93); else ctx.lineTo(tw + 3 + sw * 3, -56); ctx.stroke();
    }
    if (p.bag && !browse) { const bx = side ? 4 : 14; ctx.fillStyle = C.chalk; ctx.fillRect(bx, -58, 15, 17); ctx.fillStyle = C.orange; ctx.fillRect(bx, -52, 15, 4); ctx.strokeStyle = C.woodD; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(bx + 7.5, -58, 5, Math.PI, 0); ctx.stroke(); }
    if (p.garland && f !== 'up') { for (let i = 0; i <= 8; i++) { const u = i / 8, gx = -tw + 4 + (tw * 2 - 8) * u, gy = -88 + 12 * Math.sin(Math.PI * u) + 6; ctx.fillStyle = i % 2 ? '#f29a1f' : '#e8b02e'; ctx.beginPath(); ctx.arc(gx, gy, 3.2, 0, TAU); ctx.fill(); } }
    ctx.fillStyle = skin; ctx.fillRect(-3, -98, 6, 8);
    if (view === 'back') hairBack(p, 0, -106, 12, view, hair);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(side ? 1 : 0, -106, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = hair; ctx.beginPath();
    if (f === 'up') ctx.arc(0, -106, 12.6, 0, TAU);
    else if (side) { ctx.arc(1, -107, 12.6, Math.PI * .85, Math.PI * 1.95); ctx.lineTo(-10, -100); ctx.closePath(); }
    else { ctx.arc(0, -107, 12.6, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(6, -112, 0, -111); ctx.quadraticCurveTo(-6, -112, -12.6, -107); }
    ctx.fill();
    hairFront(p, side ? 1 : 0, -106, 12, view, hair);
    if (p.ear && f === 'down') earrings(0, -103, p.ear, 12.8, .5);
    if (f === 'down') eyes(0, -105, 4.2, 1.3, look * 2);
    else if (side) { ctx.fillStyle = C.hair; ctx.beginPath(); ctx.arc(7, -105, 1.3, 0, TAU); ctx.fill(); ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(13, -103, 2.2, 0, TAU); ctx.fill(); }
    if (p.phone && f === 'down') { ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(19, -93, 4, 0, TAU); ctx.fill(); ctx.save(); ctx.translate(20, -100); ctx.rotate(.16); ctx.fillStyle = '#1d241e'; ctx.beginPath(); ctx.roundRect(-6, -13, 12, 25, 2.5); ctx.fill(); ctx.fillStyle = '#5b645c'; ctx.beginPath(); ctx.arc(-2.5, -9, 2, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }
  const meWalker = (): Walker => ({ x: player.x, y: player.y, facing: player.facing, moving: player.moving, seed: player.seed, top: topOf(), skinHex: me.skin, pants: me.pants, hairStyle: me.hairStyle, headwear: me.headwear, beard: me.beard, bindi: me.bindi, bag: me.bag, acc: accOf(), ear: earOn(), garland: st.garland });

  /* ---------- screen-space overlays ---------- */
  function pill(x: number, y: number, text: string, fill: string, ink: string, size = 11) {
    ctx.save(); ctx.font = F(600, size); const w = ctx.measureText(text).width + 20, h = size + 11, bx = Math.max(4, Math.min(W - w - 4, x - w / 2)), by = Math.max(4, y - h);
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(bx, by, w, h, h / 2); ctx.fill(); ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + w / 2, by + h / 2 + .5); ctx.restore();
  }
  function bubble(x: number, y: number, text: string, dark: boolean) {
    ctx.save(); ctx.font = F(500, 12); const w = Math.min(300, ctx.measureText(text).width + 22), h = 28, bx = Math.max(6, Math.min(W - w - 6, x - w / 2)), by = Math.max(6, y - h - 8);
    ctx.fillStyle = dark ? C.green : C.white; ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(bx, by, w, h, 8); ctx.fill(); if (!dark) ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 5, by + h); ctx.lineTo(x, by + h + 7); ctx.lineTo(x + 5, by + h); ctx.fill();
    ctx.fillStyle = dark ? C.greenInk : C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + w / 2, by + h / 2 + .5); ctx.restore();
  }
  function drawIcon(i: number, x: number, y: number, colr: string) {
    ctx.save(); ctx.translate(x - 6.6, y - 6.6); ctx.scale(.55, .55); ctx.strokeStyle = colr; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (i === 0) { ctx.stroke(new Path2D('M4 8h3l1.5-2h7L17 8h3v11H4z')); ctx.beginPath(); ctx.arc(12, 13, 3.5, 0, TAU); ctx.stroke(); }
    else if (i === 1) ctx.stroke(new Path2D('M5 4h14v11l-5 5H5z M14 20v-5h5 M8 9h8 M8 12h5'));
    else { ctx.stroke(new Path2D('M12 3a3 3 0 0 1 0 6 M12 17v4')); ctx.beginPath(); ctx.arc(12, 14, 3, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  const badgeAt = (x: number, y: number) => badges.findIndex(b => Math.hypot(x - b.x, y - b.y) <= b.r + 4);
  function drawBadges(t: number, sx: (x: number) => number, sy: (y: number) => number, mirrorNear: boolean) {
    if (!MIRROR) { badges = []; return; }
    const all = [{ i: 0, label: 'Take a selfie' }, { i: 1, label: 'Leave a note' }, ...(hasEarrings ? [{ i: 2, label: 'Try on earrings' }] : [])];
    const COL = [C.orange, C.mustard, C.indigo], INK = ['#fffdf9', '#2b3a31', '#fffdf9'];
    const a = focusRef && focusRef !== mirrorSlot ? 1 - .6 * focusV : 1;
    badges = all.map((b, k) => ({ i: b.i, x: sx(MIRROR.x + 38), y: sy(MIRROR.y) + (k - (all.length - 1) / 2) * 25, r: 10 }));
    const hov = ptr.inside && !paused ? badgeAt(ptr.x, ptr.y) : -1; if (hov >= 0) canvas.style.cursor = 'pointer';
    ctx.save();
    badges.forEach((b, k) => {
      const h = hov === k, r = b.r * (h ? 1.12 : 1), pulse = !badgeSeen && !reduce ? (Math.sin(t * 3 + k * .7) + 1) / 2 : 0;
      if (pulse) { ctx.strokeStyle = COL[b.i]; ctx.globalAlpha = a * (1 - pulse) * .85; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, r + 2 + pulse * 6, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = a; ctx.fillStyle = COL[b.i]; ctx.strokeStyle = '#fffdf9'; ctx.lineWidth = h ? 2.2 : 1.5; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill(); ctx.stroke();
      drawIcon(b.i, b.x, b.y, INK[b.i]);
      if (h || mirrorNear) { ctx.font = F(600, 10); const lw = ctx.measureText(all[k].label).width + 12, right = b.x + r + 6 + lw < W - 4, lx = right ? b.x + r + 6 : b.x - r - 6 - lw;
        ctx.fillStyle = COL[b.i]; ctx.beginPath(); ctx.roundRect(lx, b.y - 8, lw, 16, 8); ctx.fill(); ctx.fillStyle = INK[b.i]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(all[k].label, lx + lw / 2, b.y + .5); }
    });
    ctx.restore();
  }
  /* ---------- time of day: morning sun, afternoon crowds, evening gold, chilly nights ---------- */
  let sky = skyAt(clock.hour), phase: DayPhase | null = null, lastCrowd = -1, breathT = 0;
  const puffs: Array<{ x: number; y: number; vx: number; age: number }> = [];
  function drawAtmosphere(t: number, dt: number, sx: (x: number) => number, sy: (y: number) => number) {
    ctx.save();
    if (sky.beams > .02) { // low morning sun: a glow in the corner and slanting beams across the fair
      const g = ctx.createRadialGradient(W * .06, -10, 10, W * .06, -10, W * .6); g.addColorStop(0, `rgba(255,232,170,${.38 * sky.beams})`); g.addColorStop(1, 'rgba(255,232,170,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 4; i++) {
        const x0 = W * (.04 + i * .2) + (reduce ? 0 : Math.sin(t * .25 + i * 1.7) * 14), bw = 30 + i * 12, run = H * .55, lg = ctx.createLinearGradient(x0, 0, x0 + run, H);
        lg.addColorStop(0, `rgba(255,236,176,${.2 * sky.beams})`); lg.addColorStop(1, 'rgba(255,236,176,0)'); ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + bw, 0); ctx.lineTo(x0 + bw + run, H); ctx.lineTo(x0 + run, H); ctx.closePath(); ctx.fill();
      }
    }
    if (sky.warm > .01) { ctx.fillStyle = `rgba(255,168,72,${sky.warm * .55})`; ctx.fillRect(0, 0, W, H); }
    if (sky.dark > .01) { ctx.fillStyle = `rgba(14,26,64,${sky.dark})`; ctx.fillRect(0, 0, W, H); }
    if (sky.lamps > .02) { // the lamps come on: a warm glow at every stall, on the diyas and along the bunting
      ctx.globalCompositeOperation = 'lighter';
      const glow = (x: number, y: number, r: number, a: number) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,178,88,${a})`); g.addColorStop(1, 'rgba(255,178,88,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
      for (const sl of slots) glow(sx(sl.cx), sy(sl.base - 120 * SS), 190 * SS * Z, .3 * sky.lamps * (sl.maker ? 1 : .4));
      for (let i = 0; i < (st.diyas ? st.lit : 0); i++) glow(sx(525 + [-96, 0, 96][i]), sy([354, 392, 354][i] - 10), 46 * Z, .42 * sky.lamps);
      for (let i = 0, x = 20; x < WORLD_W; i++, x += 36) { const u = x / WORLD_W; glow(sx(x), sy(8 + (1 - Math.pow(2 * u - 1, 2)) * 14 + 6), 13 * Z, .5 * sky.lamps * (.75 + .25 * Math.sin(t * 2 + i))); }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (sky.chill > .05) { // cold air: mist drifting along the ground and visible breath
      for (let i = 0; i < 7; i++) {
        const dir = i % 2 ? 1 : -1, x = ((i * 331 + (reduce ? 0 : t * 9 * dir) + W * 4) % (W + 460)) - 230, y = H * (.5 + (i % 4) * .13), r = 150 + (i % 3) * 60;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(196,214,238,${.15 * sky.chill})`); g.addColorStop(1, 'rgba(196,214,238,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      if (!reduce) {
        breathT += dt; if (breathT > 1.5 && sky.chill > .3) { breathT = 0; puffs.push({ x: player.x + (player.facing === 'left' ? -9 : player.facing === 'right' ? 9 : 0), y: player.y - 104, vx: player.facing === 'left' ? -9 : player.facing === 'right' ? 9 : 0, age: 0 }); }
        for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i]; q.age += dt; if (q.age > 1.4) { puffs.splice(i, 1); continue; } const u = q.age / 1.4; ctx.fillStyle = `rgba(232,242,255,${.45 * (1 - u) * sky.chill})`; ctx.beginPath(); ctx.arc(sx(q.x + q.vx * u * 2), sy(q.y - u * 16), (3 + u * 8) * Z * .9, 0, TAU); ctx.fill(); }
      }
    }
    ctx.restore();
  }
  /** A small map in the corner, like a game radar: the lanes, the stalls, you, the other visitors and what the camera can see. Click it to walk there. */
  function drawMinimap() {
    if (zoomMix < .25) { mini = null; return; }
    const mw = Math.round(Math.min(176, Math.max(108, W * .24))), mh = Math.round(mw * WORLD_H / WORLD_W), k = mw / WORLD_W, x = 10, y = H - mh - 10;
    mini = { x, y, w: mw, h: mh, k };
    ctx.save(); ctx.globalAlpha = Math.min(1, (zoomMix - .25) / .5);
    ctx.fillStyle = C.paper; ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x, y, mw, mh, 8); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, mw, mh, 8); ctx.clip(); ctx.translate(x, y);
    ctx.fillStyle = C.ground; ctx.fillRect(0, 0, mw, mh);
    ctx.fillStyle = C.cream; RECTS.forEach(r => ctx.fillRect(r.x * k, r.y * k, r.w * k, r.h * k));
    for (const sl of slots) { ctx.fillStyle = sl.maker ? C.green : C.line; ctx.fillRect((sl.cx - 80) * k, (sl.base - 150) * k, 160 * k, 140 * k); if (sl.maker?.mirror) { ctx.fillStyle = C.mustard; ctx.fillRect((sl.cx + 36) * k, (sl.base - 110) * k, 14 * k, 60 * k); } }
    ctx.fillStyle = C.muted; shoppers.forEach(sh => { if (!sh.active) return; ctx.beginPath(); ctx.arc(sh.x * k, sh.y * k, 1.8, 0, TAU); ctx.fill(); });
    ctx.fillStyle = C.indigo; sprites.forEach(sp => { ctx.beginPath(); ctx.arc(sp.x * k, sp.y * k, 2.6, 0, TAU); ctx.fill(); });
    ctx.strokeStyle = C.ink; ctx.globalAlpha *= .55; ctx.lineWidth = 1.2; ctx.strokeRect(Math.max(0, cam.x / Z * k), Math.max(0, cam.y / Z * k), Math.min(mw, W / Z * k), Math.min(mh, H / Z * k));
    ctx.globalAlpha = Math.min(1, (zoomMix - .25) / .5);
    ctx.fillStyle = C.orange; ctx.strokeStyle = '#fffdf9'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(player.x * k, player.y * k, 4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore(); ctx.restore();
    if (ptr.inside && !paused && ptr.x >= x && ptr.x <= x + mw && ptr.y >= y && ptr.y <= y + mh) canvas.style.cursor = 'pointer';
  }
  /** A slim caption at the top of the screen while a maker works: who, what, and how far along (the work itself happens on their counter). */
  function drawCraftCaption(now: number) {
    if (!craft) return;
    const m = craft.slot.maker!, el = (now - craft.start) / 1000, p = Math.min(1, el / CRAFT_SECONDS);
    if (el > CRAFT_SECONDS + 2.2) { endCraft(); return; }
    const text = p >= 1 ? `${m.name} · made by hand in ${m.city}` : `${m.name} · ${CRAFT_LABEL[m.craft]}`, fade = el > CRAFT_SECONDS + 1.4 ? Math.max(0, 1 - (el - CRAFT_SECONDS - 1.4) / .8) : Math.min(1, el / .25);
    ctx.save(); ctx.globalAlpha = fade; ctx.font = F(600, 13);
    const w = Math.max(230, Math.min(W - 24, ctx.measureText(text).width + 36)), x = W / 2 - w / 2, y = 10;
    ctx.fillStyle = C.board; ctx.beginPath(); ctx.roundRect(x, y, w, 40, 12); ctx.fill();
    ctx.fillStyle = C.chalk; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, W / 2, y + 15);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.roundRect(x + 14, y + 28, w - 28, 4, 2); ctx.fill();
    ctx.fillStyle = C.orange; ctx.beginPath(); ctx.roundRect(x + 14, y + 28, Math.max(4, (w - 28) * p), 4, 2); ctx.fill();
    ctx.restore();
  }
  /** Fade a whole entity as one solid layer, so parts of it never show through each other. */
  function layerDraw(e: Ent, a: number, fn: (e: Ent) => void) {
    const b = e.box, pad = 40, x0 = Math.floor(b[0] * Z - cam.x - pad), y0 = Math.floor(b[1] * Z - cam.y - pad), w = Math.ceil(b[2] * Z + pad * 2), h = Math.ceil(b[3] * Z + pad * 2);
    if (!OFF) OFF = document.createElement('canvas');
    if (OFF.width < Math.ceil(w * DPR) || OFF.height < Math.ceil(h * DPR)) { OFF.width = Math.ceil(w * DPR); OFF.height = Math.ceil(h * DPR); }
    const o = OFF.getContext('2d'); if (!o) { fn(e); return; }
    o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, OFF.width, OFF.height);
    ctx = o; ctx.setTransform(DPR * Z, 0, 0, DPR * Z, -(cam.x + x0) * DPR, -(cam.y + y0) * DPR);
    try { fn(e); } finally { ctx = mainCtx; }
    ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = a; ctx.drawImage(OFF, 0, 0, Math.ceil(w * DPR), Math.ceil(h * DPR), x0, y0, w, h); ctx.restore();
  }

  /* ---------- simulation ---------- */
  const faceOf = (dx: number, dy: number): Facing => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  /** Shoppers arrive through the corridor in the afternoon and leave again at night, following the visitor's clock. */
  function manageCrowd(want: number, announce: boolean) {
    let joined = 0;
    shoppers.forEach((sh, i) => {
      if (i < want && (!sh.active || sh.leaving)) {
        if (!sh.active) { const left = Math.random() < .5, from = left ? NODES[0] : NODES[1]; sh.x = from.x; sh.y = from.y; sh.path = []; sh.state = 'browse'; sh.timer = .2; sh.alpha = 0; joined++; }
        sh.active = true; sh.leaving = false;
      } else if (i >= want && sh.active && !sh.leaving) {
        sh.leaving = true; const exit = sh.x < WORLD_W / 2 ? NODES[0] : NODES[1]; sh.path = route({ x: sh.x, y: sh.y }, { x: exit.x, y: exit.y }); sh.state = 'walk';
      }
    });
    if (announce && joined >= 2) { cb.onToast('More visitors are joining the fair.'); cb.onSfx('crowd'); }
    cb.onCrowd(shoppers.filter(sh => sh.active && !sh.leaving).length);
  }
  function updateShoppers(dt: number) {
    for (const sh of shoppers) {
      sh.alpha += ((sh.active ? 1 : 0) - sh.alpha) * Math.min(1, dt * 3);
      if (!sh.active) continue;
      if (sh.leaving && sh.state === 'browse') { sh.active = false; sh.leaving = false; continue; }
      if (sh.state === 'walk') {
        const tgt = sh.path[0];
        if (!tgt) { sh.state = 'browse'; sh.timer = 2.4 + Math.random() * 2.6; sh.moving = false; sh.facing = 'up'; continue; }
        const dx = tgt.x - sh.x, dy = tgt.y - sh.y, d = Math.hypot(dx, dy), step = (reduce ? 40 : 72) * dt;
        if (d <= step) { sh.x = tgt.x; sh.y = tgt.y; sh.path.shift(); } else { sh.x += dx / d * step; sh.y += dy / d * step; }
        sh.moving = true; sh.facing = faceOf(dx, dy);
      } else {
        sh.moving = false; sh.timer -= dt;
        if (sh.timer <= 0) {
          const pool = stocked.length ? stocked.filter(s => s !== sh.stall) : [], s = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
          sh.stall = s;
          const to = s ? { x: s.fx + (Math.random() * 90 - 45), y: s.fy + Math.random() * 28 } : { x: 120 + Math.random() * 800, y: 300 + Math.random() * 90 };
          sh.path = route({ x: sh.x, y: sh.y }, to); sh.state = 'walk';
        }
      }
    }
  }
  function updateSprites(dt: number, now: number) {
    const k = 1 - Math.exp(-dt * 7);
    for (const [code, sp] of sprites) {
      if (now - sp.seen > 12_000) { sprites.delete(code); continue; }
      const dx = sp.tx - sp.x, dy = sp.ty - sp.y; sp.moving = Math.hypot(dx, dy) > 3; sp.x += dx * k; sp.y += dy * k;
    }
  }
  function updatePlayer(dt: number) {
    const kx = keys.r - keys.l, ky = keys.d - keys.u; let dx = 0, dy = 0;
    if (kx || ky) {
      player.path = []; player.arrive = null; const n = Math.hypot(kx, ky); dx = kx / n; dy = ky / n;
      const nx = player.x + dx * SPEED * dt, ny = player.y + dy * SPEED * dt;
      if (walkable({ x: nx, y: player.y })) player.x = nx; else dx = 0;
      if (walkable({ x: player.x, y: ny })) player.y = ny; else dy = 0;
    } else if (player.path.length) {
      const tgt = player.path[0], ex = tgt.x - player.x, ey = tgt.y - player.y, d = Math.hypot(ex, ey), step = SPEED * dt;
      if (d <= step) { player.x = tgt.x; player.y = tgt.y; player.path.shift(); if (!player.path.length) { player.facing = 'up'; const a = player.arrive; player.arrive = null; player.moving = false; if (a) a(); return; } }
      else { dx = ex / d; dy = ey / d; player.x += dx * step; player.y += dy * step; }
    }
    player.moving = !!(dx || dy);
    if (!player.moving && !(kx || ky) && !player.path.length) settleBesideMaker(dt);
    if (player.moving) { player.facing = faceOf(dx, dy); if (!moved) { moved = true; cb.onMoved(); } }
  }
  /** Stopping right in front of a maker would hide them, so when you stand still at a counter you step to the side and stay solid. */
  function settleBesideMaker(dt: number) {
    for (const s of slots) {
      if (!s.maker) continue;
      const dx = player.x - s.cx, dy = player.y - s.base;
      if (dy > 0 && dy < 100 && Math.abs(dx) < 62) {
        const goal = s.cx + (s.maker.mirror ? -1 : dx === 0 ? 1 : Math.sign(dx)) * 72, nx = player.x + Math.sign(goal - player.x) * Math.min(Math.abs(goal - player.x), 150 * dt);
        if (walkable({ x: nx, y: player.y })) player.x = nx;
        return;
      }
    }
  }
  const walkTo = (p: Pt, arrive?: () => void) => { player.path = route({ x: player.x, y: player.y }, clampWalk(p)); player.arrive = arrive ?? null; if (!moved) { moved = true; cb.onMoved(); } };

  /* ---------- frame ---------- */
  let nowT = 0, nowMs = 0, stepClock = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const t = now / 1000, dt = Math.min(.05, (now - (last || now)) / 1000); last = now; nowT = t; nowMs = now;
    if (clock.fixed === null && now - clock.at > 10_000) { clock.at = now; clock.hour = hourOf(new Date()); }
    sky = skyAt(clock.hour);
    const ph = phaseAt(clock.hour); if (ph !== phase) { phase = ph; cb.onPhase(ph); }
    const want = Math.min(MAX_CROWD, crowdAt(clock.hour)); if (want !== lastCrowd) { manageCrowd(want, lastCrowd >= 0); lastCrowd = want; }
    if (!paused) updatePlayer(dt);
    if (player.moving && !paused) { stepClock += dt; if (stepClock > .34) { stepClock = 0; cb.onSfx('step'); } } else stepClock = .26;
    updateShoppers(dt); updateSprites(dt, now);
    if (ptr.down && !press && badgePress < 0 && !paused && now - holdT > 110) { holdT = now; player.path = route({ x: player.x, y: player.y }, clampWalk(toWorld(ptr.x, ptr.y))); player.arrive = null; }
    const { nearSlot, nearest: nr, mirrorNear } = nearInfo();
    if (nr && nr.idx !== nearest) { nearest = nr.idx; cb.onNearest(nr.idx); }
    const fs = slots.find(s => Math.abs(player.x - s.cx) < 84 && player.y - s.base > 0 && player.y - s.base < 84) ?? null;
    if (fs) focusRef = fs;
    focusV += ((fs ? 1 : 0) - focusV) * Math.min(1, dt * (reduce ? 20 : 3.2)); if (focusV < .005 && !fs) { focusV = 0; focusRef = null; }
    // A close camera that eases after you, like a third-person game: you always see the area around you. Overview pulls back to the whole fair.
    zoomMix += ((overview ? 0 : 1) - zoomMix) * Math.min(1, dt * 5);
    const fit = S, follow = Math.max(S * 1.45, .9), base = fit + (follow - fit) * zoomMix;
    craftV += ((craft && focusRef === craft.slot ? 1 : 0) - craftV) * Math.min(1, dt * 3.5);   // while a maker works, move in on their counter
    Z = base * (1 + .5 * focusV) * (1 + 1.0 * craftV);
    const ahead = player.moving && !focusRef ? 34 * zoomMix : 0, vx = player.facing === 'left' ? -1 : player.facing === 'right' ? 1 : 0, vy = player.facing === 'up' ? -1 : player.facing === 'down' ? 1 : 0;
    const tx = (focusRef ? player.x + (focusRef.cx - player.x) * focusV : player.x) + vx * ahead, ty = (focusRef ? player.y + (focusRef.base - 100 + 56 * craftV - player.y) * focusV : player.y) + vy * ahead * .6;
    const k = snapCam ? 1 : Math.min(1, dt * 6); snapCam = false;
    camF.x += (tx - camF.x) * k; camF.y += (ty - camF.y) * k;
    cam.x = cameraAxis(camF.x * Z - W / 2, WORLD_W * Z, W); cam.y = cameraAxis(camF.y * Z - H / 2, WORLD_H * Z, H);
    const w = toWorld(ptr.x, ptr.y);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(DPR * Z, 0, 0, DPR * Z, -cam.x * DPR, -cam.y * DPR);
    drawGround(); drawDiyas(t);
    if (focusRef && focusV > .01) {
      const gx = focusRef.cx, gy = focusRef.base - 70, g = ctx.createRadialGradient(gx, gy, 120, gx, gy, 380);
      g.addColorStop(0, 'rgba(8,12,8,0)'); g.addColorStop(1, `rgba(8,12,8,${(.62 * focusV).toFixed(3)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
    const ents: Ent[] = [];
    slots.forEach(s => ents.push({ type: 'stall', slot: s, y: s.base, x: s.cx, box: [s.cx - 118 * SS, s.base - 290 * SS, 236 * SS, 296 * SS] }));
    shoppers.forEach(sh => { if (sh.alpha > .02) ents.push({ type: 'shopper', sh, y: sh.y, x: sh.x, box: [sh.x - 20, sh.y - 120, 40, 126] }); });
    sprites.forEach(sp => ents.push({ type: 'sprite', sp, y: sp.y, x: sp.x, box: [sp.x - 20, sp.y - 120, 40, 126] }));
    ents.push({ type: 'me', y: player.y, x: player.x, box: [player.x - 24, player.y - 126, 48, 134] });
    ents.sort((a, b) => a.y - b.y);
    hits = ents.filter(e => e.type === 'stall' || (e.type === 'shopper' && e.sh.alpha > .6));
    for (const s of slots) if (s.maker) hits.push({ type: 'maker', slot: s, x: s.cx, y: s.base, box: [s.cx - 30 * SS, s.base - 112 * SS, 66 * SS, 78 * SS] });
    if (MIRROR) hits.push({ type: 'mirror', x: MIRROR.x, y: MIRROR.y, box: [MIRROR.x - 22, MIRROR.y - 50, 44, 100] });
    hovered = null; if (ptr.inside && !paused) for (let i = hits.length - 1; i >= 0; i--) if (inBox(w, hits[i].box)) { hovered = hits[i]; break; }
    canvas.style.cursor = hovered ? 'pointer' : 'crosshair';
    for (const s of slots) {
      const working = craft?.slot === s, target = (nearSlot === s || (hovered && 'slot' in hovered && hovered.slot === s) || working) ? 1 : 0;
      s.att += (target - s.att) * Math.min(1, dt * 7); s.hov += ((((hovered && hovered.type === 'stall' && hovered.slot === s) || fs === s) ? 1 : 0) - s.hov) * Math.min(1, dt * 10);
      s.look = Math.max(-1, Math.min(1, (player.x - s.cx) / 180));
    }
    const draw = (e: Ent) => {
      ctx.save(); ctx.translate(e.x, e.y);
      if (e.type === 'stall') { ctx.scale(SS, SS); drawStallBody(e.slot); }
      else if (e.type === 'shopper') { ctx.scale(.95, .95); drawPerson(e.sh, t, Math.max(-1, Math.min(1, (w.x - e.x) / 200))); }
      else if (e.type === 'sprite') { ctx.scale(.95, .95); drawPerson(e.sp, t, Math.max(-1, Math.min(1, (w.x - e.x) / 200))); }
      else { ctx.scale(.98, .98); drawPerson(meWalker(), t, 0); }
      ctx.restore();
    };
    for (const e of ents) {
      let a = 1;
      if (focusRef && focusV > 0) { // only the stall you are at, you, and the customers around that stall stay bright
        const near = (x: number, y: number) => Math.abs(x - focusRef!.cx) < 130 && y > focusRef!.base - 10 && y < focusRef!.base + 150;
        const lit = e.type === 'me' || (e.type === 'stall' && e.slot === focusRef) || ((e.type === 'shopper' || e.type === 'sprite') && near(e.x, e.y));
        if (!lit) a = 1 - (e.type === 'stall' ? .8 : .72) * focusV;
      }
      if (e.type === 'shopper') a = Math.min(a, e.sh.alpha);
      if (a < .98) layerDraw(e, a, draw); else draw(e);
    }
    drawBunting(t);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sx = (x: number) => x * Z - cam.x, sy = (y: number) => y * Z - cam.y;
    drawAtmosphere(t, dt, sx, sy);
    shoppers.forEach(sh => { if (sh.alpha > .5 && sh.sayUntil > now) bubble(sx(sh.x), sy(sh.y - 124 * .95), sh.say, false); });
    sprites.forEach(sp => { pill(sx(sp.x), sy(sp.y - 128 * .95), sp.name, C.cream, C.ink, 10); if (sp.sayUntil > now) bubble(sx(sp.x), sy(sp.y - 146 * .95), sp.say, false); });
    pill(sx(player.x), sy(player.y - 128 * .98), `${me.name} · ${formatCode(meCode)}`, C.board, C.chalk);
    if (mySayUntil > now) bubble(sx(player.x), sy(player.y - 148 * .98), mySay, false);
    drawBadges(t, sx, sy, mirrorNear);
    drawMinimap();
    drawCraftCaption(now);
    if ((nearSlot || mirrorNear) && !paused && !craft) {
      const sl = nearSlot ?? mirrorSlot!, mouse = ptr.type === 'mouse';
      const txt = mirrorNear ? (mouse ? (nearSlot ? 'Enter to shop · M for the mirror' : 'Press M for the mirror') : 'Tap the stall or the mirror') : nearSlot!.open ? (mouse ? 'Open stall · press Enter' : 'Open stall · tap it') : mouse ? 'Enter to shop · click the maker to watch' : 'Tap the stall, or the maker';
      bubble(sx(sl.cx), sy(sl.base - 292 * SS), txt, true);
    }
  }

  /* ---------- selfie ---------- */
  function paintSelfie(cv: HTMLCanvasElement, poseName: SelfiePose) {
    // A mirror selfie: you, phone in hand, inside the stall mirror, with the fair behind you reflected (flipped) in the glass.
    const dpr = Math.min(2, window.devicePixelRatio || 1), Wc = 360, Hc = 450, photoH = 386, gx = 62, gw = 236, gy = 24, gh = 348;
    cv.width = Wc * dpr; cv.height = Hc * dpr;
    const c2 = cv.getContext('2d'); if (!c2) return;
    ctx = c2; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try {
      ctx.fillStyle = C.white; ctx.fillRect(0, 0, Wc, photoH);
      ctx.fillStyle = C.woodD; ctx.fillRect(0, 0, 14, photoH); ctx.fillRect(Wc - 14, 0, 14, photoH);
      ctx.fillStyle = C.wood; ctx.fillRect(14, 296, 48, 6); ctx.fillRect(Wc - 62, 296, 48, 6);
      ctx.fillStyle = C.green; ctx.fillRect(0, 0, Wc, 10); for (let x = 0, n = 0; x < Wc; x += 30, n++) { ctx.fillStyle = n % 2 ? C.mustard : C.orange; ctx.beginPath(); ctx.arc(x + 15, 10, 15, 0, Math.PI); ctx.fill(); }
      ctx.save(); arch(gx, gy + gh, gw, gh); ctx.clip();
      ctx.fillStyle = C.paper; ctx.fillRect(gx, gy, gw, gh);
      const k = .74, cxw = Math.max(gw / 2 / k, Math.min(WORLD_W - gw / 2 / k, player.x));
      ctx.save(); ctx.translate(gx + gw / 2, gy); ctx.scale(-k, k); ctx.translate(-cxw, -215);
      drawGround();
      const items: Array<{ y: number; f: () => void }> = [];
      slots.forEach(sl => { if (sl.row === 1) items.push({ y: sl.base, f: () => { ctx.save(); ctx.translate(sl.cx, sl.base); ctx.scale(SS, SS); drawStallBody({ ...sl, att: 0, hov: 0, look: 0 }); ctx.restore(); } }); });
      shoppers.forEach(sh => items.push({ y: sh.y, f: () => { ctx.save(); ctx.translate(sh.x, sh.y); ctx.scale(.95, .95); drawPerson(sh, 0, 0); ctx.restore(); } }));
      items.sort((a, b) => a.y - b.y).forEach(it => it.f());
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(gx, gy, gw, gh);
      ctx.save(); ctx.translate(gx + gw / 2 + 2, gy + gh + 36); ctx.scale(2.15, 2.15);
      drawPerson({ ...meWalker(), facing: 'down', moving: false, seed: 0, bag: false, phone: true, waveL: poseName === 'wave' }, 0, 0);
      ctx.restore();
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = .16; ctx.beginPath(); ctx.moveTo(gx + 30, gy); ctx.lineTo(gx + 62, gy); ctx.lineTo(gx - 20, gy + gh); ctx.lineTo(gx - 52, gy + gh); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      ctx.restore();
      arch(gx, gy + gh, gw, gh); ctx.lineWidth = 12; ctx.strokeStyle = C.woodD; ctx.stroke();
      arch(gx + 5, gy + gh, gw - 10, gh - 5); ctx.lineWidth = 2; ctx.strokeStyle = C.mustard; ctx.stroke();
      ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, photoH, Wc, Hc - photoH); ctx.fillStyle = '#e5ddd1'; ctx.fillRect(0, photoH, Wc, 1);
      const where = mirrorSlot?.maker?.name ?? 'the fair';
      ctx.fillStyle = '#252a24'; ctx.textAlign = 'center'; ctx.font = F(600, 15); ctx.fillText(`Mirror selfie at ${where}`, Wc / 2, photoH + 26);
      ctx.fillStyle = '#77796f'; ctx.font = F(500, 12); ctx.fillText(`${me.name} · ${formatCode(meCode)} · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, Wc / 2, photoH + 46);
    } finally { ctx = mainCtx; }
  }

  /* ---------- input ---------- */
  const typing = (el: EventTarget | null) => el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  const onKeyDown = (e: KeyboardEvent) => {
    if (paused || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const onGame = e.target === canvas || e.target === document.body, k = KEY[e.key];
    if (k && onGame) { e.preventDefault(); keys[k] = 1; ptr.down = false; }
    else if ((e.key === 'm' || e.key === 'M') && onGame) { if (nearInfo().mirrorNear) { e.preventDefault(); cb.onOpenMirror('menu'); } }
    else if ((e.key === 'Enter' || e.key === 'e' || e.key === 'E' || e.key === ' ') && onGame) { const { nearSlot } = nearInfo(); if (nearSlot) { e.preventDefault(); cb.onOpenStall(nearSlot); } }
  };
  const onKeyUp = (e: KeyboardEvent) => { const k = KEY[e.key]; if (k) keys[k] = 0; };
  const onBlur = () => { keys.l = keys.r = keys.u = keys.d = 0; ptr.down = false; };
  const setPtr = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.type = e.pointerType; ptr.inside = true; };
  const pick = (w: Pt): Ent | null => { for (let i = hits.length - 1; i >= 0; i--) if (inBox(w, hits[i].box)) return hits[i]; return null; };
  const startCraft = (s: Slot) => { if (!s.maker) return; craft = { slot: s, start: performance.now() }; cb.onEvent({ type: 'craft', makerId: s.maker.id }); cb.onCraft(s.maker.craft); };
  const endCraft = () => { if (craft) { craft = null; cb.onCraft(null); } };
  const mirrorAction = (view: 'menu' | 'selfie' | 'note') => { badgeSeen = true; if (!MIRROR) return; endCraft(); if (nearInfo().mirrorNear) cb.onOpenMirror(view); else walkTo({ x: MIRROR.x, y: mirrorSlot!.base + 34 }, () => { endCraft(); cb.onOpenMirror(view); }); };
  const onDown = (e: PointerEvent) => {
    canvas.focus({ preventScroll: true }); try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    setPtr(e); ptr.down = true; holdT = performance.now();
    if (paused) return;
    if (mini && ptr.x >= mini.x && ptr.x <= mini.x + mini.w && ptr.y >= mini.y && ptr.y <= mini.y + mini.h) {
      press = { type: 'me', x: 0, y: 0, box: [0, 0, 0, 0] }; walkTo({ x: (ptr.x - mini.x) / mini.k, y: (ptr.y - mini.y) / mini.k }); return;
    }
    badgePress = badgeAt(ptr.x, ptr.y);
    press = badgePress >= 0 ? { type: 'me', x: 0, y: 0, box: [0, 0, 0, 0] } : pick(toWorld(ptr.x, ptr.y));
    if (!press) { player.path = route({ x: player.x, y: player.y }, clampWalk(toWorld(ptr.x, ptr.y))); player.arrive = null; if (!moved) { moved = true; cb.onMoved(); } }
  };
  const onUp = (e: PointerEvent) => {
    setPtr(e); const was = press; ptr.down = false; press = null;
    if (badgePress >= 0) { const b = badgeAt(ptr.x, ptr.y); const hit = badges[badgePress]; if (b === badgePress && hit) mirrorAction((['selfie', 'note', 'menu'] as const)[hit.i]); badgePress = -1; }
    else if (was && inBox(toWorld(ptr.x, ptr.y), was.box)) activate(was);
    if (e.pointerType !== 'mouse') ptr.inside = false;
  };
  function activate(e: Ent) {
    endCraft();
    if (e.type === 'mirror') mirrorAction('menu');
    else if (e.type === 'maker') { const s = e.slot; if (nearInfo().nearSlot === s) startCraft(s); else walkTo({ x: s.fx, y: s.fy }, () => startCraft(s)); }
    else if (e.type === 'stall') { const s = e.slot; if (nearInfo().nearSlot === s) cb.onOpenStall(s); else walkTo({ x: s.fx, y: s.fy }, () => cb.onOpenStall(s)); }
    else if (e.type === 'shopper' && stocked.length) {
      const sh = e.sh, s = stocked[Math.floor(Math.random() * stocked.length)], m = s.maker!, it = m.items[Math.floor(Math.random() * m.items.length)];
      sh.say = `Try the ${it.name.toLowerCase()}`; sh.sayUntil = performance.now() + 3200; cb.onToast(`${sh.name} says: ${it.name} at ${m.name} is worth a look.`); walkTo({ x: s.fx, y: s.fy });
    }
  }
  const onLeave = () => { if (!ptr.down) ptr.inside = false; };
  const onCancel = () => { ptr.down = false; press = null; badgePress = -1; };
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', setPtr); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onCancel); canvas.addEventListener('pointerleave', onLeave);
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur);

  function resize() {
    const box = canvas.parentElement ?? canvas; W = Math.max(300, box.clientWidth); DPR = Math.min(2, window.devicePixelRatio || 1);
    if (fill && box.clientHeight > 200) { H = Math.round(box.clientHeight); S = Math.max(Math.min(W / WORLD_W, H / WORLD_H), .45); }   // full screen: the whole stage
    else { S = Math.max(W / WORLD_W, .62); H = Math.round(Math.min(WORLD_H * S, 640)); }
    canvas.width = W * DPR; canvas.height = H * DPR; canvas.style.height = H + 'px';
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas.parentElement ?? canvas); resize();
  raf = requestAnimationFrame(frame);

  const setIdentity = (code: string, look: LookId | null = null) => {
    meCode = code; me = characterFor(code, look); const keep = player.seed;
    Object.assign(player, { x: START.x, y: START.y, facing: 'up' as Facing, path: [], arrive: null, moving: false, seed: hash32(code) % 100 || keep });
    endCraft(); snapCam = true;
  };
  return {
    slots,
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); mq.removeEventListener('change', refreshTheme); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', setPtr); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onCancel); canvas.removeEventListener('pointerleave', onLeave); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); },
    setIdentity,
    setLook(look) { me = characterFor(meCode, look); },
    setOverview(on) { overview = on; },
    setFill(on) { fill = on; resize(); },
    setState(s) { st = { ...st, ...s }; },
    setMet(ids) { metIds = new Set(ids); },
    setVisitors(list) {
      const now = performance.now(), seen = new Set<string>();
      for (const v of list) {
        if (v.code === meCode) continue; seen.add(v.code);
        let sp = sprites.get(v.code);
        const lookId = isLookId(v.look) ? v.look : null;
        if (!sp || sp.lookId !== lookId) {
          const ch = characterFor(v.code, lookId), base = { name: ch.name, lookId, seed: hash32(v.code) % 100, top: ch.top, skinHex: ch.skin, pants: ch.pants, hairStyle: ch.hairStyle, headwear: ch.headwear, beard: ch.beard, bindi: ch.bindi, bag: ch.bag, acc: ch.acc };
          if (sp) Object.assign(sp, base);
          else { cb.onSfx('join'); sp = { code: v.code, x: v.x, y: v.y, tx: v.x, ty: v.y, facing: v.facing, moving: false, seq: v.emoteSeq, say: '', sayUntil: 0, seen: now, ...base }; sprites.set(v.code, sp); }
        }
        sp.tx = v.x; sp.ty = v.y; sp.facing = v.facing; sp.seen = now;
        if (v.emoteSeq > sp.seq && v.emote) { sp.say = SAY[v.emote]; sp.sayUntil = now + 3200; cb.onSfx('emote'); }
        sp.seq = v.emoteSeq;
      }
      for (const code of [...sprites.keys()]) if (!seen.has(code)) sprites.delete(code);
    },
    setPaused(p) { paused = p; if (p) { keys.l = keys.r = keys.u = keys.d = 0; ptr.down = false; } },
    walkToSlot(idx, arrive) { const s = slots[idx]; if (s) walkTo({ x: s.fx, y: s.fy }, arrive); },
    watchCraft(idx) { const s = slots[idx]; if (!s?.maker) return; if (nearInfo().nearSlot === s) startCraft(s); else walkTo({ x: s.fx, y: s.fy }, () => startCraft(s)); },
    emote(e) { mySay = SAY[e]; mySayUntil = performance.now() + 3200; cb.onEvent({ type: 'emote' }); },
    pose: () => ({ x: player.x, y: player.y, facing: player.facing }),
    paintSelfie,
  };
}
