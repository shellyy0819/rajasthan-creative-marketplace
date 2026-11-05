// @vitest-environment jsdom
import fs from 'node:fs';
import React from 'react';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SplashScreen } from '@/components/SplashScreen';
import { SPLASH_KEY, splashInitScript, themeInitScript } from '@/lib/init-scripts';

beforeEach(() => { sessionStorage.clear(); document.documentElement.removeAttribute('data-splash'); });
afterEach(cleanup);

describe('phone splash screen', () => {
  it('is decorative and carries both theme variants of the splash image', () => {
    const { container } = render(<SplashScreen />);
    const root = container.querySelector('.splash')!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('.splash-light')?.getAttribute('src')).toBe('/splash/screen-color-1080x1920.png');
    expect(root.querySelector('.splash-dark')?.getAttribute('src')).toBe('/splash/screen-dark-1080x1920.png');
  });
  it('remembers it was shown, and the head script then marks the page so it is not shown again this session', () => {
    render(<SplashScreen />);
    expect(sessionStorage.getItem(SPLASH_KEY)).toBe('1');
    new Function(splashInitScript)();
    expect(document.documentElement.getAttribute('data-splash')).toBe('seen');
  });
  it('first visit: the head script leaves the page unmarked', () => {
    new Function(splashInitScript)();
    expect(document.documentElement.getAttribute('data-splash')).toBeNull();
  });
  it('only phones get it, and it hides itself in CSS so no-JS visitors are never stuck', () => {
    const css = fs.readFileSync('src/app/globals.css', 'utf8');
    expect(css).toMatch(/@media \(max-width: 600px\) \{\s*html:not\(\[data-splash="seen"\]\) \.splash \{[^}]*animation: splash-out/);
    expect(css).toMatch(/@keyframes splash-out[^}]*\{[^}]*visibility: hidden/);
  });
  it('the head scripts are plain strings (a client-module export would reach the server layout as a function stub)', () => {
    expect(typeof themeInitScript).toBe('string');
    expect(typeof splashInitScript).toBe('string');
    expect(fs.readFileSync('src/app/layout.tsx', 'utf8')).toContain("from '@/lib/init-scripts'");
  });
  it('the splash images exist', () => {
    for (const f of ['screen-color-1080x1920', 'screen-dark-1080x1920', 'screen-color-1284x2778', 'screen-dark-1284x2778']) expect(fs.existsSync(`public/splash/${f}.png`)).toBe(true);
  });
});
