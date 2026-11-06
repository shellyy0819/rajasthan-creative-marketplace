// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
import ComingSoonPage, { metadata } from '@/app/coming-soon/page';

const saved = process.env.CONTACT_EMAIL;
afterEach(() => { cleanup(); if (saved === undefined) delete process.env.CONTACT_EMAIL; else process.env.CONTACT_EMAIL = saved; });

describe('coming soon page', () => {
  it('has one h1 and tells visitors the stall is opening soon', () => {
    const { container } = render(<ComingSoonPage />);
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe('Our stall is almost ready.');
    expect(container.querySelector('.eyebrow')?.textContent).toBe('OPENING SOON');
  });
  it('offers an interest email (from CONTACT_EMAIL) and a way to learn how the marketplace works', () => {
    process.env.CONTACT_EMAIL = 'hello@craftofy.in';
    render(<ComingSoonPage />);
    const interest = screen.getByRole('link', { name: /Tell us you.re interested/ });
    expect(interest.getAttribute('href')).toContain('mailto:hello@craftofy.in');
    expect(screen.getByText('hello@craftofy.in')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See how it works' }).getAttribute('href')).toBe('/help');
  });
  it('without CONTACT_EMAIL it uses craftofy.online@gmail.com', () => {
    delete process.env.CONTACT_EMAIL;
    const { container } = render(<ComingSoonPage />);
    expect(screen.getByRole('link', { name: /Tell us you.re interested/ }).getAttribute('href')).toContain('mailto:craftofy.online@gmail.com');
    expect(container.textContent).toContain('craftofy.online@gmail.com');
    expect(screen.getByRole('link', { name: 'Say hello' }).getAttribute('href')).toContain('mailto:craftofy.online@gmail.com');
    expect(container.textContent).not.toMatch(/example/);
  });
  it('keeps the illustration decorative and the page out of search results', () => {
    const { container } = render(<ComingSoonPage />);
    expect(container.querySelector('.hero-art')?.getAttribute('aria-hidden')).toBe('true');
    expect(metadata.robots).toMatchObject({ index: false });
  });
});
