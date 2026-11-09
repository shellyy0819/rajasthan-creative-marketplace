// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SectionLoader } from '@/components/SectionLoader';
import { readCss } from './helpers/css';

afterEach(cleanup);
const css = readCss();
const rule = (selector: string) => {
  const i = css.indexOf(`${selector}{`);
  expect(i, `rule ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf('}', i));
};

describe('SectionLoader', () => {
  it('has one polite status line with the label, no redundant aria-live, and marks the loading region aria-busy (not the status)', () => {
    const { container } = render(<SectionLoader />);
    const s = screen.getByRole('status');
    expect(s.textContent).toBe('Loading…');
    expect(s.hasAttribute('aria-busy')).toBe(false);
    expect(s.hasAttribute('aria-live')).toBe(false);
    expect(container.querySelector('.rr-section-loader')!.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('.rr-spinner')).toBeTruthy();
    expect(container.querySelector('.rr-section-loader-head')!.getAttribute('aria-hidden')).toBe('true');
  });
  it('announce={false} renders no status, so several loaders on one page announce once', () => {
    render(<><SectionLoader /><SectionLoader variant="list" announce={false} /></>);
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
  it('shows a custom label', () => {
    render(<SectionLoader label="Loading workshops…" variant="list" />);
    expect(screen.getByRole('status').textContent).toBe('Loading workshops…');
  });
  it('cards: the real product grid with 3/4 skeleton cards, hidden from assistive tech', () => {
    const { container } = render(<SectionLoader variant="cards" />);
    const grid = container.querySelector('.product-grid')!;
    expect(grid.getAttribute('aria-hidden')).toBe('true');
    expect(grid.querySelectorAll('.sk-card')).toHaveLength(4);
    expect(container.querySelector('.workshop-list')).toBeNull();
  });
  it('list: rows in the workshop list; text: plain lines; count is honoured', () => {
    const list = render(<SectionLoader variant="list" count={2} />).container;
    expect(list.querySelectorAll('.workshop-list .sk-row')).toHaveLength(2);
    cleanup();
    const text = render(<SectionLoader variant="text" count={5} />).container;
    expect(text.querySelectorAll('.sk-line')).toHaveLength(5);
    expect(text.querySelector('.product-grid')).toBeNull();
  });
  it('withFilters adds a filter-bar placeholder; without it there is none', () => {
    expect(render(<SectionLoader withFilters />).container.querySelectorAll('.sk-filters .sk-control')).toHaveLength(3);
    cleanup();
    expect(render(<SectionLoader />).container.querySelector('.sk-filters')).toBeNull();
  });
});

describe('skeleton CSS contract', () => {
  it('the card skeleton copies the real product card: 3/4, 22px radius (18px on phones), no border', () => {
    expect(rule('.sk-card')).toMatch(/aspect-ratio:3 \/ 4/);
    expect(rule('.sk-card')).toMatch(/border-radius:22px/);
    expect(rule('.sk-card')).not.toMatch(/border:/);
    expect(rule('.sk-card')).toMatch(/justify-content:flex-end/);
    expect(css).toMatch(/@media\(max-width:600px\)\{\.sk-card\{border-radius:18px\}/);
    expect(css).toMatch(/\.product-card\{[^}]*aspect-ratio:3 \/ 4;[^}]*border-radius:22px/);
  });
  it('the row skeleton copies the workshop card columns, desktop and phone', () => {
    expect(rule('.sk-row')).toMatch(/grid-template-columns:78px 1fr auto/);
    expect(rule('.sk-row')).toMatch(/padding:17px/);
    expect(css).toMatch(/@media\(max-width:600px\)\{[^@]*\.sk-row\{grid-template-columns:58px 1fr;gap:11px;padding:12px\}/);
  });
  it('the filter placeholder wraps like the real filters on phones', () => {
    expect(css).toMatch(/\.sk-filters\{flex-wrap:wrap\}\.sk-filters \.sk-search\{flex-basis:100%\}/);
  });
  it('each animated skeleton selector is switched off for reduced motion', () => {
    const blocks = css.split('@media(prefers-reduced-motion:reduce){').slice(1).map(b => b.slice(0, b.indexOf('}}') + 1));
    const reduced = blocks.join('');
    for (const sel of ['.rr-route-bar>span:not(.sr-only)', '.sk-card', '.sk-row', '.rr-section-loader.text .sk-line']) expect(reduced, sel).toContain(sel);
    expect(reduced).toMatch(/animation:none/);
  });
  it('uses design tokens only (no hex colours) in its CSS', () => {
    const block = css.slice(css.indexOf('.rr-route-bar{'), css.indexOf('@media(prefers-reduced-motion:reduce){.rr-route-bar'));
    expect(block.length).toBeGreaterThan(200);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
