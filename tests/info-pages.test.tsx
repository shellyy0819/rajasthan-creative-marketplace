// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
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
  ])('%s has its heading and a breadcrumb ending on the page', (crumb, h1, Page, path) => {
    const { container } = render(<Page />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(h1);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).querySelector('[aria-current="page"]')?.textContent).toBe(crumb);
    expect(container.querySelector(`script[type="application/ld+json"]`)?.textContent).toContain(path);
  });
  it('the blogs page says posts are coming soon and links back to shop and workshops', () => {
    render(<BlogsPage />);
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
