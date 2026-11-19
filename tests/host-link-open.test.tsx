// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

let pathname: string | null = '/workshops';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/components/CityInput', () => ({ CityInput: () => <input name="cityRef" /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => <div /> }));

import { HostLink } from '@/components/HostLink';
import { HostWorkshopButton } from '@/components/HostWorkshopButton';

const dialog = () => screen.queryByRole('dialog');
const title = () => dialog()?.querySelector('h2')?.textContent;
const page = () => render(
  <>
    <HostWorkshopButton shareable reminderTarget />
    <nav>
      <HostLink href="/workshops?type=in-person" path="event">Want to host a workshop?</HostLink>
      <HostLink href="/workshops?type=online" path="class">Teach an online class</HostLink>
    </nav>
  </>,
);
const click = (name: string) => fireEvent.click(screen.getByRole('link', { name }));
/** Clicks a link and reports whether our handler left the default (navigation) alone; the browser default is then cancelled so jsdom does not try to navigate. */
const clickLeavesNavigation = (name: string, init?: MouseEventInit) => {
  let prevented = false;
  const spy = (e: Event) => { prevented = e.defaultPrevented; e.preventDefault(); };
  document.addEventListener('click', spy, { once: true });
  fireEvent.click(screen.getByRole('link', { name }), init);
  return !prevented;
};
const close = () => fireEvent.click(screen.getByRole('button', { name: 'Close' }));

describe('footer host links on /workshops open the form in place', () => {
  beforeEach(() => { pathname = '/workshops'; window.history.replaceState(null, '', '/workshops'); window.localStorage.clear(); });
  afterEach(cleanup);

  it('opens the in-person form every time the link is clicked, not just the first time', () => {
    page();
    for (let i = 0; i < 3; i++) {
      click('Want to host a workshop?');
      expect(title()).toBe('Host a workshop or pop-up');
      close();
      expect(dialog()).toBeNull();
    }
  });

  it('opens the online class form every time, and each link starts on its own path', () => {
    page();
    click('Teach an online class');
    expect(title()).toBe('Teach an online class');
    close();
    click('Want to host a workshop?');
    expect(title()).toBe('Host a workshop or pop-up');
    close();
    click('Teach an online class');
    expect(title()).toBe('Teach an online class');
  });

  it('does not navigate or reload: the click is cancelled and the address bar only gains ?type= while the form is open', () => {
    page();
    const notCancelled = fireEvent.click(screen.getByRole('link', { name: 'Teach an online class' }));
    expect(notCancelled).toBe(false); // preventDefault: no navigation, so no server request for the page
    expect(window.location.search).toBe('?type=online');
    close();
    expect(window.location.search).toBe('');
  });

  it('opens one form only', () => {
    page();
    click('Want to host a workshop?');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('leaves modified clicks (new tab) to the browser', () => {
    page();
    expect(clickLeavesNavigation('Want to host a workshop?', { ctrlKey: true })).toBe(true);
    expect(dialog()).toBeNull();
  });
});

describe('footer host links on other pages', () => {
  afterEach(cleanup);
  it('stay normal links to /workshops?type=… (that page loads its own data and opens the form)', () => {
    pathname = '/';
    page();
    const link = screen.getByRole('link', { name: 'Teach an online class' });
    expect(link.getAttribute('href')).toBe('/workshops?type=online');
    expect(clickLeavesNavigation('Teach an online class')).toBe(true); // not cancelled: the browser/router navigates
    expect(dialog()).toBeNull();
  });
  it('treat a workshop detail page as another page', () => {
    pathname = '/workshops/some-workshop';
    page();
    expect(clickLeavesNavigation('Want to host a workshop?')).toBe(true);
  });
});
