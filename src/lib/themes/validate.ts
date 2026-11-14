import { bad, obj, optionalText, text, type Raw } from '../validate';
import { isHex, passesContrast } from './contrast';
import { istToDate } from './ist';
import { isStickerId } from './stickers';
import { LIMITS, type Placement, type ThemeConfig } from './types';

const MAX_STICKERS = 40;

function num(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw bad(`${field} must be between ${min} and ${max}.`);
  return v;
}

function placement(raw: unknown, i: number): Placement {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad(`Sticker ${i + 1} must be an object.`);
  const p = raw as Raw;
  if (!isStickerId(p.id)) throw bad(`Sticker ${i + 1} has an unknown sticker id.`);
  return { id: p.id, x: num(p.x, `Sticker ${i + 1} x`, -300, 300), y: num(p.y, `Sticker ${i + 1} y`, -300, 300), s: num(p.s, `Sticker ${i + 1} scale`, 0.4, 3) };
}

export function validateConfig(raw: unknown): ThemeConfig {
  const r = obj(raw);
  let primary: string | undefined;
  if (r.primary !== undefined && r.primary !== null && r.primary !== '') {
    if (!isHex(r.primary)) throw bad('primary must be a colour like #6E1A2A.');
    if (!passesContrast(r.primary)) throw bad('primary does not have enough contrast with its text colour (needs at least 4.5:1). Pick a darker or lighter colour.');
    primary = r.primary.toUpperCase();
  }
  if (!Array.isArray(r.stickers) || r.stickers.length > MAX_STICKERS) throw bad(`stickers must be a list of up to ${MAX_STICKERS} items.`);
  if (typeof r.bunting !== 'boolean') throw bad('bunting must be true or false.');
  const out: ThemeConfig = {
    banner: text(r.banner, 'banner', LIMITS.banner),
    sign: text(r.sign, 'sign', LIMITS.sign),
    // The chalkboard is optional: leave all three lines empty and it is not drawn.
    chalkLabel: optionalText(r.chalkLabel, 'chalkLabel', LIMITS.chalkLabel) ?? '',
    chalkTitle: optionalText(r.chalkTitle, 'chalkTitle', LIMITS.chalkTitle) ?? '',
    chalkSub: optionalText(r.chalkSub, 'chalkSub', LIMITS.chalkSub) ?? '',
    bunting: r.bunting,
    stickers: r.stickers.map(placement),
  };
  const href = optionalText(r.chalkHref, 'chalkHref', LIMITS.chalkHref);
  if (href) {
    if (!/^\/(?!\/)\S*$/.test(href) && !/^https:\/\/[^\s/]+\S*$/.test(href)) throw bad('chalkHref must be a path on this site like /shop, or an https address.');
    out.chalkHref = href;
  }
  if (primary) out.primary = primary;
  return out;
}

function istField(v: unknown, field: string): Date {
  if (typeof v !== 'string') throw bad(`${field} must be a date and time like 2026-11-07T06:00 (IST).`);
  try { return istToDate(v); } catch { throw bad(`${field} must be a date and time like 2026-11-07T06:00 (IST).`); }
}

export function validateWindow(startsAtIst: unknown, endsAtIst: unknown): { startsAt: Date; endsAt: Date } {
  const startsAt = istField(startsAtIst, 'startsAt');
  const endsAt = istField(endsAtIst, 'endsAt');
  if (endsAt.getTime() <= startsAt.getTime()) throw bad('The end must be after the start.');
  return { startsAt, endsAt };
}
