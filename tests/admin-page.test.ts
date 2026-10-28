import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
const nav = vi.hoisted(() => ({ redirect: vi.fn((to: string) => { throw new Error('REDIRECT:' + to); }), notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }) }));
vi.mock('next/navigation', () => nav);
import { requireAdminPage, requireStaffPage } from '@/lib/admin-page';

const env = { DASHBOARD_URL: process.env.DASHBOARD_URL, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL };
beforeEach(() => { authMock.mockReset(); nav.redirect.mockClear(); nav.notFound.mockClear(); });
afterEach(() => { for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

describe('dashboard page gates', () => {
  it('single host: a signed-out visitor is sent to a relative sign-in that returns to /dashboard/posts', async () => {
    delete process.env.DASHBOARD_URL;
    authMock.mockResolvedValue(null);
    await expect(requireStaffPage()).rejects.toThrow('REDIRECT:/api/auth/signin?callbackUrl=%2Fdashboard%2Fposts');
    await expect(requireAdminPage()).rejects.toThrow('REDIRECT:/api/auth/signin?callbackUrl=%2Fdashboard%2Fposts');
  });
  it('two hosts: sign-in starts on the public host and returns to the dashboard host', async () => {
    process.env.DASHBOARD_URL = 'https://dashboard.example.com'; process.env.NEXT_PUBLIC_SITE_URL = 'https://www.example.com';
    authMock.mockResolvedValue(null);
    await expect(requireStaffPage()).rejects.toThrow('REDIRECT:https://www.example.com/api/auth/signin?callbackUrl=' + encodeURIComponent('https://dashboard.example.com/dashboard/posts'));
  });
  it('customers get a 404, sellers pass the staff gate but not the admin gate, admins pass both', async () => {
    authMock.mockResolvedValue({ user: { email: 'c@x.co', role: 'customer' } });
    await expect(requireStaffPage()).rejects.toThrow('NOT_FOUND');
    authMock.mockResolvedValue({ user: { email: 's@x.co', role: 'seller' } });
    await expect(requireStaffPage()).resolves.toMatchObject({ role: 'seller' });
    await expect(requireAdminPage()).rejects.toThrow('NOT_FOUND');
    authMock.mockResolvedValue({ user: { email: 'a@x.co', role: 'admin' } });
    await expect(requireAdminPage()).resolves.toBeUndefined();
    await expect(requireStaffPage()).resolves.toMatchObject({ role: 'admin' });
  });
});
