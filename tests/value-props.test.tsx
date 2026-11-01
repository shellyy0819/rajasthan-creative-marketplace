// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { ValueProps } from '@/components/ValueProps';

afterEach(cleanup);

describe('ValueProps (home page promise strip)', () => {
  it('is a labelled region with a list of the three promises, each with a heading and a supporting line', () => {
    render(<ValueProps />);
    const region = screen.getByRole('region', { name: 'Why Craftology' });
    const items = within(region).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    for (const li of items) {
      expect(li.querySelector('h3')!.textContent!.trim().length).toBeGreaterThan(3); // wording is the owner's: check structure, not text
      expect(li.querySelector('p')!.textContent!.trim().length).toBeGreaterThan(10);
    }
    expect(new Set(items.map(li => li.querySelector('h3')!.textContent)).size).toBe(3);
  });
  it('decorative icons are hidden from screen readers and there are no links or buttons to tab through', () => {
    const { container } = render(<ValueProps />);
    const icons = container.querySelectorAll('svg');
    expect(icons).toHaveLength(3);
    for (const s of Array.from(icons)) expect(s.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('a, button')).toBeNull();
  });
  it('sits on the home page between the hero and the trending row', () => {
    const src = fs.readFileSync('src/app/page.tsx', 'utf8');
    expect(src.indexOf('<Hero />')).toBeGreaterThan(-1);
    expect(src.indexOf('<ValueProps />')).toBeGreaterThan(src.indexOf('<Hero />'));
    expect(src.indexOf('<TrendingSection />')).toBeGreaterThan(src.indexOf('<ValueProps />'));
  });
});
