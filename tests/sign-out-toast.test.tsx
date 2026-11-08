// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { SignedOutToast, SIGNED_OUT_MS } from '@/components/SignedOutToast';

const at = (url: string) => window.history.replaceState(null, '', url);
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); at('/'); });

describe('sign-out confirmation', () => {
  it('shows for exactly signedout=1, as a status message, and cleans the URL keeping other params', () => {
    at('/?signedout=1&city=jaipur#shop');
    render(<SignedOutToast />);
    expect(screen.getByRole('status').textContent).toContain('You have signed out. See you soon.');
    expect(window.location.search).toBe('?city=jaipur');
    expect(window.location.hash).toBe('#shop');
  });
  it('does not show for other values or no param, and leaves the URL alone', () => {
    for (const q of ['', '?signedout=0', '?signedout=true', '?signedout=', '?signedout=11', '?x=signedout%3D1']) {
      at('/' + q);
      const { unmount } = render(<SignedOutToast />);
      expect(screen.queryByRole('status'), q).toBeNull();
      expect(window.location.search).toBe(q);
      unmount();
    }
  });
  it('disappears by itself after about five seconds', () => {
    at('/?signedout=1');
    render(<SignedOutToast />);
    act(() => { vi.advanceTimersByTime(SIGNED_OUT_MS - 100); });
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByRole('status')).toBeNull();
    expect(SIGNED_OUT_MS).toBe(5000);
  });
  it('can be dismissed', () => {
    at('/?signedout=1');
    render(<SignedOutToast />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('sign out wiring', () => {
  it('every signOut call lands on the home page with signedout=1', () => {
    const files = fs.readdirSync('src/components').filter(f => f.endsWith('.tsx')).map(f => 'src/components/' + f);
    let calls = 0;
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/signOut\(([^)]*)\)/g)) { calls++; expect(m[1], f).toContain("callbackUrl: '/?signedout=1'"); }
    }
    expect(calls).toBeGreaterThan(0);
  });
  it('the home page mounts the toast and does not read searchParams on the server', () => {
    const page = fs.readFileSync('src/app/page.tsx', 'utf8');
    expect(page).toContain('<SignedOutToast />');
    expect(page).not.toContain('searchParams');
  });
});
