// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
const staff = vi.hoisted(() => vi.fn());
vi.mock('@/lib/admin-page', () => ({ requireStaffPage: staff, requireAdminPage: vi.fn() }));
vi.mock('@/components/AdminTabs', () => ({ AdminTabs: () => <nav>tabs</nav> }));

import { GET } from '@/app/api/admin/version/route';
import DashboardLayout from '@/app/dashboard/layout';
import { BuildNote } from '@/components/BuildNote';
import { appVersion, formatBuiltAt } from '@/lib/version';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const as = (role: string | null) => authMock.mockResolvedValue(role ? { user: { email: `${role}@x.co`, role } } : null);
const withEnv = (c: string | undefined, b: string | undefined) => { vi.stubEnv('APP_COMMIT', c as string); vi.stubEnv('APP_BUILT_AT', b as string); };
beforeEach(() => { authMock.mockReset(); as(null); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('appVersion()', () => {
  it('reads the commit and build time the image was given, and shortens the commit to 7 characters', () => {
    expect(appVersion({ APP_COMMIT: SHA, APP_BUILT_AT: '2026-11-23T11:30:00Z', NODE_ENV: 'production' }))
      .toEqual({ commit: SHA, shortCommit: '0123456', builtAt: '2026-11-23T11:30:00.000Z', environment: 'production' });
  });
  it('says nothing (null) when the build was not told, and never makes a commit up in production', () => {
    expect(appVersion({ NODE_ENV: 'production' })).toMatchObject({ commit: null, shortCommit: null, builtAt: null });
    expect(appVersion({ APP_COMMIT: 'unknown', NODE_ENV: 'production' }).commit).toBeNull(); // what the Docker default says
  });
  it('ignores a value that is not a commit hash or a date, so nothing odd is ever printed', () => {
    const v = appVersion({ APP_COMMIT: '<script>alert(1)</script>', APP_BUILT_AT: 'yesterday', NODE_ENV: 'production' });
    expect(v).toMatchObject({ commit: null, builtAt: null });
  });
  it('formats the build time in UTC', () => {
    expect(formatBuiltAt('2026-11-23T11:30:00.000Z')).toBe('23 Nov 2026, 11:30 UTC');
  });
});

describe('GET /api/admin/version', () => {
  it('gives an admin the version, uncached', async () => {
    withEnv(SHA, '2026-11-23T11:30:00Z'); as('admin');
    const r = await GET();
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toMatchObject({ commit: SHA, shortCommit: '0123456', builtAt: '2026-11-23T11:30:00.000Z' });
  });
  it('turns away a visitor (401) and a seller or buyer (403), without leaking the commit', async () => {
    withEnv(SHA, undefined);
    as(null); const anon = await GET();
    expect(anon.status).toBe(401);
    for (const role of ['seller', 'buyer']) {
      as(role); const r = await GET();
      expect(r.status).toBe(403);
      expect(JSON.stringify(await r.json())).not.toContain(SHA);
    }
  });
});

describe('the dashboard footer line', () => {
  it('shows the short commit, with the full hash on hover, and the build time', () => {
    withEnv(SHA, '2026-11-23T11:30:00Z');
    render(<BuildNote />);
    const code = screen.getByText('0123456');
    expect(code.getAttribute('title')).toBe(SHA);
    expect(screen.getByLabelText('Build version').textContent).toBe('Version 0123456 · built 23 Nov 2026, 11:30 UTC');
  });
  it('admits it does not know, instead of leaving a gap, when the build was not told', () => {
    withEnv(undefined, undefined); vi.stubEnv('NODE_ENV', 'production');
    render(<BuildNote />);
    expect(screen.getByLabelText('Build version').textContent).toMatch(/Version unknown/);
  });
  it('is in the admin dashboard but not in a seller’s', async () => {
    withEnv(SHA, undefined);
    staff.mockResolvedValue({ role: 'admin' });
    render(await DashboardLayout({ children: <p>page</p> }));
    expect(screen.getByLabelText('Build version')).toBeTruthy();
    cleanup();
    staff.mockResolvedValue({ role: 'seller' });
    render(await DashboardLayout({ children: <p>page</p> }));
    expect(screen.queryByLabelText('Build version')).toBeNull();
    expect(document.body.textContent).not.toContain('0123456');
  });
});

describe('no public page can show it', () => {
  it('the version is read only by the admin route and the dashboard layout', async () => {
    const { execFileSync } = await import('node:child_process');
    const out = execFileSync('grep', ['-rlE', "lib/version'|BuildNote", 'src'], { encoding: 'utf8' }).split('\n').filter(Boolean).sort();
    expect(out).toEqual(['src/app/api/admin/version/route.ts', 'src/app/dashboard/layout.tsx', 'src/components/BuildNote.tsx']);
  });
});
