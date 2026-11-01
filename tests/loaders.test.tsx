// @vitest-environment jsdom
import fs from 'node:fs';
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PageLoader } from '@/components/PageLoader';
import { readCss } from './helpers/css';

afterEach(cleanup);
const css = readCss();

describe('PageLoader', () => {
  it('renders nothing when idle', () => {
    render(<PageLoader show={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('shows a centred spinner with a polite status label while pending', () => {
    render(<PageLoader show label="Updating status…" />);
    const s = screen.getByRole('status');
    expect(s.textContent).toContain('Updating status…');
    expect(s.getAttribute('aria-live')).toBe('polite');
    expect(s.className).toContain('blocking');
  });
  it('defaults the label to "Loading…" and can be non-blocking (so typing and clicking keep working)', () => {
    render(<PageLoader show blocking={false} />);
    const s = screen.getByRole('status');
    expect(s.textContent).toContain('Loading…');
    expect(s.className).not.toContain('blocking');
  });
});

describe('loader styles', () => {
  it('a busy button shows a spinner on its right side and cannot be clicked', () => {
    expect(css).toMatch(/button\[aria-busy=['"]?true['"]?\]::after\{[^}]*right:\s*\d+px/);
    expect(css).toMatch(/button\[aria-busy=['"]?true['"]?\]\{[^}]*pointer-events:none/);
    expect(css).toMatch(/@keyframes rr-spin/);
  });
  it('the page loader is fixed, centred and respects reduced motion', () => {
    expect(css).toMatch(/\.rr-page-loader\{[^}]*position:fixed/);
    expect(css).toMatch(/\.rr-page-loader[^{]*\{[^}]*place-items:center|\.rr-page-loader\{[^}]*align-items:center/);
    expect(css).toMatch(/prefers-reduced-motion[^}]*\{[^}]*rr-spin|prefers-reduced-motion:reduce\)\{[^@]*animation-duration/);
  });
});
