import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Source contract for the layout fixes: the dashboard tab bar and the market trends admin page must never widen the page.
// (The real-browser check was done at 390, 700, 900, 1280 and 1490px; these pin the rules that made it pass.)
const norm = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
const site = norm(readFileSync('src/app/globals.css', 'utf8'));
const trends = norm(readFileSync('src/components/MarketTrendsAdmin.css', 'utf8'));
const rule = (sheet: string, selector: string) => new RegExp(`(?:^|[ }])${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(sheet)?.[1] ?? '';
const phone = (sheet: string, width: number) => new RegExp(`@media \\(max-width: ${width}px\\) \\{((?:[^{}]*\\{[^}]*\\} ?)*)\\}`, 'g');

describe('the dashboard tab bar', () => {
  it('wraps onto rows instead of running past the edge of the page', () => {
    const bar = rule(site, '.admin-tabs');
    expect(bar).toMatch(/display: flex;/);
    expect(bar).toMatch(/flex-wrap: wrap;/);
  });
  it('keeps each tab on one line and shows it even where the header rule hides a nav link on phones', () => {
    const tab = rule(site, '.admin-tabs a');
    expect(tab).toMatch(/display: inline-flex;/); // `nav > a { display: none }` at 600px would otherwise hide every tab
    expect(tab).toMatch(/white-space: nowrap;/);
  });
  it('scrolls inside itself in one row on a phone, with room for the focus ring', () => {
    const block = [...site.matchAll(phone(site, 700))].map(m => m[1]).join(' ');
    const bar = /\.admin-tabs \{([^}]*)\}/.exec(block)?.[1] ?? '';
    expect(bar).toMatch(/flex-wrap: nowrap;/);
    expect(bar).toMatch(/overflow-x: auto;/);
    expect(bar).toMatch(/padding: (\d+)px 5% (\d+)px;/);
    expect(/\.admin-tabs a \{([^}]*)\}/.exec(block)?.[1]).toMatch(/flex: none;[^}]*min-height: 44px;/);
  });
});

describe('the market trends admin page', () => {
  it('wraps long titles, sources and error text (with unbroken links) inside the card', () => {
    const main = rule(trends, '.trend-admin .admin-row-main');
    expect(main).toMatch(/min-width: 0;/);
    expect(main).toMatch(/overflow-wrap: anywhere;/);
  });
  it('keeps the digest picker inside its row', () => {
    expect(rule(trends, '.trend-admin .trend-bar select')).toMatch(/^ min-width: 0; max-width: 100%;/);
  });
  it('gives the phone toolbar and the buttons of a card or an item 44px tap targets', () => {
    const block = /@media \(max-width: 600px\) \{(.*)$/.exec(trends)?.[1] ?? '';
    expect(block).toMatch(/\.trend-admin \.trend-bar > \* \{ min-height: 44px;/);
    expect(block).toMatch(/\.trend-admin \.admin-row-actions > \.button,[^{]*\{ flex: 1 1 0; min-height: 44px;/);
  });
});
