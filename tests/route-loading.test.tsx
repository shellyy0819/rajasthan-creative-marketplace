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
  it('shows a status spinner while a page streams in, without blocking clicks', () => {
    render(<Loading />);
    const s = screen.getByRole('status');
    expect(s.textContent).toContain('Loading');
    expect(s.className).not.toContain('blocking');
  });
});

describe('loader never covers the navbar', () => {
  it('the overlay starts below the navbar height, on desktop and mobile', () => {
    expect(css).toMatch(/\.rr-page-loader\{[^}]*top:var\(--header-h\)/); // the header is sticky at top:0, so the overlay clears the header only
    expect(css).toMatch(/:root\{--banner-h:38px;--header-h:78px;--topbar-h:116px\}/);
    expect(css).toMatch(/@media\(max-width:600px\)\{:root\{--header-h:67px;--topbar-h:105px\}\}/);
  });
  it('main keeps at least the visible height under the navbar, so the footer does not jump while a page loads', () => {
    expect(css).toMatch(/(^|[\s}])main\{[^}]*min-height:calc\(100svh - var\(--topbar-h\)\)/);
  });
});
