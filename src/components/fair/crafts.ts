import type { CraftKind } from '@/lib/fair-types';
import type { Colors } from './theme';

/** How long a "watch them work" moment lasts, in seconds. */
export const CRAFT_SECONDS = 10;
export const CRAFT_LABEL: Record<CraftKind, string> = {
  crochet: 'Crocheting a lotus', pottery: 'Shaping a pot on the wheel', resin: 'Pouring a resin coaster',
  jewellery: 'Threading beads', print: 'Block-printing cloth', wood: 'Carving a wooden elephant', christmas: 'Hanging the ornaments', handmade: 'Tying a gift by hand',
};
/** Size of the picture each craft is drawn in. */
export const CRAFT_BOX = { w: 240, h: 132 } as const;
/** Whose hands: the seller's own skin tone, sleeve and bangles, so it is clearly them at work. */
export type Hands = { skin: string; sleeve: string; bangle: string };

const TAU = Math.PI * 2;
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
const OUTLINE = 'rgba(52,28,14,.2)';

/** How far each finger is curled: index, middle, ring, little, thumb (0 straight, 1 fully curled). */
type Curl = [number, number, number, number, number];
const PINCH: Curl = [.55, .5, .55, .65, .6], GRIP: Curl = [.62, .68, .72, .74, .5], FLAT: Curl = [.12, .12, .18, .24, .2], HOLD: Curl = [.4, .45, .5, .55, .35];

/**
 * A hand and forearm seen from above, pointing along +x from (x, y) and turned by `rot`. Fingers bend at the knuckle by `curl`; `mirror` swaps
 * which side the thumb is on (left hand or right hand). The sleeve covers the forearm and the bangles sit at the wrist.
 */
function hand(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, h: Hands, curl: Curl, mirror = false, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, mirror ? -scale : scale); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.fillStyle = h.skin; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(-52, -9, 50, 18, 7); ctx.fill(); ctx.stroke();                                     // forearm
  ctx.fillStyle = h.sleeve; ctx.beginPath(); ctx.roundRect(-120, -12.5, 74, 25, 8); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke(); // sleeve
  ctx.strokeStyle = h.bangle; ctx.lineWidth = 2.6; for (const bx of [-6, -11.5]) { ctx.beginPath(); ctx.ellipse(bx, 0, 3.2, 9.6, 0, 0, TAU); ctx.stroke(); }   // bangles
  const fy = [-8, -2.7, 2.7, 7.8], l1 = [13, 15, 14, 10.5], l2 = [11, 12.5, 11.5, 8.8];
  const finger = (bx: number, by: number, a1: number, a2: number, len1: number, len2: number, w: number, col: string) => {
    const mx = bx + Math.cos(a1) * len1, my = by + Math.sin(a1) * len1;
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(mx, my); ctx.lineTo(mx + Math.cos(a2) * len2, my + Math.sin(a2) * len2); ctx.stroke();
  };
  const fingers = (w: number, col: string) => {
    fy.forEach((by, i) => { const a1 = curl[i] * .8, a2 = a1 + curl[i] * .95; finger(14, by, a1, a2, l1[i], l2[i], w, col); });
    const t = curl[4]; finger(3, -10.5, -.75 + t * 1.0, -.75 + t * 1.7, 11, 9, w, col);                             // thumb
  };
  fingers(6.6, OUTLINE);
  ctx.fillStyle = h.skin; ctx.strokeStyle = OUTLINE; ctx.beginPath(); ctx.roundRect(-8, -11, 25, 22, 8); ctx.fill(); ctx.stroke();    // palm
  fingers(5.4, h.skin);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(6, -4, 6, 3.2, -.2, 0, TAU); ctx.fill();                      // light on the back of the hand
  ctx.restore();
}
/** A hand that reaches a given point: the fingers end near (tx, ty), coming from the direction `from` (an angle). */
const reach = (ctx: CanvasRenderingContext2D, tx: number, ty: number, ang: number, h: Hands, curl: Curl, mirror = false, back = 38) =>
  hand(ctx, tx - Math.cos(ang) * back, ty - Math.sin(ang) * back, ang, h, curl, mirror);

/**
 * Draws one frame of a craft as the seller's hands at work. `p` is how far through the 10 seconds we are (0 to 1) and `t` is a clock in seconds
 * for the repeating motions. Everything is drawn inside CRAFT_BOX with its top-left at the origin.
 */
