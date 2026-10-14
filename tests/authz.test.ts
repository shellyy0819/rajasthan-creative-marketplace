import { describe, it, expect } from 'vitest';
import { roleFor, requireUser, requireAdmin } from '@/lib/authz';

describe('roleFor', () => {
  it('admin only when email is in ADMIN_EMAILS (case/space-insensitive)', () => {
    expect(roleFor('Boss@Shop.com', ' boss@shop.com , other@x.co')).toBe('admin');
    expect(roleFor('a@x.co', 'boss@shop.com')).toBe('customer');
  });
  it('no admins configured → everyone is customer', () => {
    expect(roleFor('a@x.co', undefined)).toBe('customer');
    expect(roleFor('a@x.co', '')).toBe('customer');
  });
});

describe('requireUser / requireAdmin', () => {
  it('401 without a session or email', () => {
    expect(() => requireUser(null)).toThrowError(expect.objectContaining({ status: 401 }));
    expect(() => requireUser({ user: {} })).toThrowError(expect.objectContaining({ status: 401 }));
    expect(() => requireAdmin(null)).toThrowError(expect.objectContaining({ status: 401 }));
  });
  it('returns the user for a customer session', () => {
    expect(requireUser({ user: { email: 'a@x.co', role: 'customer' } })).toMatchObject({ email: 'a@x.co', role: 'customer' });
  });
  it('403 for a customer on admin routes; ok for admin', () => {
    expect(() => requireAdmin({ user: { email: 'a@x.co', role: 'customer' } })).toThrowError(expect.objectContaining({ status: 403 }));
    expect(requireAdmin({ user: { email: 'r@x.co', role: 'admin' } }).role).toBe('admin');
  });
  it('missing role is treated as customer (never admin)', () => {
    expect(() => requireAdmin({ user: { email: 'a@x.co' } })).toThrowError(expect.objectContaining({ status: 403 }));
  });
});
