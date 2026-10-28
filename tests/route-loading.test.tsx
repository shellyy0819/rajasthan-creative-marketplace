// @vitest-environment jsdom
import fs from 'node:fs';
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Loading from '@/app/loading';

afterEach(cleanup);
const css = fs.readFileSync('src/app/globals.css', 'utf8');

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
    expect(css).toMatch(/\.rr-page-loader\{[^}]*top:var\(--topbar-h\)/);
    expect(css).toMatch(/:root\{--topbar-h:78px\}/);
    expect(css).toMatch(/@media\(max-width:600px\)\{:root\{--topbar-h:67px\}\}/);
  });
  it('main keeps at least the visible height under the navbar, so the footer does not jump while a page loads', () => {
    expect(css).toMatch(/(^|\n)main\{[^}]*min-height:calc\(100svh - var\(--topbar-h\)\)/);
  });
});
