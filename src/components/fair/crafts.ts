import type { CraftKind } from '@/lib/fair-types';
import type { Colors } from './theme';

/** How long a "watch them work" moment lasts, in seconds. */
export const CRAFT_SECONDS = 10;
export const CRAFT_LABEL: Record<CraftKind, string> = {
  crochet: 'Crocheting a lotus', pottery: 'Shaping a pot on the wheel', resin: 'Pouring a resin coaster',
  jewellery: 'Threading beads', print: 'Block-printing cloth', wood: 'Carving a wooden elephant', christmas: 'Hanging the ornaments', handmade: 'Tying a gift by hand',
};

const TAU = Math.PI * 2;
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
const OUTLINE = 'rgba(52,28,14,.22)';

/** How far each finger is curled: index, middle, ring, little, thumb (0 straight, 1 fully curled). */
export type Curl = [number, number, number, number, number];
export const PINCH: Curl = [.55, .5, .55, .65, .6], GRIP: Curl = [.62, .68, .72, .74, .5], FLAT: Curl = [.12, .12, .18, .24, .2], HOLD: Curl = [.4, .45, .5, .55, .35];

/** Where a hand ends up while it works: the wrist spot on the counter, which way the fingers point, and how they are curled. */
export type HandPose = { x: number; y: number; ang: number; curl: Curl; mirror?: boolean };
/** What a craft puts on the counter and where the maker's two hands go. Positions are in the stall's own units: x across the counter, y up from the ground. */
export type Job = { left: HandPose; right: HandPose };

/**
 * A hand seen from the front, pointing along +x from (x, y) and turned by `rot`. Fingers bend at the knuckle by `curl`; `mirror` swaps the thumb side.
 * With `sleeve` set, the forearm and sleeve are drawn too (used where the arm is not drawn separately).
 */
export function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, skin: string, bangle: string, curl: Curl, mirror = false, scale = 1, sleeve?: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, mirror ? -scale : scale); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (sleeve) {
    ctx.fillStyle = skin; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(-52, -9, 50, 18, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = sleeve; ctx.beginPath(); ctx.roundRect(-120, -12.5, 74, 25, 8); ctx.fill();
  }
  ctx.strokeStyle = bangle; ctx.lineWidth = 2.6; for (const bx of [-6, -11.5]) { ctx.beginPath(); ctx.ellipse(bx, 0, 3.2, 9.6, 0, 0, TAU); ctx.stroke(); }
  const fy = [-8, -2.7, 2.7, 7.8], l1 = [13, 15, 14, 10.5], l2 = [11, 12.5, 11.5, 8.8];
  const finger = (bx: number, by: number, a1: number, a2: number, len1: number, len2: number, w: number, col: string) => {
    const mx = bx + Math.cos(a1) * len1, my = by + Math.sin(a1) * len1;
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(mx, my); ctx.lineTo(mx + Math.cos(a2) * len2, my + Math.sin(a2) * len2); ctx.stroke();
  };
  const fingers = (w: number, col: string) => {
    fy.forEach((by, i) => { const a1 = curl[i] * .8, a2 = a1 + curl[i] * .95; finger(14, by, a1, a2, l1[i], l2[i], w, col); });
    const t = curl[4]; finger(3, -10.5, -.75 + t * 1.0, -.75 + t * 1.7, 11, 9, w, col);
  };
  fingers(6.6, OUTLINE);
  ctx.fillStyle = skin; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(-8, -11, 25, 22, 8); ctx.fill(); ctx.stroke();
  fingers(5.4, skin);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(6, -4, 6, 3.2, -.2, 0, TAU); ctx.fill();
  ctx.restore();
}

/**
 * Puts one craft on the counter and returns where the maker's hands should be. `p` is how far through the 10 seconds we are (0 to 1) and `t` is a
 * clock in seconds for the repeating motions. The counter top is at y = -44; everything sits in front of the maker, between x = -70 and x = 70.
 * The maker's own arms and hands are drawn by the caller, on top of what is drawn here.
 */
