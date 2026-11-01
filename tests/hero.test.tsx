// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SITE } from '@/lib/site';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
import { Hero } from '@/components/Hero';

afterEach(cleanup);

describe('homepage hero', () => {
  it('second section: "Shop unique. Support Craftpreneurs." is a statement with no buttons of its own', () => {
    const { container } = render(<Hero />);
    const intro = container.querySelector('section.intro') as HTMLElement;
    expect(intro.querySelector('h2')?.textContent).toBe('Shop unique. Support Craftpreneurs.');
    expect(intro.textContent).toContain('independent Craftpreneurs');
    expect(intro.querySelector('a, button')).toBeNull(); // the hero buttons above already lead to the shop and workshops
  });
  it('each destination is offered once: one link to the shop and one to workshops in the whole hero block', () => {
    const { container } = render(<Hero />);
    expect(container.querySelectorAll('a[href="/shop"]')).toHaveLength(1);
    expect(container.querySelectorAll('a[href="/workshops"]')).toHaveLength(1);
  });
  it('has exactly one h1 with the three-part headline', () => {
    render(<Hero />);
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe('Discover the Craft. Meet the Maker. Learn the Art.');
  });
  it('shows the supporting text', () => {
    render(<Hero />);
    expect(screen.getByText("Shop thoughtfully curated handmade products from India's independent artisans and book hands-on workshops to experience traditional crafts firsthand.")).toBeTruthy();
  });
  it('has two main buttons: Explore Handmade (shop) and Find a Workshop (workshops)', () => {
    render(<Hero />);
    const explore = screen.getByRole('link', { name: /Explore Handmade/ });
    const find = screen.getByRole('link', { name: /Find a Workshop/ });
    expect(explore.getAttribute('href')).toBe('/shop');
    expect(find.getAttribute('href')).toBe('/workshops');
    expect(explore.className).toContain('button');
    expect(find.className).toContain('button');
    expect(explore.className).toContain('primary');
    expect(find.className).not.toContain('primary'); // outline style: primary and secondary read differently
  });
});

describe('site metadata copy', () => {
  it('the meta description stays within the SEO limit and matches the new message', () => {
    expect(SITE.description.length).toBeGreaterThan(20);
    expect(SITE.description.length).toBeLessThanOrEqual(160);
    expect(SITE.description).toMatch(/handmade/i);
    expect(SITE.description).toMatch(/workshops/i);
  });
});
