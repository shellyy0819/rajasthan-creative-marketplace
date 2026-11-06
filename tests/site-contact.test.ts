import { describe, it, expect, afterEach } from 'vitest';
import { DEFAULT_CONTACT_EMAIL, SITE, contactEmail } from '@/lib/site';

const saved = process.env.CONTACT_EMAIL;
afterEach(() => { if (saved === undefined) delete process.env.CONTACT_EMAIL; else process.env.CONTACT_EMAIL = saved; });

describe('contactEmail (the one public address used for all communication)', () => {
  it('defaults to hello.craftofy@gmail.com when CONTACT_EMAIL is unset', () => {
    expect(DEFAULT_CONTACT_EMAIL).toBe('hello.craftofy@gmail.com');
    delete process.env.CONTACT_EMAIL;
    expect(contactEmail()).toBe('hello.craftofy@gmail.com');
  });
  it('falls back to the default when CONTACT_EMAIL is blank or not a usable email', () => {
    for (const bad of ['', '   ', 'hello', 'hello@', '@x.in', 'a b@c.in', 'a@b', 'javascript:alert(1)', 'a@b.in?subject=x', 'a@b.in,c@d.in']) {
      process.env.CONTACT_EMAIL = bad; expect(contactEmail(), bad).toBe('hello.craftofy@gmail.com');
    }
  });
  it('CONTACT_EMAIL overrides the default when it is valid (trimmed), so a domain address can replace it later', () => {
    process.env.CONTACT_EMAIL = '  hello@craftofy.in ';
    expect(contactEmail()).toBe('hello@craftofy.in');
  });
  it('the site settings carry no email of their own', () => {
    expect(SITE).not.toHaveProperty('email');
  });
});
