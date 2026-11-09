// @vitest-environment jsdom
import fs from 'node:fs';
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Loading from '@/app/loading';
import { readCss } from './helpers/css';

afterEach(cleanup);
const css = readCss();

describe('route loading state', () => {
  it('is a thin top progress bar, not a centred or blocking loader', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('.rr-page-loader')).toBeNull();
    expect(container.querySelector('.rr-route-bar')).toBeTruthy();
    const s = screen.getByRole('status');
    expect(s.textContent).toContain('Loading');
    expect(s.className).not.toContain('blocking');
  });
  it('the bar is fixed to the top edge, 3px tall, never intercepts clicks and has a reduced-motion variant', () => {
    expect(css).toMatch(/\.rr-route-bar\{[^}]*position:fixed;top:0;left:0;right:0;height:3px/);
    expect(css).toMatch(/\.rr-route-bar\{[^}]*pointer-events:none/);
    expect(css).not.toMatch(/\.rr-route-bar\{[^}]*background:var\(--veil\)/);
    expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\)\{\.rr-route-bar>span:not\(\.sr-only\)\{[^}]*animation:none/);
  });
});

describe('loader never covers the navbar', () => {
  it('the PageLoader overlay (kept for buttons and dashboard actions) starts below the navbar height, on desktop and mobile', () => {
    expect(css).toMatch(/\.rr-page-loader\{[^}]*top:var\(--topbar-h\)/);
    expect(css).toMatch(/:root\{--banner-h:38px;--topbar-h:116px\}/);
    expect(css).toMatch(/@media\(max-width:600px\)\{:root\{--topbar-h:105px\}\}/);
  });
  it('main keeps at least the visible height under the navbar, so the footer does not jump while a page loads', () => {
    expect(css).toMatch(/(^|[\s}])main\{[^}]*min-height:calc\(100svh - var\(--topbar-h\)\)/);
  });
});
