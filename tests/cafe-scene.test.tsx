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
  it('the chalkboard says "Workshop live" when one workshop is live today', () => {
    const h = renderToStaticMarkup(<CafeScene liveCount={1} />);
    expect(h).toContain('>Workshop<');
    expect(h).toContain('>live<');
    expect(h).not.toContain('Stay Tuned!');
    expect(h).toContain('says Workshop live');
  });
  it('the chalkboard says "N workshops live" when several are', () => {
    const h = renderToStaticMarkup(<CafeScene liveCount={10} />);
    expect(h).toContain('>10 workshops<');
    expect(h).toContain('>live<');
    expect(h).toContain('says 10 workshops live');
    expect(renderToStaticMarkup(<CafeScene liveCount={2} />)).toContain('>2 workshops<');
  });
  it('a huge count is shown as 99+', () => {
    expect(renderToStaticMarkup(<CafeScene liveCount={250} />)).toContain('>99+ workshops<');
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
