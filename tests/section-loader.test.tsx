// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SectionLoader } from '@/components/SectionLoader';
import { readCss } from './helpers/css';

afterEach(cleanup);
const css = readCss();

describe('SectionLoader', () => {
  it('is a busy status region with a visible spinner and the default label', () => {
    render(<SectionLoader />);
    const s = screen.getByRole('status');
    expect(s.getAttribute('aria-busy')).toBe('true');
    expect(s.textContent).toContain('Loading…');
    expect(s.querySelector('.rr-spinner')).toBeTruthy();
  });
  it('shows a custom label', () => {
    render(<SectionLoader label="Loading workshops…" variant="list" />);
    expect(screen.getByRole('status').textContent).toContain('Loading workshops…');
  });
  it('cards: the real product grid with product-card-sized skeletons, hidden from assistive tech', () => {
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
  it('skeletons match the real card proportions and stop animating for reduced motion', () => {
    expect(css).toMatch(/\.sk-visual\{height:205px/);   // same as .product-visual
    expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\)\{\.rr-route-bar>span:not\(\.sr-only\)\{[^}]*animation:none[^}]*\}\.sk-card,\.sk-row,\.rr-section-loader\.text \.sk-line\{animation:none\}/);
  });
  it('uses design tokens only (no hex colours) in its CSS', () => {
    const block = css.slice(css.indexOf('.rr-route-bar{'), css.indexOf('@media(prefers-reduced-motion:reduce){.rr-route-bar'));
    expect(block.length).toBeGreaterThan(200);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
