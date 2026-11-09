// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { ProductGallery, SLIDE_MS } from '@/components/ProductGallery';
import { readCss } from './helpers/css';

// jsdom has no PointerEvent: a MouseEvent subclass carries pointerType and pointerId through fireEvent.
beforeAll(() => {
  class PE extends MouseEvent {
    pointerType: string; pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerType = init.pointerType ?? 'mouse'; this.pointerId = init.pointerId ?? 1; }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PE;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const IMGS = ['https://x.example/1.jpg', 'https://x.example/2.jpg', 'https://x.example/3.jpg'];
const frame = () => screen.getByRole('group', { name: 'Product photos' });
const big = () => document.querySelector('.gallery-slide[data-active="true"] img.product-photo') as HTMLImageElement | null;
const thumbs = () => within(screen.getByRole('group', { name: 'Product photo thumbnails' })).queryAllByRole('button');
const dots = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.gallery-dot'));
const counter = () => document.querySelector('.gallery-count')!;
const mount = (images: string[]) => render(<ProductGallery images={images} alt="Crochet Bag" fallback={<span data-testid="fallback">🌷</span>} variant={2} />);
const cur = (els: Element[]) => els.map(b => b.getAttribute('aria-current'));
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
const prev = () => fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
const swipe = (dx: number, dy = 0, pointerType = 'touch') => {
  fireEvent.pointerDown(frame(), { clientX: 200, clientY: 100, pointerType, pointerId: 7 });
  fireEvent.pointerUp(frame(), { clientX: 200 + dx, clientY: 100 + dy, pointerType, pointerId: 7 });
};

describe('ProductGallery', () => {
  it('shows the first photo large with alt text naming its position, and one thumbnail per photo', () => {
    mount(IMGS);
    expect(big()!.getAttribute('src')).toBe(IMGS[0]);
    expect(big()!.getAttribute('alt')).toBe('Crochet Bag (photo 1 of 3)');
    expect(thumbs().map(b => b.getAttribute('aria-label'))).toEqual(['Show photo 1 of 3', 'Show photo 2 of 3', 'Show photo 3 of 3']);
    expect(cur(thumbs())).toEqual(['true', null, null]);
    for (const b of thumbs()) { expect((b as HTMLButtonElement).type).toBe('button'); expect(b.querySelector('img')!.getAttribute('alt')).toBe(''); }
  });
  it('one photo: no arrows, dots, counter, thumbnails or carousel role, and the plain alt text', () => {
    mount([IMGS[0]]);
    expect(big()!.getAttribute('src')).toBe(IMGS[0]);
    expect(big()!.getAttribute('alt')).toBe('Crochet Bag');
    expect(screen.queryByRole('button', { name: 'Next photo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Previous photo' })).toBeNull();
    expect(dots()).toHaveLength(0); expect(document.querySelector('.gallery-count')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Product photos' })).toBeNull();
    expect(document.querySelector('.gallery-thumbs')).toBeNull();
  });
  it('no photos show only the fallback', () => {
    mount([]);
    expect(screen.getByTestId('fallback')).toBeTruthy(); expect(document.querySelector('.gallery-arrow')).toBeNull();
  });
  it('several photos: a focusable carousel, slides labelled "N of M", arrows, dots and a counter', () => {
    mount(IMGS);
    expect(frame().getAttribute('aria-roledescription')).toBe('carousel');
    expect(frame().getAttribute('tabindex')).toBe('0');
    const slides = Array.from(document.querySelectorAll('.gallery-slide'));
    expect(slides.map(s => s.getAttribute('aria-label'))).toEqual(['1 of 3', '2 of 3', '3 of 3']);
    expect(slides.every(s => s.getAttribute('aria-roledescription') === 'slide' && s.getAttribute('role') === 'group')).toBe(true);
    expect(slides.map(s => s.getAttribute('aria-hidden'))).toEqual([null, 'true', 'true']);
    expect(dots()).toHaveLength(3);
    expect(dots().map(d => d.getAttribute('aria-label'))).toEqual(['Show photo 1 of 3', 'Show photo 2 of 3', 'Show photo 3 of 3']);
    expect(counter().textContent).toBe('1 / 3');
    expect(counter().getAttribute('aria-live')).toBe('polite');
  });
  it('next and previous move through the photos and wrap around at both ends', () => {
    mount(IMGS);
    prev(); expect(big()!.getAttribute('src')).toBe(IMGS[2]); expect(counter().textContent).toBe('3 / 3');
    next(); expect(big()!.getAttribute('src')).toBe(IMGS[0]); expect(counter().textContent).toBe('1 / 3');
    next(); expect(counter().textContent).toBe('2 / 3'); expect(big()!.getAttribute('alt')).toBe('Crochet Bag (photo 2 of 3)');
  });
  it('dots and thumbnails jump to a photo and the counter, dots and thumbnails stay in sync', () => {
    mount(IMGS);
    fireEvent.click(dots()[2]);
    expect(big()!.getAttribute('src')).toBe(IMGS[2]);
    expect(cur(dots())).toEqual([null, null, 'true']); expect(cur(thumbs())).toEqual([null, null, 'true']); expect(counter().textContent).toBe('3 / 3');
    fireEvent.click(thumbs()[1]);
    expect(big()!.getAttribute('src')).toBe(IMGS[1]);
    expect(cur(dots())).toEqual([null, 'true', null]); expect(cur(thumbs())).toEqual([null, 'true', null]); expect(counter().textContent).toBe('2 / 3');
    next();
    expect(cur(thumbs())).toEqual([null, null, 'true']);
  });
  it('keyboard: ArrowRight, ArrowLeft (wrapping), End and Home on the focused carousel', () => {
    mount(IMGS);
    fireEvent.keyDown(frame(), { key: 'ArrowLeft' }); expect(counter().textContent).toBe('3 / 3');
    fireEvent.keyDown(frame(), { key: 'ArrowRight' }); expect(counter().textContent).toBe('1 / 3');
    fireEvent.keyDown(frame(), { key: 'End' }); expect(counter().textContent).toBe('3 / 3');
    fireEvent.keyDown(frame(), { key: 'Home' }); expect(counter().textContent).toBe('1 / 3');
    fireEvent.keyDown(frame(), { key: 'a' }); expect(counter().textContent).toBe('1 / 3');
  });
  it('swipe: left goes next, right goes previous', () => {
    mount(IMGS);
    swipe(-80); expect(counter().textContent).toBe('2 / 3');
    swipe(80); expect(counter().textContent).toBe('1 / 3');
  });
  it('swipe: a tiny movement, a mostly vertical drag, a mouse drag and a drag that starts on an arrow do nothing', () => {
    mount(IMGS);
    swipe(-10); expect(counter().textContent).toBe('1 / 3');
    swipe(-30); expect(counter().textContent).toBe('1 / 3');
    swipe(-60, 80); expect(counter().textContent).toBe('1 / 3');
    swipe(-60, 50); expect(counter().textContent).toBe('1 / 3');
    swipe(-80, 0, 'mouse'); expect(counter().textContent).toBe('1 / 3');
    const arrow = screen.getByRole('button', { name: 'Next photo' });
    fireEvent.pointerDown(arrow, { clientX: 200, clientY: 100, pointerType: 'touch', pointerId: 7 });
    fireEvent.pointerUp(frame(), { clientX: 100, clientY: 100, pointerType: 'touch', pointerId: 7 });
    expect(counter().textContent).toBe('1 / 3');
  });
  it('a cancelled touch (the browser took over for scrolling) never swipes', () => {
    mount(IMGS);
    fireEvent.pointerDown(frame(), { clientX: 200, clientY: 100, pointerType: 'touch', pointerId: 7 });
    fireEvent.pointerCancel(frame(), { pointerType: 'touch', pointerId: 7 });
    fireEvent.pointerUp(frame(), { clientX: 100, clientY: 100, pointerType: 'touch', pointerId: 7 });
    expect(counter().textContent).toBe('1 / 3');
  });
  it('only the current and neighbouring photos are rendered eagerly; the rest wait until reached', () => {
    mount(['a', 'b', 'c', 'd', 'e'].map(x => `https://x.example/${x}.jpg`));
    const rendered = () => Array.from(document.querySelectorAll('img.product-photo')).map(i => [i.getAttribute('src')!.slice(-5, -4), i.getAttribute('loading')]);
    expect(rendered()).toEqual([['a', 'eager'], ['b', 'eager'], ['e', 'eager']]);
    fireEvent.click(dots()[2]);
    expect(rendered()).toEqual([['a', 'lazy'], ['b', 'eager'], ['c', 'eager'], ['d', 'eager']]); // e was never reached: not loaded; a was visited: kept
  });
  it('thumbnail row scrolls horizontally and the current thumbnail is brought into view', () => {
    mount(IMGS);
    const row = document.querySelector('.gallery-thumbs') as HTMLElement;
    const kids = Array.from(row.children) as HTMLElement[];
    Object.defineProperty(row, 'clientWidth', { value: 100 });
    kids.forEach((k, i) => { Object.defineProperty(k, 'offsetLeft', { value: i * 72 }); Object.defineProperty(k, 'offsetWidth', { value: 64 }); });
    next();
    expect(row.scrollLeft).toBe(72 - (100 - 64) / 2);
    const css = readCss();
    expect(css).toMatch(/\.gallery-thumbs\{[^}]*overflow-x:auto/);
    expect(css).toMatch(/\.gallery-thumbs\{[^}]*flex-wrap:nowrap/);
  });
  it('a large photo that fails to load falls back like a single image does', () => {
    mount(IMGS);
    fireEvent.error(big()!);
    expect(screen.getByTestId('fallback')).toBeTruthy();
  });
  it('keeps the visual variant class for the fallback colour', () => {
    mount([]);
    expect(document.querySelector('.detail-art')!.className).toContain('visual-2');
  });
  it('the product page uses the gallery and no longer renders a single ProductImage', () => {
    const src = fs.readFileSync('src/app/products/[slug]/page.tsx', 'utf8');
    expect(src).toContain('<ProductGallery');
    expect(src).not.toContain('<ProductImage');
  });

  describe('hover zoom', () => {
    const prepare = () => {
      mount(IMGS);
      const img = big()!;
      Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
      Object.defineProperty(img, 'naturalHeight', { value: 800, configurable: true });
      frame().getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON() {} }) as DOMRect;
    };
    const hover = (type: string, el: Element = frame()) => fireEvent.pointerMove(el, { clientX: 200, clientY: 200, pointerType: type });
    it('a mouse over the photo shows the lens and the pane', () => {
      prepare(); hover('mouse');
      expect(document.querySelector('.zoom-lens')).toBeTruthy(); expect(document.querySelector('.zoom-pane')).toBeTruthy();
    });
    it('touch and pen pointers never start the zoom', () => {
      prepare(); hover('touch'); hover('pen');
      expect(document.querySelector('.zoom-lens')).toBeNull(); expect(document.querySelector('.zoom-pane')).toBeNull();
    });
    it('hovering an arrow or the dots does not zoom, and leaving the photo closes it', () => {
      prepare();
      hover('mouse', screen.getByRole('button', { name: 'Next photo' })); expect(document.querySelector('.zoom-lens')).toBeNull();
      hover('mouse', dots()[0]); expect(document.querySelector('.zoom-lens')).toBeNull();
      hover('mouse'); expect(document.querySelector('.zoom-lens')).toBeTruthy();
      fireEvent.pointerLeave(frame()); expect(document.querySelector('.zoom-lens')).toBeNull();
    });
    it('the zoom is hidden while the slide transition runs and comes back after it', () => {
      vi.useFakeTimers();
      prepare(); hover('mouse'); expect(document.querySelector('.zoom-lens')).toBeTruthy();
      next();
      const img = big()!;
      Object.defineProperty(img, 'naturalWidth', { value: 800 }); Object.defineProperty(img, 'naturalHeight', { value: 800 });
      hover('mouse'); expect(document.querySelector('.zoom-lens')).toBeNull(); expect(document.querySelector('.zoom-pane')).toBeNull();
      act(() => { vi.advanceTimersByTime(SLIDE_MS + 10); });
      hover('mouse'); expect(document.querySelector('.zoom-lens')).toBeTruthy();
    });
  });

  it('reduced-motion contract: slides do not animate, and the fade is defined for normal motion', () => {
    const css = readCss();
    expect(css).toMatch(/\.gallery-slide\{[^}]*transition:opacity \.35s/);
    expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\)\{[^@]*\.gallery-slide,\.gallery-slide\[data-active=true\]\{transition:none\}/);
  });
  it('layout contract: stable frame, swipe keeps vertical scroll, arrows above the lens with a 44px target', () => {
    const css = readCss();
    expect(css).toMatch(/\.product-visual\.carousel\{touch-action:pan-y\}/);
    expect(css).toMatch(/\.gallery-arrow\{[^}]*z-index:3[^}]*width:44px;height:44px/);
    expect(css).toMatch(/\.zoom-lens\{[^}]*z-index:2/);
    expect(css).toMatch(/\.product-visual\.carousel:focus-visible\{outline:2px solid var\(--orange\)/);
  });
});
