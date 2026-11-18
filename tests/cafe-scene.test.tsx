import fs from 'node:fs';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CafeScene } from '@/components/CafeScene';

describe('CafeScene', () => {
  it('is a labelled picture of people working at a table in a café', () => {
    const h = renderToStaticMarkup(<CafeScene />);
    expect(h).toMatch(/<svg[^>]*role="img"[^>]*aria-label="[^"]*café[^"]*"/);
    expect(h).toContain('viewBox="0 0 560 420"');
  });
  it('the chalkboard says "Stay Tuned!" when no workshop is hosted today', () => {
    const h = renderToStaticMarkup(<CafeScene />);
    expect(h).toContain('>Stay Tuned!<');
    expect(h).not.toContain('Workshop today');
    expect(h).not.toContain('Workshop</text>');
  });
  it('the chalkboard says "Workshop today" when one is', () => {
    const h = renderToStaticMarkup(<CafeScene workshopToday />);
    expect(h).toContain('>Workshop<');
    expect(h).toContain('>today<');
    expect(h).not.toContain('Stay Tuned!');
  });
  it('colours come from classes (so light and dark follow the site theme), never hard-coded in the markup', () => {
    const h = renderToStaticMarkup(<CafeScene />);
    expect(h).not.toMatch(/(fill|stroke)="#/i);
    expect(h).not.toMatch(/style=/i);
    expect(h).not.toMatch(/font-family/i);
  });
  it('its stylesheet defines a light and a dark palette and no font name', () => {
    const css = fs.readFileSync('src/components/CafeScene.css', 'utf8');
    expect(css).toMatch(/prefers-color-scheme: dark/);
    expect(css).toMatch(/\[data-theme="dark"\]/);
    expect(css).not.toMatch(/font-family\s*:\s*['"A-Za-z]/);
  });
});
