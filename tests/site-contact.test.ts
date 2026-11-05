import { describe, it, expect, afterEach } from 'vitest';
import { SITE, contactEmail } from '@/lib/site';

const saved = process.env.CONTACT_EMAIL;
afterEach(() => { if (saved === undefined) delete process.env.CONTACT_EMAIL; else process.env.CONTACT_EMAIL = saved; });

describe('contactEmail (the public contact address comes from CONTACT_EMAIL, never from code)', () => {
  it('is undefined when the variable is unset, blank or not an email, so no email link or text can show', () => {
    delete process.env.CONTACT_EMAIL; expect(contactEmail()).toBeUndefined();
    for (const bad of ['', '   ', 'hello', 'hello@', '@x.in', 'a b@c.in', 'a@b', 'javascript:alert(1)', 'a@b.in?subject=x', 'a@b.in,c@d.in']) {
      process.env.CONTACT_EMAIL = bad; expect(contactEmail(), bad).toBeUndefined();
    }
  });
  it('returns a valid address trimmed', () => {
    process.env.CONTACT_EMAIL = '  hello@craftofy.in ';
    expect(contactEmail()).toBe('hello@craftofy.in');
  });
  it('the site settings carry no email of their own', () => {
    expect(SITE).not.toHaveProperty('email');
  });
});
