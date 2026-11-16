// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SITE } from '@/lib/site';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
import { ExploreLink, Hero } from '@/components/Hero';
import { describeCatalog } from '@/lib/catalog-wording';


const HANDMADE = describeCatalog([{ name: 'Handmade', countsAsHandmade: true, count: 5 }], 0, { products: 5, makers: 2, cities: 1 });
const MIXED = describeCatalog([{ name: 'Handmade', countsAsHandmade: true, count: 5 }, { name: 'Curated', countsAsHandmade: false, count: 2 }], 0, { products: 7, makers: 2, cities: 1 });

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
    expect(container.querySelectorAll('a[href^="/shop"]')).toHaveLength(1);   
    expect(container.querySelectorAll('a[href="/workshops"]')).toHaveLength(1);
  });
  it('has exactly one h1 with the three-part headline', () => {
    render(<Hero />);
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe('Discover the Craft. Meet the Maker. Learn the Art.');
  });
  it('with no data the supporting text claims nothing about how the products are sourced', () => {
    render(<Hero />);
    expect(screen.getByText("Shop thoughtfully curated products from India's independent artisans and book hands-on workshops to experience traditional crafts firsthand.")).toBeTruthy();
    // The stall illustration's own caption is a drawing, not page copy.
    expect(document.querySelector('.hero-copy')!.textContent).not.toMatch(/handmade/i);
    expect(document.querySelector('section.intro')!.textContent).not.toMatch(/handmade/i);
  });
  it('shows the wording it is given once the catalogue is known', () => {
    render(<Hero products={HANDMADE.products} finds={HANDMADE.finds} />);
    expect(screen.getByText(/curated handmade products from India/)).toBeTruthy();
    cleanup();
    render(<Hero products={MIXED.products} />);
    expect(screen.getByText(/curated handmade and curated products from India/)).toBeTruthy();
  });
  it('has two main buttons: Explore (the shop, filtered to the handmade type once known) and Find a Workshop', () => {
    render(<Hero />);
    expect(screen.getByRole('link', { name: /Explore the Shop/ }).getAttribute('href')).toBe('/shop');
    cleanup();
    render(<Hero explore={<ExploreLink wording={HANDMADE} />} />);
    const explore = screen.getByRole('link', { name: /Explore Handmade/ });
    const find = screen.getByRole('link', { name: /Find a Workshop/ });
    expect(explore.getAttribute('href')).toBe('/shop?source=Handmade');
    expect(find.getAttribute('href')).toBe('/workshops');
    expect(explore.className).toContain('button');
    expect(find.className).toContain('button');
    expect(explore.className).toContain('primary');
    expect(find.className).not.toContain('primary'); // outline style: primary and secondary read differently
  });
  it('renders the art it is given in place of the plain stall', () => {
    render(<Hero art={<svg data-testid="themed" />} />);
    expect(screen.getByTestId('themed')).toBeTruthy();
    expect(document.querySelector('.hero-stall')).toBeNull();
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