export function drawCraft(ctx: CanvasRenderingContext2D, kind: CraftKind, p: number, t: number, c: Colors, reduced = false, hands: Hands = { skin: c.skin, sleeve: c.orange, bangle: c.mustard }): void {
  const { w, h } = CRAFT_BOX, wob = reduced ? 0 : 1, H = hands;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // a soft table under every craft
  ctx.fillStyle = c.cream; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(0, h - 14, w, 14);
  if (kind === 'crochet') {
    const n = Math.floor(p * 20) + 1, per = 9, base = 92, x0 = 86, step = 12;
    dot(ctx, 36, 102, 19, c.sage); ctx.strokeStyle = c.chalk; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(36, 102, 11, .3, 4.4); ctx.stroke(); ctx.beginPath(); ctx.arc(36, 102, 5.5, 1, 5); ctx.stroke();
    ctx.strokeStyle = c.orange; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(52, 94); ctx.quadraticCurveTo(66, 112, x0 - 6, base + 2); ctx.stroke();
    let lx = x0, ly = base;
    for (let i = 0; i < n; i++) { const r = Math.floor(i / per), cl = i % per; lx = x0 + cl * step; ly = base - r * 13; ctx.strokeStyle = r ? c.mustard : c.orange; ctx.lineWidth = 2.8; ctx.beginPath(); ctx.ellipse(lx, ly, 6.4, 4.6, 0, 0, TAU); ctx.stroke(); }
    hand(ctx, 52, 62, .5, H, PINCH, true);                                                  // left hand steadies the work and feeds the yarn
    const jig = Math.sin(t * 9) * 3 * wob, ang = 2.55 + Math.sin(t * 9) * .06 * wob;
    ctx.strokeStyle = c.woodD; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(lx + 3 + jig * .4, ly - 3); ctx.lineTo(lx + 3 - Math.cos(ang) * 44, ly - 3 - Math.sin(ang) * 44); ctx.stroke();
    dot(ctx, lx + 3 + jig * .4, ly - 3, 2.2, c.woodD);
    reach(ctx, lx - Math.cos(ang) * 12, ly - 6 - Math.sin(ang) * 12, ang, H, PINCH, false, 40);   // right hand holds the hook
    if (p > .9) { const s = ease((p - .9) / .1); ctx.save(); ctx.translate(205, 100); ctx.scale(s, s); for (let i = 0; i < 5; i++) dot(ctx, Math.cos(i * TAU / 5 - 1.57) * 9, Math.sin(i * TAU / 5 - 1.57) * 9, 7, '#e58aa6'); dot(ctx, 0, 0, 5, c.mustard); ctx.restore(); }
  } else if (kind === 'pottery') {
    const cx = w / 2, base = 106, e = ease(p / .75), Hh = 14 + 58 * e;
    const prof = (y: number) => 17 + 16 * Math.sin(Math.PI * Math.min(1, y * 1.08)) * (.55 + .45 * e) - (y > .62 ? (y - .62) * 42 * e : 0);
    ctx.fillStyle = c.woodD; ctx.beginPath(); ctx.ellipse(cx, base + 8, 70, 11, 0, 0, TAU); ctx.fill(); ctx.fillStyle = c.wood; ctx.fillRect(cx - 70, base - 2, 140, 9); ctx.beginPath(); ctx.ellipse(cx, base - 2, 70, 11, 0, 0, TAU); ctx.fill();
    dot(ctx, cx + Math.cos(t * 7 * wob) * 56, base - 2 + Math.sin(t * 7 * wob) * 8, 2.6, c.chalk);
    ctx.fillStyle = c.orange; ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const y = i / 24; ctx.lineTo(cx - prof(y), base - Hh * y); }
    for (let i = 24; i >= 0; i--) { const y = i / 24; ctx.lineTo(cx + prof(y), base - Hh * y); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = c.terraD; ctx.lineWidth = 1.4; ctx.globalAlpha = .5;
    for (let k = 0; k < 7; k++) { const y = ((k / 7) + ((t * .5 * wob) % 1) / 7) % 1; ctx.beginPath(); ctx.ellipse(cx, base - Hh * y, prof(y), 3.4, 0, 0, Math.PI); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const press = Math.sin(t * 3) * 2.5 * wob, hy = base - Hh * .42, r = prof(.42);
    reach(ctx, cx - r + 4 + press, hy, .02, H, GRIP, false, 40);                                  // both hands cup the clay as it turns
    reach(ctx, cx + r - 4 - press, hy + 2, Math.PI - .02, H, GRIP, true, 40);
    if (p > .8) { const g = ease((p - .8) / .2); ctx.fillStyle = c.mustard; ctx.globalAlpha = g; ctx.fillRect(cx - prof(.9) - 1, base - Hh * .93, prof(.9) * 2 + 2, 4.5); ctx.fillStyle = c.indigo; ctx.fillRect(cx - prof(.3), base - Hh * .34, prof(.3) * 2, 3.4); ctx.globalAlpha = 1; }
  } else if (kind === 'resin') {
    const cx = 108, cy = 92, R = 31, level = ease(p / .9);
    ctx.fillStyle = c.chalk; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, TAU); ctx.fill(); ctx.strokeStyle = c.woodD; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.fillStyle = c.indigo; ctx.fillRect(cx - R, cy + R - 2 * R * level, 2 * R, 2 * R * level + 2);
    ctx.translate(cx, cy); ctx.rotate(t * .5 * wob + p * 3);
    const cols = ['#4fb6b8', c.mustard, c.chalk, '#e58aa6'];
    for (let k = 0; k < 4; k++) { ctx.strokeStyle = cols[k]; ctx.globalAlpha = .85 * level; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 6 + k * 7, k, k + 2.4); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.restore();
    if (p > .5) for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 6 + (i * 5) % 24; dot(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.4, '#e8b02e'); }
    if (p > .92) { ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = .55; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R - 6, 3.6, 4.7); ctx.stroke(); ctx.globalAlpha = 1; }
    reach(ctx, 70, cy + 4, -.12, H, FLAT, false, 42);                                              // the left hand steadies the mold
    if (p < .92) {
      const tilt = -.95 - Math.sin(t * 2) * .03 * wob;
      ctx.save(); ctx.translate(176, 34); ctx.rotate(tilt); ctx.fillStyle = c.chalk; ctx.strokeStyle = c.woodD; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-12, -16, 26, 34, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#4fb6b8'; ctx.fillRect(-10, -4, 22, 20); ctx.restore();
      reach(ctx, 186, 46, Math.PI + .3, H, GRIP, true, 40);                                         // the right hand tips the cup
      ctx.strokeStyle = '#4fb6b8'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(158, 52); ctx.quadraticCurveTo(146 + Math.sin(t * 6) * wob, 70, cx + 6, cy - 12); ctx.stroke();
    }
  } else if (kind === 'jewellery') {
    const N = 12, sx = (i: number) => 54 + i * 12.4, sy = (i: number) => 72 + 8 * Math.sin(Math.PI * (i + .5) / N);
    ctx.strokeStyle = c.muted; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(34, 70); for (let i = 0; i <= N; i++) ctx.lineTo(sx(i - .5), sy(i - .5) + (i === 0 || i === N ? -4 : 0)); ctx.lineTo(214, 70); ctx.stroke();
    const done = Math.min(N, Math.floor(p * (N + 1))), cols = ['#4fb6b8', '#e58aa6', c.mustard, '#3f6b3a', c.indigo];
    for (let i = 0; i < done; i++) { dot(ctx, sx(i), sy(i), 6.2, cols[i % cols.length]); dot(ctx, sx(i) - 1.8, sy(i) - 1.8, 1.7, 'rgba(255,255,255,.7)'); }
    reach(ctx, 40, 72, .05, H, PINCH, true, 40);                                                   // the left hand holds the string
    if (done < N) {
      const f = ease((p * (N + 1)) % 1), bx = sx(done) + 34 * (1 - f), by = sy(done) - 30 * (1 - f);
      dot(ctx, bx, by, 6.2, cols[done % cols.length]); dot(ctx, bx - 1.8, by - 1.8, 1.7, 'rgba(255,255,255,.7)');
      reach(ctx, bx + 5, by - 5, 2.5, H, PINCH, false, 40);                                         // the right hand pinches the next bead on
    } else reach(ctx, 190, 66, 2.9, H, HOLD, false, 40);
    if (p > .88) { const g = ease((p - .88) / .12), x = sx(5.5), y = sy(5.5); ctx.save(); ctx.translate(x, y + 6); ctx.scale(g, g); ctx.fillStyle = c.mustard; ctx.beginPath(); ctx.moveTo(-15, 0); ctx.quadraticCurveTo(0, 28, 15, 0); ctx.quadraticCurveTo(0, 15, -15, 0); ctx.fill(); dot(ctx, 0, 4, 3.6, '#b3262e'); ctx.restore(); }
  } else if (kind === 'print') {
    ctx.fillStyle = c.chalk; ctx.strokeStyle = c.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(20, 22, 200, 100, 4); ctx.fill(); ctx.stroke();
    const cols = 5, rows = 3, total = cols * rows, n = Math.min(total, Math.floor(p * (total + 1)));
    const at = (i: number) => ({ x: 52 + (i % cols) * 36, y: 48 + Math.floor(i / cols) * 30 });
    for (let i = 0; i < n; i++) { const q = at(i), col = i % 2 ? c.indigo : c.orange; for (let k = 0; k < 4; k++) dot(ctx, q.x + Math.cos(k * TAU / 4) * 6.4, q.y + Math.sin(k * TAU / 4) * 6.4, 4.6, col); dot(ctx, q.x, q.y, 2.8, c.chalk); }
    reach(ctx, 28, 112, -.7, H, HOLD, true, 38);                                                    // the left hand holds the cloth flat
    if (n < total) {
      const q = at(n), press = (Math.sin(t * 5) + 1) / 2, lift = press * 12 * wob;
      ctx.save(); ctx.translate(q.x, q.y - lift); ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(-12 + lift * .3, -12 + lift * .6, 26, 26); ctx.fillStyle = c.wood; ctx.beginPath(); ctx.roundRect(-13, -13, 26, 26, 3); ctx.fill(); ctx.strokeStyle = c.woodD; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
      reach(ctx, q.x + 6, q.y - lift - 4, 2.7, H, FLAT, false, 40);                                 // the right hand presses the block down
    }
  } else if (kind === 'wood') {
    const x0 = 40, x1 = 176, y0 = 26, y1 = 112, reveal = x0 + (x1 - x0) * ease(p / .92);
    ctx.fillStyle = c.wood; ctx.beginPath(); ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 4); ctx.fill();
    ctx.strokeStyle = c.woodD; ctx.lineWidth = 1; ctx.globalAlpha = .5; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x0 + 4, y0 + 10 + i * 14); ctx.bezierCurveTo(x0 + 50, y0 + 6 + i * 14, x1 - 50, y0 + 16 + i * 14, x1 - 4, y0 + 10 + i * 14); ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, reveal - x0, h); ctx.clip();
    ctx.fillStyle = c.cream; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    const ex = x0 + 8; ctx.fillStyle = c.woodD;
    ctx.beginPath(); ctx.ellipse(ex + 78, 70, 48, 29, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(ex + 28, 58, 23, 0, TAU); ctx.fill();
    ctx.lineWidth = 9; ctx.strokeStyle = c.woodD; ctx.beginPath(); ctx.moveTo(ex + 8, 64); ctx.quadraticCurveTo(ex - 6, 92, ex + 8, 104); ctx.stroke();
    ctx.fillRect(ex + 44, 86, 14, 26); ctx.fillRect(ex + 100, 86, 14, 26);
    ctx.fillStyle = c.wood; ctx.beginPath(); ctx.ellipse(ex + 42, 54, 10, 15, 0, 0, TAU); ctx.fill(); dot(ctx, ex + 22, 54, 2.4, c.hair);
    ctx.restore();
    const tipx = Math.min(reveal + 4, x1 - 6), tipy = 74, ang = -.78;
    ctx.strokeStyle = c.ink; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(tipx, tipy); ctx.lineTo(tipx - Math.cos(ang) * 34, tipy - Math.sin(ang) * 34); ctx.stroke();
    reach(ctx, tipx - Math.cos(ang) * 14, tipy - Math.sin(ang) * 14, ang, H, PINCH, true, 40);   // the left hand holds the chisel
    const swing = (Math.sin(t * 13 * (reduced ? 0 : 1)) + 1) / 2, endx = tipx - Math.cos(ang) * 36, endy = tipy - Math.sin(ang) * 36;
    ctx.save(); ctx.translate(endx + 6, endy - 4 - swing * 18); ctx.rotate(.3 - swing * .5); ctx.fillStyle = c.woodD; ctx.beginPath(); ctx.roundRect(-9, -8, 20, 14, 3); ctx.fill(); ctx.strokeStyle = c.woodD; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(44, 10); ctx.stroke(); ctx.restore();
    reach(ctx, endx + 44, endy + 4 - swing * 18, Math.PI + .25, H, GRIP, true, 40);                 // the right hand swings the mallet
    if (p < .94) for (let i = 0; i < 5; i++) { const a = (t * 3 + i * .7) % 1; ctx.save(); ctx.globalAlpha = 1 - a; ctx.translate(tipx + 4 + a * 24 + i * 3, tipy - a * 26 + a * a * 44); ctx.rotate(a * 6 + i); ctx.fillStyle = c.wood; ctx.fillRect(-2.6, -1.6, 5.2, 3.2); ctx.restore(); }
    else for (let i = 0; i < 6; i++) { const a = i * 1.05 + t * 2 * wob; dot(ctx, 138 + Math.cos(a) * 70, 70 + Math.sin(a) * 34, 2, c.mustard); }
  } else if (kind === 'christmas') {
    const cx = 92, n = Math.floor(p * 9);
    ctx.fillStyle = '#3f6b3a'; [[16, 62, 40], [40, 50, 32], [62, 38, 24]].forEach(([top, half, hh]) => { ctx.beginPath(); ctx.moveTo(cx, top - 6); ctx.lineTo(cx - half * .95, top + hh + 18); ctx.lineTo(cx + half * .95, top + hh + 18); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = c.woodD; ctx.fillRect(cx - 7, 104, 14, 12);
    const spots: Array<[number, number, string]> = [[-16, 38, '#b3262e'], [18, 52, c.mustard], [-30, 66, '#4fb6b8'], [10, 74, '#b3262e'], [34, 86, c.mustard], [-12, 90, '#e58aa6'], [26, 98, '#4fb6b8'], [-38, 98, c.mustard], [2, 58, '#e58aa6']];
    spots.slice(0, n).forEach(([dx, y, colr]) => { dot(ctx, cx + dx, y, 5.4, colr); dot(ctx, cx + dx - 1.6, y - 1.6, 1.4, 'rgba(255,255,255,.7)'); });
    if (n < 9) {
      const f = ease((p * 9) % 1), [dx, y, colr] = spots[n], ox = cx + dx + 78 * (1 - f), oy = y - 40 * (1 - f);
      ctx.strokeStyle = c.woodD; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ox, oy - 8); ctx.lineTo(ox, oy - 4); ctx.stroke(); dot(ctx, ox, oy, 5.4, colr); dot(ctx, ox - 1.6, oy - 1.6, 1.4, 'rgba(255,255,255,.7)');
      reach(ctx, ox + 6, oy - 8, 2.6, H, PINCH, false, 40);                                         // the right hand hangs each ornament
    } else { const g = ease((p - .9) / .1); ctx.save(); ctx.translate(cx, 12); ctx.scale(g, g); ctx.fillStyle = '#e8b02e'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.4 : 11, a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); }
    reach(ctx, cx - 40, 112, -.9, H, HOLD, true, 34);                                               // the left hand holds the tree steady
  } else {
    const cx = 118, f = ease(p);
    ctx.fillStyle = c.orange; ctx.beginPath(); ctx.roundRect(cx - 40, 56, 80, 46, 4); ctx.fill(); ctx.fillStyle = c.terraD; ctx.beginPath(); ctx.roundRect(cx - 44, 44, 88, 16, 4); ctx.fill();
    ctx.strokeStyle = c.chalk; ctx.lineWidth = 6 * f; ctx.beginPath(); ctx.moveTo(cx, 44); ctx.lineTo(cx, 102); ctx.stroke();
    ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(cx, 44); ctx.quadraticCurveTo(cx - 30 * f, 14, cx - 12 * f, 40); ctx.moveTo(cx, 44); ctx.quadraticCurveTo(cx + 30 * f, 14, cx + 12 * f, 40); ctx.stroke();
    reach(ctx, cx - 42, 96, -.15, H, HOLD, false, 38);
    reach(ctx, cx + 14 + Math.sin(t * 4) * 3 * wob, 40, 2.5, H, PINCH, true, 40);
    if (p > .85) for (let i = 0; i < 6; i++) { const a = i * 1.05 + t * 2 * wob; dot(ctx, cx + Math.cos(a) * 68, 70 + Math.sin(a) * 30, 2, c.mustard); }
  }
  ctx.restore();
}
