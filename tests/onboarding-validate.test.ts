import { describe, it, expect } from 'vitest';
import { validateOnboarding, validateMobile, validateContactMethods } from '../src/lib/onboarding-validate';

const good = {
  fullName: ' Asha Devi ', mobile: '99898 98999', brandName: 'Asha Crafts', category: 'Textiles',
  description: 'Hand block printed fabrics.', instagram: '@asha.crafts', logoUrl: 'https://x.test/logo.png',
  contactMethods: ['phone'],
};
const errs = (o: object) => {
  const r = validateOnboarding({ ...good, ...o });
  if (r.ok) throw new Error('expected failure');
  return r.errors;
};

describe('validateOnboarding', () => {
  it('accepts valid input, trimmed and normalised', () => {
    const r = validateOnboarding(good);
    expect(r).toMatchObject({ ok: true, value: { fullName: 'Asha Devi', mobile: '9989898999', instagram: 'asha.crafts' } });
  });
  it('rejects blank full name', () => { expect(errs({ fullName: '   ' }).fullName).toBeTruthy(); });
  it('rejects whitespace-only brand name', () => { expect(errs({ brandName: '  \t ' }).brandName).toBeTruthy(); });
  it('mobile accepts +91, 0 prefix and spaces and stores normalised', () => {
    // normalizePhone strips separators only; the prefix is kept as typed.
    for (const [m, want] of [['+91 99898-98999', '+919989898999'], ['09989898999', '09989898999'], ['919989898999', '919989898999']]) {
      const r = validateOnboarding({ ...good, mobile: m });
      expect(r.ok && r.value.mobile).toBe(want);
    }
  });
  it('mobile 12345 gives "Enter a 10-digit mobile number."', () => {
    expect(errs({ mobile: '12345' }).mobile).toBe('Enter a 10-digit mobile number.');
    expect(errs({ mobile: '' }).mobile).toBe('Enter a 10-digit mobile number.');
    expect(validateMobile('12345')).toEqual({ ok: false, error: 'Enter a 10-digit mobile number.' });
  });
  it('description over 200 rejected, empty rejected', () => {
    expect(errs({ description: 'a'.repeat(201) }).description).toBeTruthy();
    expect(errs({ description: '  ' }).description).toBeTruthy();
    expect(validateOnboarding({ ...good, description: 'a'.repeat(200) }).ok).toBe(true);
  });
  it('needs instagram or website with exact message', () => {
    expect(errs({ instagram: '', website: '' }).instagram).toBe('Add an Instagram handle or a website.');
    expect(errs({ instagram: '  ', website: undefined }).instagram).toBe('Add an Instagram handle or a website.');
    expect(validateOnboarding({ ...good, instagram: '', website: 'https://asha.test' }).ok).toBe(true);
  });
  it('website must be http or https', () => {
    expect(errs({ website: 'ftp://asha.test' }).website).toBeTruthy();
    expect(errs({ website: 'javascript:alert(1)' }).website).toBeTruthy();
    expect(errs({ website: 'not a url' }).website).toBeTruthy();
    expect(errs({ website: 'https://a.test/' + 'x'.repeat(200) }).website).toBeTruthy();
    expect(validateOnboarding({ ...good, website: 'http://asha.test' }).ok).toBe(true);
  });
  it('needs at least one contact method with exact message', () => {
    expect(errs({ contactMethods: [] }).contactMethods).toBe('Choose at least one way for customers to reach you.');
    expect(errs({ contactMethods: undefined }).contactMethods).toBe('Choose at least one way for customers to reach you.');
    expect(validateContactMethods(['bogus'], {})).toEqual({ ok: false, errors: { contactMethods: 'Choose at least one way for customers to reach you.' } });
  });
  it('whatsapp method needs a valid number', () => {
    expect(errs({ contactMethods: ['whatsapp'] }).whatsapp).toBeTruthy();
    expect(errs({ contactMethods: ['whatsapp'], whatsapp: '123' }).whatsapp).toBeTruthy();
    const r = validateOnboarding({ ...good, contactMethods: ['whatsapp'], whatsapp: '+91 98765 43210' });
    expect(r.ok && r.value.whatsapp).toBe('+919876543210');
  });
  it('phone method needs mobile', () => {
    expect(errs({ contactMethods: ['phone'], mobile: '' }).mobile).toBe('Enter a 10-digit mobile number.');
  });
  it('instagram method needs instagram value', () => {
    expect(errs({ contactMethods: ['instagram'], instagram: '', website: 'https://a.test' }).instagram).toBeTruthy();
  });
  it('website method needs website value', () => {
    expect(errs({ contactMethods: ['website'] }).website).toBeTruthy();
  });
  it('logoUrl required', () => {
    expect(errs({ logoUrl: '  ' }).logoUrl).toBeTruthy();
    expect(errs({ logoUrl: undefined }).logoUrl).toBeTruthy();
  });
  it('returns every error at once', () => {
    const r = validateOnboarding({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(
        ['brandName', 'category', 'contactMethods', 'description', 'fullName', 'instagram', 'logoUrl', 'mobile'].sort());
    }
  });
  it('non-object input gives a form error', () => {
    expect(validateOnboarding(null)).toEqual({ ok: false, errors: { form: expect.any(String) } });
  });
});
