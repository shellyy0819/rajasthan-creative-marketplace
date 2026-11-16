// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('@/lib/catalog-wording', async orig => ({ ...(await orig<typeof import('@/lib/catalog-wording')>()), getCatalogWording: async () => ({ adjective: 'handmade', products: 'handmade products', finds: 'handmade finds', handmadeType: 'Handmade', stats: { products: 3, makers: 2, cities: 1 } }) })); // the real one reads the database
import { render, screen, cleanup } from '@testing-library/react';
import AboutPage from '@/app/about/page';
import BlogsPage from '@/app/blogs/page';
import ContactPage from '@/app/contact/page';
import HelpPage from '@/app/help/page';

afterEach(cleanup);

describe('info pages', () => {
  it.each([
    ['About us', 'Your city’s makers, within reach.', AboutPage, '/about'],
    ['Blogs', 'Stories from the makers.', BlogsPage, '/blogs'],
    ['Contact us', 'Say hello.', ContactPage, '/contact'],
    ['How it works', 'How Craftofy works.', HelpPage, '/help'],
  ])('%s has its heading and a breadcrumb ending on the page', async (crumb, h1, Page, path) => {
    const { container } = render(await (Page as unknown as (p: object) => Promise<React.ReactElement> | React.ReactElement)({}));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(h1);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).querySelector('[aria-current="page"]')?.textContent).toBe(crumb);
    expect(container.querySelector(`script[type="application/ld+json"]`)?.textContent).toContain(path);
  });
  it('the blogs page says posts are coming soon and links back to shop and workshops', async () => {
    render(await BlogsPage());
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /browse handmade/i }).getAttribute('href')).toBe('/shop');
    expect(screen.getByRole('link', { name: /workshop/i }).getAttribute('href')).toBe('/workshops');
  });
  it('the contact page gives hello.craftofy@gmail.com as a mailto link, and no longer says details are coming soon', () => {
    const { container } = render(<ContactPage />);
    const mail = screen.getByRole('link', { name: 'hello.craftofy@gmail.com' });
    expect(mail.getAttribute('href')).toBe('mailto:hello.craftofy@gmail.com');
    expect(container.textContent).not.toMatch(/coming soon|example/i);
  });
});
