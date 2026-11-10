// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

const session = vi.hoisted(() => ({ value: { data: null as any, status: 'unauthenticated' } }));
const signOut = vi.hoisted(() => vi.fn(async () => undefined));
const getSession = vi.hoisted(() => vi.fn());
vi.mock('next-auth/react', () => ({ useSession: () => session.value, signOut, getSession }));
import { SessionGuard } from '@/components/SessionGuard';

const realFetch = globalThis.fetch;
beforeEach(() => { signOut.mockClear(); getSession.mockReset(); session.value = { data: null, status: 'unauthenticated' }; });
afterEach(() => { cleanup(); window.fetch = realFetch; });

describe('SessionGuard', () => {
  it('does nothing for a signed-out or healthy session', () => {
    render(<SessionGuard />);
    session.value = { data: { user: { email: 'a@x.co' }, expires: 'x' }, status: 'authenticated' };
    render(<SessionGuard />);
    expect(signOut).not.toHaveBeenCalled();
  });
  it('signs out once (clearing the cookie, landing on home like the Logout button) when the session is revoked', async () => {
    session.value = { data: { revoked: true, expires: 'x' }, status: 'authenticated' };
    const { rerender } = render(<SessionGuard />);
    rerender(<SessionGuard />);
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/?signedout=1' });
  });
  it('a 401 from an /api call re-reads the session and signs out when it is revoked', async () => {
    window.fetch = vi.fn(async () => new Response('{}', { status: 401 })) as any;
    getSession.mockResolvedValue({ revoked: true, expires: 'x' });
    render(<SessionGuard />);
    await window.fetch('/api/orders');
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });
  it('a 401 for an ordinary anonymous visitor does not sign anything out, and /api/auth calls are ignored', async () => {
    window.fetch = vi.fn(async () => new Response('{}', { status: 401 })) as any;
    getSession.mockResolvedValue(null);
    render(<SessionGuard />);
    await window.fetch('/api/orders');
    await window.fetch('/api/auth/session');
    await new Promise(r => setTimeout(r, 20));
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });
});
