// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ pathname: '/' as string | null }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
// the real Link would ask the router to navigate: here it is a plain link that keeps its onClick, so the test can see what the click did
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));

import { BrandLink } from '@/components/BrandLink';

const scrollTo = vi.fn();
const click = (init: MouseEventInit = {}) => { const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }); screen.getByRole('link', { name: 'Craftofy home' }).dispatchEvent(e); return e; };
beforeEach(() => { scrollTo.mockClear(); window.scrollTo = scrollTo as never; window.history.replaceState({}, '', '/'); nav.pathname = '/'; });
afterEach(cleanup);

describe('BrandLink (the logo)', () => {
  it('already on the home page, a click only scrolls to the top: it does not follow the link, so the page is not fetched and redrawn', () => {
    render(<BrandLink><span>logo</span></BrandLink>);
    const e = click();
    expect(e.defaultPrevented).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });
  it('is still an ordinary link to / (right for crawlers, keyboards and "open in new tab")', () => {
    render(<BrandLink><span>logo</span></BrandLink>);
    const a = screen.getByRole('link', { name: 'Craftofy home' });
    expect(a.getAttribute('href')).toBe('/');
    expect(a.className).toBe('brand');
  });
  it('on any other page it is a normal link: nothing is prevented, nothing scrolls by itself', () => {
    nav.pathname = '/shop';
    render(<BrandLink><span>logo</span></BrandLink>);
    expect(click().defaultPrevented).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it('on the home page with a query or a hash (for example ?day=…) the click still goes to the plain home page, which clears it', () => {
    render(<BrandLink><span>logo</span></BrandLink>);
    window.history.replaceState({}, '', '/?day=2026-11-04');
    expect(click().defaultPrevented).toBe(false);
    window.history.replaceState({}, '', '/#workshops');
    expect(click().defaultPrevented).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it('a click that means "open elsewhere" (Ctrl, Cmd, Shift, Alt or the middle button) is left alone', () => {
    render(<BrandLink><span>logo</span></BrandLink>);
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) expect(click(init).defaultPrevented).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it('scrolls without animation for people who asked for reduced motion', () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as never;
    render(<BrandLink><span>logo</span></BrandLink>);
    click();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
});
