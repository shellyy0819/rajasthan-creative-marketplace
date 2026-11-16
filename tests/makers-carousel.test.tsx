// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
import { MakersCarousel, MAKERS_ROTATE_MS } from '@/components/MakersCarousel';
import { readCss } from './helpers/css';
import type { HomeMaker } from '@/lib/makers';

const makers: HomeMaker[] = [
  { slug: 'alpha-studio-aaaaaaaa', name: 'Alpha Studio', categories: ['Pottery', 'Resin Art'], city: 'Jaipur', quote: 'Glazed by hand.' },
  { slug: 'bravo-studio-bbbbbbbb', name: 'Bravo Studio', categories: [] },
  { slug: 'charlie-studio-cccccccc', name: 'Charlie Studio', categories: ['Textiles'] },
];
const scrollTo = vi.fn();
const reduced = (v: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: v && q.includes('reduce'), addEventListener() {}, removeEventListener() {}, media: q }));

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
  reduced(false); scrollTo.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const rail = () => document.querySelector('.makers-rail') as HTMLElement;

describe('MakersCarousel', () => {
  it('shows each maker with only what they have, and links to their shop', () => {
    render(<MakersCarousel makers={makers} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Alpha Studio' })).toBeTruthy();
    expect(screen.getByText('Pottery')).toBeTruthy();
    expect(screen.getByText('Resin Art')).toBeTruthy();
    expect(document.querySelectorAll('.maker-tags')).toHaveLength(2);
    expect(screen.getByText('“Glazed by hand.”')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Details/ }).map(a => a.getAttribute('href'))).toEqual(makers.map(m => `/artists/${m.slug}`));
    expect(document.querySelectorAll('.maker-quote')).toHaveLength(1);
  });
  it('moves to the next maker every second and wraps to the first at the end', () => {
    render(<MakersCarousel makers={makers} />);
    tick(MAKERS_ROTATE_MS);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 800, behavior: 'smooth' });
    rail().scrollLeft = 1600; fireEvent.scroll(rail());
    tick(MAKERS_ROTATE_MS);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
  });
  it('rests while hovered, then resumes shortly after the pointer leaves', () => {
    render(<MakersCarousel makers={makers} />);
    fireEvent.pointerEnter(rail());
    tick(MAKERS_ROTATE_MS * 3);
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.pointerLeave(rail());
    tick(MAKERS_ROTATE_MS * 3);
    expect(scrollTo).toHaveBeenCalled();
  });
  it('has no pause button', () => {
    render(<MakersCarousel makers={makers} />);
    expect(screen.queryByRole('button', { name: /pause|play/i })).toBeNull();
  });
  it('never rotates by itself for visitors who asked for reduced motion', () => {
    reduced(true);
    render(<MakersCarousel makers={makers} />);
    tick(MAKERS_ROTATE_MS * 5);
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it('has no controls to rotate with a single maker', () => {
    render(<MakersCarousel makers={makers.slice(0, 1)} />);
    expect(screen.queryByRole('button', { name: 'Next maker' })).toBeNull();
    tick(MAKERS_ROTATE_MS * 3);
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it('styles with the site tokens only: no literal font names or new hex colours in its CSS', () => {
    const css = readCss();
    const block = css.slice(css.indexOf('.makers-nav{'));
    expect(block).not.toMatch(/font(-family)?:[^;]*\b(DM Sans|Arial|Georgia)\b/);
    expect(block.replace(/#28190a38/, '')).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe('MakersCarousel: the time an admin chooses', () => {
  it('moves on after the seconds it was given, not the default', () => {
    render(<MakersCarousel makers={makers} rotateSeconds={12} />);
    tick(11_000); expect(scrollTo).not.toHaveBeenCalled();
    tick(1_000); expect(scrollTo).toHaveBeenCalledTimes(1);
  });
  it('uses the default when the value is missing or out of range', () => {
    render(<MakersCarousel makers={makers} rotateSeconds={0} />);
    tick(MAKERS_ROTATE_MS - 1); expect(scrollTo).not.toHaveBeenCalled();
    tick(1); expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
