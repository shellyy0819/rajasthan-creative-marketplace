import { describe, it, expect } from 'vitest';
import { validateOnboarding, validateMobile, validateContactMethods } from '../src/lib/onboarding-validate';

const good = {
  fullName: ' Asha Devi ', mobile: '99898 98999', brandName: 'Asha Crafts', category: 'Textiles',
  description: 'Hand block printed fabrics.', instagram: '@asha.crafts', logoUrl: 'https://x.test/logo.png',
  contactMethods: ['phone'], cityRef: 'signed.ref',
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
  it('requires a city: cityRef or cityId', () => {
    expect(errs({ cityRef: undefined }).cityRef).toBe('Pick your city from the list.');
    expect(errs({ cityRef: '  ' }).cityRef).toBe('Pick your city from the list.');
    expect(validateOnboarding({ ...good, cityRef: undefined, cityId: 7 }).ok).toBe(true);
    expect(errs({ cityRef: undefined, cityId: 0 }).cityRef).toBe('Pick your city from the list.');
  });
  it('rejects blank full name', () => { expect(errs({ fullName: '   ' }).fullName).toBeTruthy(); });
  it('rejects whitespace-only brand name', () => { expect(errs({ brandName: '  \t ' }).brandName).toBeTruthy(); });
  it('mobile accepts +91, 0 prefix and spaces and stores normalised', () => {
    const stored = ['+91 98765 43210', '098765 43210', '98765-43210', '9876543210', '91 98765 43210'].map(m => {
      const r = validateOnboarding({ ...good, mobile: m });
      return r.ok && r.value.mobile;
    });
    expect(new Set(stored)).toEqual(new Set(['9876543210']));
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
    expect(r.ok && r.value.whatsapp).toBe('9876543210');
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
  it('logoUrl is optional: absent or blank is accepted and left out of the value', () => {
    for (const logoUrl of ['  ', '', undefined]) {
      const r = validateOnboarding({ ...good, logoUrl });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.logoUrl).toBeUndefined();
    }
  });
  it('a provided logoUrl is still checked and kept', () => {
    expect(errs({ logoUrl: 'x'.repeat(501) }).logoUrl).toBeTruthy();
    const r = validateOnboarding({ ...good, logoUrl: 'https://x.test/logo.png' });
    expect(r.ok && r.value.logoUrl).toBe('https://x.test/logo.png');
  });
  it('returns every error at once', () => {
    const r = validateOnboarding({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(
        ['brandName', 'category', 'cityRef', 'contactMethods', 'description', 'fullName', 'instagram', 'mobile'].sort());
    }
  });
  it('non-object input gives a form error', () => {
    expect(validateOnboarding(null)).toEqual({ ok: false, errors: { form: expect.any(String) } });
  });
});
