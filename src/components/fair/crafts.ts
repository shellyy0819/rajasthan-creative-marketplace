import type { CraftKind } from '@/lib/fair-types';
import type { Colors } from './theme';

/** How long a "watch them work" moment lasts, in seconds. */
export const CRAFT_SECONDS = 10;
export const CRAFT_LABEL: Record<CraftKind, string> = {
  crochet: 'Crocheting a lotus', pottery: 'Shaping a pot on the wheel', resin: 'Pouring a resin coaster',
  jewellery: 'Threading beads', print: 'Block-printing cloth', handmade: 'Making something by hand',
};
/** Size of the picture each craft is drawn in. */
export const CRAFT_BOX = { w: 220, h: 96 } as const;

const TAU = Math.PI * 2;
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };

/**
 * Draws one frame of a craft. `p` is how far through the 10 seconds we are (0 to 1) and `t` is a clock in seconds for the little repeating motions.
 * Everything is drawn inside CRAFT_BOX with its top-left at the origin.
 */
export function drawCraft(ctx: CanvasRenderingContext2D, kind: CraftKind, p: number, t: number, c: Colors, reduced = false): void {
  const { w, h } = CRAFT_BOX, wob = reduced ? 0 : 1;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'crochet') {
    dot(ctx, 30, 62, 17, c.sage); ctx.strokeStyle = c.chalk; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(30, 62, 10, 0.3, 4.4); ctx.stroke(); ctx.beginPath(); ctx.arc(30, 62, 5, 1, 5); ctx.stroke();
    const n = Math.floor(p * 22) + 1, perRow = 11;
    ctx.strokeStyle = c.orange; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(46, 58); ctx.quadraticCurveTo(60, 74, 70, 66); ctx.stroke();
    let lx = 70, ly = 66;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow), col = i % perRow, x = 70 + col * 11, y = 66 - row * 14;
      ctx.strokeStyle = row ? c.mustard : c.orange; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.ellipse(x, y, 6, 4.4, 0, 0, TAU); ctx.stroke(); lx = x; ly = y;
    }
    const bob = Math.sin(t * 9) * 2 * wob;
    ctx.strokeStyle = c.woodD; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx + 4, ly - 4 + bob); ctx.lineTo(lx + 20, ly - 26 + bob); ctx.stroke();
    ctx.beginPath(); ctx.arc(lx + 4, ly - 4 + bob, 2.2, 0, TAU); ctx.stroke();
    if (p > 0.9) { const s = ease((p - 0.9) / 0.1); ctx.save(); ctx.translate(196, 28); ctx.scale(s, s); for (let i = 0; i < 5; i++) dot(ctx, Math.cos(i * TAU / 5 - 1.57) * 9, Math.sin(i * TAU / 5 - 1.57) * 9, 7, '#e58aa6'); dot(ctx, 0, 0, 5, c.mustard); ctx.restore(); }
  } else if (kind === 'pottery') {
    const cx = w / 2 + 6, base = 80, e = ease(p / 0.75), H = 10 + 46 * e;
    ctx.fillStyle = c.woodD; ctx.beginPath(); ctx.ellipse(cx, base + 6, 54, 9, 0, 0, TAU); ctx.fill(); ctx.fillStyle = c.wood; ctx.fillRect(cx - 54, base - 2, 108, 8); ctx.beginPath(); ctx.ellipse(cx, base - 2, 54, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = c.terraD; const ang = t * 7 * wob; dot(ctx, cx + Math.cos(ang) * 44, base - 2 + Math.sin(ang) * 6.5, 2.4, c.chalk);
    const prof = (y: number) => 14 + 13 * Math.sin(Math.PI * Math.min(1, y * 1.08)) * (0.55 + 0.45 * e) - (y > 0.62 ? (y - 0.62) * 34 * e : 0);
    ctx.fillStyle = c.orange; ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const y = i / 24; ctx.lineTo(cx - prof(y), base - H * y); }
    for (let i = 24; i >= 0; i--) { const y = i / 24; ctx.lineTo(cx + prof(y), base - H * y); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = c.terraD; ctx.lineWidth = 1.4; ctx.globalAlpha = .55;
    for (let k = 0; k < 6; k++) { const y = ((k / 6) + (t * 0.5 * wob) % 1 / 6) % 1, r = prof(y); ctx.beginPath(); ctx.ellipse(cx, base - H * y, r, 3, 0, 0, Math.PI); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const press = Math.sin(t * 3) * 2 * wob, hy = base - H * 0.5;
    ctx.fillStyle = c.skin; ctx.beginPath(); ctx.ellipse(cx - prof(0.5) - 5 + press, hy, 6, 9, 0.2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx + prof(0.5) + 5 - press, hy, 6, 9, -0.2, 0, TAU); ctx.fill();
    if (p > 0.8) { const g = ease((p - 0.8) / 0.2); ctx.fillStyle = c.mustard; ctx.globalAlpha = g; ctx.fillRect(cx - prof(0.9) - 1, base - H * 0.93, prof(0.9) * 2 + 2, 4); ctx.fillStyle = c.indigo; ctx.fillRect(cx - prof(0.3), base - H * 0.34, prof(0.3) * 2, 3); ctx.globalAlpha = 1; }
  } else if (kind === 'resin') {
    const cx = w / 2 - 14, cy = 54, R = 32, level = ease(p / 0.9);
    ctx.fillStyle = c.cream; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, TAU); ctx.fill(); ctx.strokeStyle = c.woodD; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.fillStyle = c.indigo; ctx.fillRect(cx - R, cy + R - 2 * R * level, 2 * R, 2 * R * level + 2);
    ctx.translate(cx, cy); ctx.rotate(t * 0.5 * wob + p * 3);
    const cols = ['#4fb6b8', c.mustard, c.chalk, '#e58aa6'];
    for (let k = 0; k < 4; k++) { ctx.strokeStyle = cols[k]; ctx.globalAlpha = .85 * level; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 6 + k * 7, k, k + 2.4); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.restore();
    if (p > 0.5) for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 6 + (i * 5) % 24; dot(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.4, '#e8b02e'); }
    if (p > 0.92) { ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = .55; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R - 6, 3.6, 4.7); ctx.stroke(); ctx.globalAlpha = 1; }
    if (p < 0.92) {
      ctx.save(); ctx.translate(cx + 52, 14); ctx.rotate(-0.9); ctx.fillStyle = c.chalk; ctx.strokeStyle = c.woodD; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-9, -2, 22, 26, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#4fb6b8'; ctx.fillRect(-7, 8, 18, 14); ctx.restore();
      ctx.strokeStyle = '#4fb6b8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + 36, 24); ctx.quadraticCurveTo(cx + 22 + Math.sin(t * 6) * wob, 36, cx + 4, cy - 6); ctx.stroke();
    }
  } else if (kind === 'jewellery') {
    const N = 12, pts = (u: number) => ({ x: 26 + (w - 52) * u, y: 22 + 4 * Math.sin(Math.PI * u) + 44 * (4 * u * (1 - u)) * 0.8 });
    ctx.strokeStyle = c.muted; ctx.lineWidth = 1.4; ctx.beginPath(); for (let i = 0; i <= 40; i++) { const q = pts(i / 40); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); } ctx.stroke();
    const n = Math.min(N, Math.floor(p * (N + 1))), cols = ['#4fb6b8', '#e58aa6', c.mustard, '#3f6b3a', c.indigo];
    for (let i = 0; i < n; i++) { const q = pts((i + .5) / N); dot(ctx, q.x, q.y, 6, cols[i % cols.length]); dot(ctx, q.x - 1.8, q.y - 1.8, 1.6, 'rgba(255,255,255,.65)'); }
    if (n < N) { const q = pts((n + .5) / N), bob = Math.sin(t * 8) * 2 * wob; ctx.strokeStyle = c.woodD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x + 4, q.y - 14 + bob); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    if (p > 0.88) { const g = ease((p - 0.88) / 0.12), q = pts(.5); ctx.save(); ctx.translate(q.x, q.y + 6); ctx.scale(g, g); ctx.fillStyle = c.mustard; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(0, 26, 14, 0); ctx.quadraticCurveTo(0, 14, -14, 0); ctx.fill(); dot(ctx, 0, 4, 3.4, '#b3262e'); ctx.restore(); }
  } else if (kind === 'print') {
    ctx.fillStyle = c.chalk; ctx.strokeStyle = c.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(12, 16, w - 24, 70, 4); ctx.fill(); ctx.stroke();
    const cols = 7, rows = 2, total = cols * rows, n = Math.min(total, Math.floor(p * (total + 1)));
    const at = (i: number) => ({ x: 34 + (i % cols) * 25, y: 38 + Math.floor(i / cols) * 30 });
    for (let i = 0; i < n; i++) { const q = at(i); ctx.fillStyle = i % 2 ? c.indigo : c.orange; for (let k = 0; k < 4; k++) dot(ctx, q.x + Math.cos(k * TAU / 4) * 6, q.y + Math.sin(k * TAU / 4) * 6, 4.4, ctx.fillStyle as string); dot(ctx, q.x, q.y, 2.6, c.chalk); }
    if (n < total) { const q = at(n), lift = (0.5 + 0.5 * Math.sin(t * 6)) * 10 * wob; ctx.save(); ctx.translate(q.x, q.y - lift); ctx.fillStyle = c.wood; ctx.beginPath(); ctx.roundRect(-11, -11, 22, 22, 3); ctx.fill(); ctx.fillStyle = c.woodD; ctx.fillRect(-4, -20, 8, 10); ctx.restore(); }
  } else {
    const g = ease(p), cx = w / 2;
    ctx.fillStyle = c.orange; ctx.beginPath(); ctx.roundRect(cx - 36, 44, 72, 38, 4); ctx.fill(); ctx.fillStyle = c.terraD; ctx.beginPath(); ctx.roundRect(cx - 40, 34, 80, 14, 4); ctx.fill();
    ctx.strokeStyle = c.chalk; ctx.lineWidth = 6 * g; ctx.beginPath(); ctx.moveTo(cx, 34); ctx.lineTo(cx, 82); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, 34); ctx.quadraticCurveTo(cx - 28 * g, 8, cx - 12 * g, 30); ctx.moveTo(cx, 34); ctx.quadraticCurveTo(cx + 28 * g, 8, cx + 12 * g, 30); ctx.stroke();
    if (p > 0.85) for (let i = 0; i < 6; i++) { const a = i * 1.05 + t * 2 * wob; dot(ctx, cx + Math.cos(a) * 52, 50 + Math.sin(a) * 26, 2, c.mustard); }
  }
  ctx.restore();
}