export function drawCounterCraft(ctx: CanvasRenderingContext2D, kind: CraftKind, p: number, t: number, c: Colors, reduced = false): Job {
  const wob = reduced ? 0 : 1, top = -44;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let job: Job;
  if (kind === 'crochet') {
    const n = Math.floor(p * 18) + 1, per = 9, x0 = -22, step = 7.2;
    dot(ctx, -48, top - 8, 9, c.sage); ctx.strokeStyle = c.chalk; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-48, top - 8, 5.5, .3, 4.4); ctx.stroke(); ctx.beginPath(); ctx.arc(-48, top - 8, 2.8, 1, 5); ctx.stroke();
    ctx.strokeStyle = c.orange; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-42, top - 4); ctx.quadraticCurveTo(-34, top + 2, x0 - 4, top - 5); ctx.stroke();
    let lx = x0, ly = top - 5;
    for (let i = 0; i < n; i++) { const r = Math.floor(i / per), cl = i % per; lx = x0 + cl * step; ly = top - 5 - r * 8; ctx.strokeStyle = r ? c.mustard : c.orange; ctx.lineWidth = 1.9; ctx.beginPath(); ctx.ellipse(lx, ly, 4.2, 3, 0, 0, TAU); ctx.stroke(); }
    const jig = Math.sin(t * 9) * 2.2 * wob;
    ctx.strokeStyle = c.woodD; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(lx + 2, ly - 2 + jig * .3); ctx.lineTo(lx + 22, ly - 16 + jig); ctx.stroke();
    job = { left: { x: x0 + 18, y: top - 18, ang: 2.1, curl: PINCH, mirror: true }, right: { x: lx + 22 + jig * .2, y: ly - 18 + jig, ang: 2.5, curl: PINCH } };
    if (p > .9) { const s = ease((p - .9) / .1); ctx.save(); ctx.translate(48, top - 12); ctx.scale(s, s); for (let i = 0; i < 5; i++) dot(ctx, Math.cos(i * TAU / 5 - 1.57) * 6, Math.sin(i * TAU / 5 - 1.57) * 6, 4.6, '#e58aa6'); dot(ctx, 0, 0, 3.4, c.mustard); ctx.restore(); }
  } else if (kind === 'pottery') {
    const e = ease(p / .75), Hh = 8 + 40 * e;
    const prof = (y: number) => 9 + 9 * Math.sin(Math.PI * Math.min(1, y * 1.08)) * (.55 + .45 * e) - (y > .62 ? (y - .62) * 26 * e : 0);
    ctx.fillStyle = c.woodD; ctx.beginPath(); ctx.ellipse(0, top - 1, 36, 6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = c.wood; ctx.fillRect(-36, top - 6, 72, 6); ctx.beginPath(); ctx.ellipse(0, top - 6, 36, 6, 0, 0, TAU); ctx.fill();
    dot(ctx, Math.cos(t * 7 * wob) * 30, top - 6 + Math.sin(t * 7 * wob) * 4, 1.6, c.chalk);
    ctx.fillStyle = c.orange; ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const y = i / 24; ctx.lineTo(-prof(y), top - 6 - Hh * y); }
    for (let i = 24; i >= 0; i--) { const y = i / 24; ctx.lineTo(prof(y), top - 6 - Hh * y); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = c.terraD; ctx.lineWidth = .9; ctx.globalAlpha = .5;
    for (let k = 0; k < 6; k++) { const y = ((k / 6) + ((t * .5 * wob) % 1) / 6) % 1; ctx.beginPath(); ctx.ellipse(0, top - 6 - Hh * y, prof(y), 2.2, 0, 0, Math.PI); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (p > .8) { const g = ease((p - .8) / .2); ctx.fillStyle = c.mustard; ctx.globalAlpha = g; ctx.fillRect(-prof(.9) - .5, top - 6 - Hh * .93, prof(.9) * 2 + 1, 3); ctx.fillStyle = c.indigo; ctx.fillRect(-prof(.3), top - 6 - Hh * .34, prof(.3) * 2, 2.4); ctx.globalAlpha = 1; }
    const press = Math.sin(t * 3) * 1.6 * wob, hy = top - 6 - Hh * .45, r = prof(.45);
    job = { left: { x: -r - 14 + press, y: hy, ang: .02, curl: GRIP }, right: { x: r + 14 - press, y: hy, ang: Math.PI - .02, curl: GRIP, mirror: true } };
  } else if (kind === 'resin') {
    const level = ease(p / .9);
    ctx.fillStyle = c.chalk; ctx.beginPath(); ctx.ellipse(0, top - 4, 25, 8, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = c.woodD; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, top - 4, 22, 6.2, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = c.indigo; ctx.fillRect(-22, top - 4 + 6.2 - 12.4 * level, 44, 12.4 * level + 1);
    const cols = ['#4fb6b8', c.mustard, c.chalk, '#e58aa6'];
    for (let k = 0; k < 4; k++) { ctx.strokeStyle = cols[k]; ctx.globalAlpha = .85 * level; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(Math.sin(t * .6 * wob + k) * 3, top - 4, 5 + k * 4, 2 + k, 0, k, k + 2.4); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.restore();
    if (p > .92) { ctx.strokeStyle = '#fff'; ctx.globalAlpha = .6; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, top - 4, 16, 4, 0, 3.6, 4.7); ctx.stroke(); ctx.globalAlpha = 1; }
    const pouring = p < .92;
    if (pouring) {
      ctx.save(); ctx.translate(26, top - 40); ctx.rotate(-.9 - Math.sin(t * 2) * .03 * wob); ctx.fillStyle = c.chalk; ctx.strokeStyle = c.woodD; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.roundRect(-8, -10, 17, 22, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#4fb6b8'; ctx.fillRect(-6, -3, 13, 13); ctx.restore();
      ctx.strokeStyle = '#4fb6b8'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(14, top - 28); ctx.quadraticCurveTo(10 + Math.sin(t * 6) * wob, top - 16, 2, top - 6); ctx.stroke();
    }
    job = { left: { x: -34, y: top - 12, ang: .15, curl: FLAT, mirror: true }, right: { x: pouring ? 38 : 40, y: pouring ? top - 36 : top - 14, ang: Math.PI + .35, curl: GRIP, mirror: true } };
  } else if (kind === 'jewellery') {
    const N = 11, sx = (i: number) => -36 + i * 7.2, sy = (i: number) => top - 12 + 6 * Math.sin(Math.PI * (i + .5) / N);
    ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-46, top - 14); for (let i = 0; i <= N; i++) ctx.lineTo(sx(i - .5), sy(i - .5)); ctx.lineTo(46, top - 14); ctx.stroke();
    const done = Math.min(N, Math.floor(p * (N + 1))), cols = ['#4fb6b8', '#e58aa6', c.mustard, '#3f6b3a', c.indigo];
    for (let i = 0; i < done; i++) { dot(ctx, sx(i), sy(i), 3.6, cols[i % cols.length]); dot(ctx, sx(i) - 1, sy(i) - 1, 1, 'rgba(255,255,255,.7)'); }
    let rx = 46, ry = top - 34;
    if (done < N) { const f = ease((p * (N + 1)) % 1), bx = sx(done) + 20 * (1 - f), by = sy(done) - 18 * (1 - f); dot(ctx, bx, by, 3.6, cols[done % cols.length]); dot(ctx, bx - 1, by - 1, 1, 'rgba(255,255,255,.7)'); rx = bx + 6; ry = by - 8; }
    if (p > .88) { const g = ease((p - .88) / .12), x = sx(5), y = sy(5); ctx.save(); ctx.translate(x, y + 3); ctx.scale(g, g); ctx.fillStyle = c.mustard; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.quadraticCurveTo(0, 16, 9, 0); ctx.quadraticCurveTo(0, 8, -9, 0); ctx.fill(); dot(ctx, 0, 2, 2.2, '#b3262e'); ctx.restore(); }
    job = { left: { x: -52, y: top - 14, ang: .1, curl: PINCH, mirror: true }, right: { x: rx, y: ry, ang: 2.4, curl: PINCH } };
  } else if (kind === 'print') {
    ctx.fillStyle = c.chalk; ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-58, top); ctx.lineTo(-50, top - 16); ctx.lineTo(50, top - 16); ctx.lineTo(58, top); ctx.closePath(); ctx.fill(); ctx.stroke();
    const cols = 5, total = cols * 2, n = Math.min(total, Math.floor(p * (total + 1)));
    const at = (i: number) => ({ x: -36 + (i % cols) * 18, y: top - 5 - Math.floor(i / cols) * 7 });
    for (let i = 0; i < n; i++) { const q = at(i), col = i % 2 ? c.indigo : c.orange; for (let k = 0; k < 4; k++) dot(ctx, q.x + Math.cos(k * TAU / 4) * 2.8, q.y + Math.sin(k * TAU / 4) * 2.2, 2, col); dot(ctx, q.x, q.y, 1.2, c.chalk); }
    let rx = 40, ry = top - 34;
    if (n < total) { const q = at(n), press = (Math.sin(t * 5) + 1) / 2, lift = press * 9 * wob; ctx.fillStyle = c.wood; ctx.beginPath(); ctx.roundRect(q.x - 7, q.y - 9 - lift, 14, 11, 2); ctx.fill(); ctx.strokeStyle = c.woodD; ctx.lineWidth = .8; ctx.stroke(); rx = q.x + 8; ry = q.y - 22 - lift; }
    job = { left: { x: -62, y: top - 16, ang: .5, curl: HOLD, mirror: true }, right: { x: rx, y: ry, ang: 2.0, curl: FLAT } };
  } else if (kind === 'wood') {
    const x0 = -34, x1 = 30, y0 = top - 36, y1 = top, reveal = x0 + (x1 - x0) * ease(p / .92);
    ctx.fillStyle = c.wood; ctx.beginPath(); ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 3); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0 - 4, reveal - x0, y1 - y0 + 8); ctx.clip();
    ctx.fillStyle = c.cream; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = c.woodD; ctx.beginPath(); ctx.ellipse(x0 + 38, top - 14, 24, 13, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x0 + 12, top - 20, 10, 0, TAU); ctx.fill();
    ctx.lineWidth = 4.4; ctx.strokeStyle = c.woodD; ctx.beginPath(); ctx.moveTo(x0 + 4, top - 18); ctx.quadraticCurveTo(x0 - 2, top - 6, x0 + 4, top - 2); ctx.stroke();
    ctx.fillRect(x0 + 24, top - 8, 6, 8); ctx.fillRect(x0 + 48, top - 8, 6, 8);
    ctx.restore();
    const tipx = Math.min(reveal + 2, x1 - 2), tipy = top - 16;
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(tipx, tipy); ctx.lineTo(tipx - 16, tipy - 16); ctx.stroke();
    const swing = (Math.sin(t * 13 * wob) + 1) / 2;
    ctx.save(); ctx.translate(tipx - 14, tipy - 22 - swing * 8); ctx.rotate(.3 - swing * .5); ctx.fillStyle = c.woodD; ctx.beginPath(); ctx.roundRect(-5, -5, 11, 8, 2); ctx.fill(); ctx.strokeStyle = c.woodD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(22, 5); ctx.stroke(); ctx.restore();
    if (p < .94) for (let i = 0; i < 4; i++) { const a = (t * 3 + i * .7) % 1; ctx.save(); ctx.globalAlpha = 1 - a; ctx.translate(tipx + 2 + a * 12 + i * 2, tipy - a * 12 + a * a * 22); ctx.rotate(a * 6 + i); ctx.fillStyle = c.wood; ctx.fillRect(-1.4, -.9, 2.8, 1.8); ctx.restore(); }
    job = { left: { x: tipx - 18, y: tipy - 18, ang: .78, curl: PINCH, mirror: true }, right: { x: tipx + 12, y: tipy - 26 - swing * 8, ang: Math.PI - .15, curl: GRIP, mirror: true } };
  } else if (kind === 'christmas') {
    const cx = -4, n = Math.floor(p * 9);
    ctx.fillStyle = '#3f6b3a'; [[-92, 24, 22], [-78, 20, 18], [-64, 15, 14]].forEach(([tp, half, hh]) => { ctx.beginPath(); ctx.moveTo(cx, tp); ctx.lineTo(cx - half, tp + hh + 8); ctx.lineTo(cx + half, tp + hh + 8); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = c.woodD; ctx.fillRect(cx - 3, top - 6, 6, 6);
    const spots: Array<[number, number, string]> = [[-7, -84, '#b3262e'], [8, -74, c.mustard], [-12, -68, '#4fb6b8'], [4, -62, '#b3262e'], [14, -56, c.mustard], [-6, -54, '#e58aa6'], [10, -49, '#4fb6b8'], [-16, -50, c.mustard], [0, -72, '#e58aa6']];
    spots.slice(0, n).forEach(([dx, y, col]) => { dot(ctx, cx + dx, y, 2.8, col); dot(ctx, cx + dx - .8, y - .8, .8, 'rgba(255,255,255,.7)'); });
    let rx = 42, ry = -80;
    if (n < 9) { const f = ease((p * 9) % 1), [dx, y, col] = spots[n], ox = cx + dx + 30 * (1 - f), oy = y - 16 * (1 - f); dot(ctx, ox, oy, 2.8, col); rx = ox + 6; ry = oy - 6; }
    else { const g = ease((p - .9) / .1); ctx.save(); ctx.translate(cx, -96); ctx.scale(g, g); ctx.fillStyle = '#e8b02e'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.4 : 6, a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); }
    job = { left: { x: cx - 26, y: top - 14, ang: -.6, curl: HOLD, mirror: true }, right: { x: rx, y: ry, ang: 2.6, curl: PINCH } };
  } else {
    const f = ease(p), cx = 0;
    ctx.fillStyle = c.orange; ctx.beginPath(); ctx.roundRect(cx - 22, top - 24, 44, 24, 2); ctx.fill(); ctx.fillStyle = c.terraD; ctx.beginPath(); ctx.roundRect(cx - 25, top - 31, 50, 9, 2); ctx.fill();
    ctx.strokeStyle = c.chalk; ctx.lineWidth = 3.4 * f; ctx.beginPath(); ctx.moveTo(cx, top - 31); ctx.lineTo(cx, top); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, top - 31); ctx.quadraticCurveTo(cx - 16 * f, top - 46, cx - 7 * f, top - 33); ctx.moveTo(cx, top - 31); ctx.quadraticCurveTo(cx + 16 * f, top - 46, cx + 7 * f, top - 33); ctx.stroke();
    job = { left: { x: cx - 28, y: top - 14, ang: -.2, curl: HOLD, mirror: true }, right: { x: cx + 10 + Math.sin(t * 4) * 2 * wob, y: top - 40, ang: 2.4, curl: PINCH } };
  }
  ctx.restore();
  return job;
}
