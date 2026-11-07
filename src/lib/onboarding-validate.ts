// Pure validation for seller onboarding. No db or server-only imports: safe for client components.
import { normalizePhone } from './phone';
import type { ContactMethod } from './types';

export type OnboardingInput = {
  fullName: string; mobile: string; brandName: string; category: string; description: string;
  cityId?: number; cityRef?: string; instagram?: string; website?: string; logoUrl: string;
  contactMethods: ContactMethod[]; whatsapp?: string;
};
export type FieldErrors = Partial<Record<keyof OnboardingInput | 'form', string>>;
export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const MOBILE_ERROR = 'Enter a 10-digit mobile number.';
export const INSTAGRAM_OR_WEBSITE_ERROR = 'Add an Instagram handle or a website.';
export const CITY_ERROR = 'Pick your city from the list.';
export const CONTACT_METHODS_ERROR = 'Choose at least one way for customers to reach you.';
export const CONTACT_METHOD_VALUES: readonly ContactMethod[] = ['whatsapp', 'instagram', 'website', 'phone'];

const ok = <T>(value: T): FieldResult<T> => ({ ok: true, value });
const fail = (error: string): FieldResult<never> => ({ ok: false, error });
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function requiredText(v: unknown, label: string, max: number): FieldResult<string> {
  const t = str(v);
  if (!t) return fail(`Enter ${label}.`);
  if (t.length > max) return fail(`${label[0].toUpperCase()}${label.slice(1)} must be ${max} characters or fewer.`);
  return ok(t);
}
export const validateFullName = (v: unknown) => requiredText(v, 'your full name', 100);
export const validateBrandName = (v: unknown) => requiredText(v, 'your brand name', 100);
export const validateCategory = (v: unknown) => requiredText(v, 'a category', 100);
export const validateDescription = (v: unknown) => requiredText(v, 'a short description', 200);
export function validateLogoUrl(v: unknown): FieldResult<string> {
  const t = str(v);
  if (!t) return fail('Upload your logo.');
  if (t.length > 500) return fail('Logo link is too long.');
  return ok(t);
}
/** The logo must be an http(s) URL (validateLogoUrl only checks length). */
export function isHttpUrl(v: string): boolean {
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}
/** Canonical 10-digit mobile (prefix dropped), or undefined when invalid. */
function canonicalMobile(input: string): string | undefined {
  const n = normalizePhone(input);
  return n ? n.slice(-10) : undefined;
}
export function validateMobile(v: unknown): FieldResult<string> {
  const n = canonicalMobile(str(v));
  return n ? ok(n) : fail(MOBILE_ERROR);
}
/** Optional website. Empty gives ok(undefined). */
export function validateWebsite(v: unknown): FieldResult<string | undefined> {
  const t = str(v);
  if (!t) return ok(undefined);
  const msg = 'Enter a website starting with http:// or https://.';
  if (t.length > 200) return fail('Website must be 200 characters or fewer.');
  let u: URL;
  try { u = new URL(t); } catch { return fail(msg); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return fail(msg);
  return ok(t);
}
/** Optional Instagram handle; a leading @ is stripped. */
export function validateInstagram(v: unknown): FieldResult<string | undefined> {
  const t = str(v).replace(/^@+/, '');
  if (!t) return ok(undefined);
  if (!/^[A-Za-z0-9._]{1,30}$/.test(t)) return fail('Enter a valid Instagram handle.');
  return ok(t);
}
/** At least one of instagram / website (values already validated and trimmed). */
export function validateInstagramOrWebsite(instagram: unknown, website: unknown): FieldResult<true> {
  return str(instagram).replace(/^@+/, '') || str(website) ? ok(true) : fail(INSTAGRAM_OR_WEBSITE_ERROR);
}
/** Optional WhatsApp number; empty gives ok(undefined). */
export function validateWhatsapp(v: unknown): FieldResult<string | undefined> {
  const t = str(v);
  if (!t) return ok(undefined);
  const n = canonicalMobile(t);
  return n ? ok(n) : fail('Enter a valid WhatsApp number.');
}

/**
 * Checks the chosen methods and that each has the value it needs. `ctx` holds raw field values;
 * errors for value problems land on the field itself (whatsapp, instagram, website, mobile).
 */
export function validateContactMethods(
  v: unknown, ctx: { mobile?: unknown; whatsapp?: unknown; instagram?: unknown; website?: unknown },
): { ok: true; value: ContactMethod[] } | { ok: false; errors: FieldErrors } {
  const picked = Array.isArray(v)
    ? CONTACT_METHOD_VALUES.filter(m => v.includes(m))
    : [];
  if (picked.length === 0) return { ok: false, errors: { contactMethods: CONTACT_METHODS_ERROR } };
  const errors: FieldErrors = {};
  if (picked.includes('whatsapp') && !canonicalMobile(str(ctx.whatsapp))) errors.whatsapp = 'Enter a valid WhatsApp number.';
  if (picked.includes('phone') && !canonicalMobile(str(ctx.mobile))) errors.mobile = MOBILE_ERROR;
  if (picked.includes('instagram') && !str(ctx.instagram).replace(/^@+/, '')) errors.instagram = 'Add your Instagram handle.';
  if (picked.includes('website') && !str(ctx.website)) errors.website = 'Add your website.';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: picked };
}

export function validateOnboarding(raw: unknown): { ok: true; value: OnboardingInput } | { ok: false; errors: FieldErrors } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: { form: 'Invalid request.' } };
  const r = raw as Record<string, unknown>;
  const errors: FieldErrors = {};
  const take = <T>(key: keyof OnboardingInput, res: FieldResult<T>): T | undefined => {
    if (res.ok) return res.value;
    errors[key] = res.error;
    return undefined;
  };

  const fullName = take('fullName', validateFullName(r.fullName));
  const mobile = take('mobile', validateMobile(r.mobile));
  const brandName = take('brandName', validateBrandName(r.brandName));
  const category = take('category', validateCategory(r.category));
  const description = take('description', validateDescription(r.description));
  const logoUrl = take('logoUrl', validateLogoUrl(r.logoUrl));
  const website = take('website', validateWebsite(r.website));
  const instagram = take('instagram', validateInstagram(r.instagram));
  if (!errors.website && !errors.instagram) take('instagram', validateInstagramOrWebsite(instagram, website));
  const whatsapp = take('whatsapp', validateWhatsapp(r.whatsapp));

  const cm = validateContactMethods(r.contactMethods, { mobile: r.mobile, whatsapp: r.whatsapp, instagram, website });
  let contactMethods: ContactMethod[] = [];
  if (cm.ok) contactMethods = cm.value;
  else for (const [k, msg] of Object.entries(cm.errors)) errors[k as keyof FieldErrors] ??= msg;

  const cityId = typeof r.cityId === 'number' && Number.isInteger(r.cityId) && r.cityId > 0 ? r.cityId : undefined;
  const cityRef = str(r.cityRef).slice(0, 1000) || undefined;

  if (cityId === undefined && !cityRef) errors.cityRef = CITY_ERROR;

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      fullName: fullName!, mobile: mobile!, brandName: brandName!, category: category!, description: description!,
      ...(cityId !== undefined && { cityId }), ...(cityRef && { cityRef }),
      ...(instagram && { instagram }), ...(website && { website }),
      logoUrl: logoUrl!, contactMethods, ...(whatsapp && { whatsapp }),
    },
  };
}
