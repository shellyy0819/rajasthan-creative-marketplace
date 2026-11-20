// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://www.craftofy.online/products/blue-vase-p21?city=jaipur"}
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ga = vi.hoisted(() => ({ gaEvent: vi.fn() }));
vi.mock('@/lib/analytics', () => ga);

import { ShareButton } from '@/components/ShareButton';

const write = vi.fn();
const base = { path: '/products/blue-vase-p21', title: 'Blue Pottery Vase', kind: 'product' as const, by: 'Meera Studio', subtitle: 'Meera Studio · Jaipur', itemId: 'p21' };
const open = () => { render(<ShareButton {...base} />); fireEvent.click(screen.getByRole('button', { name: /^share$/i })); return screen.getByRole('dialog'); };
const setDevice = (share: unknown, coarse: boolean) => {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  window.matchMedia = ((q: string) => ({ matches: coarse && q.includes('coarse'), media: q, addEventListener() {}, removeEventListener() {} })) as never;
};
const noNav = (el: HTMLElement) => el.addEventListener('click', e => e.preventDefault());   // jsdom cannot navigate; the click is still reported

beforeEach(() => {
  ga.gaEvent.mockClear(); write.mockReset(); write.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
  setDevice(undefined, false);
});
afterEach(cleanup);

describe('ShareButton: the sheet', () => {
  it('shows a Share button and no dialog until it is pressed (on every device: it never jumps straight to the phone\'s sheet)', () => {
    setDevice(vi.fn(), true);
    render(<ShareButton {...base} />);
    const b = screen.getByRole('button', { name: /^share$/i });
    expect(b.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(b);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('is named for the kind of page and shows what is being shared', () => {
    const d = open();
    expect(within(d).getByRole('heading', { name: 'Share this find' })).toBeTruthy();
    expect(within(d).getByText('Blue Pottery Vase')).toBeTruthy();
    expect(within(d).getByText('Meera Studio · Jaipur')).toBeTruthy();
    cleanup();
    render(<ShareButton path="/workshops/clay-w3" title="Clay Basics" kind="workshop" />);
    fireEvent.click(screen.getByRole('button', { name: /^share$/i }));
    expect(screen.getByRole('heading', { name: 'Share this workshop' })).toBeTruthy();
  });

  it('on a computer the main row is WhatsApp, Copy, Email and More (Messages is for phones and tablets)', () => {
    const d = open();
    const labels = [...d.querySelectorAll('.share-tiles > .share-tile')].map(e => e.textContent?.trim());
    expect(labels).toEqual(['WhatsApp', 'Copy', 'Email', 'More']);
    expect(within(d).queryByRole('link', { name: /instagram|facebook/i })).toBeNull();   // those wait behind More
  });
  it('on a phone the main row is WhatsApp, Messages, Copy, Email and More', () => {
    setDevice(vi.fn(), true);
    const d = open();
    expect([...d.querySelectorAll('.share-tiles > .share-tile')].map(e => e.textContent?.trim())).toEqual(['WhatsApp', 'Messages', 'Copy', 'Email', 'More']);
  });
});

describe('ShareButton: links are built from the hostname the page is open on', () => {
  it('WhatsApp, Messages and Email carry the message and the tracked address of www.craftofy.online, without the page\'s own query', () => {
    setDevice(undefined, true);
    const d = open();
    const wa = within(d).getByRole('link', { name: /whatsapp/i });
    expect(wa.getAttribute('href')).toContain('https://wa.me/?text=');
    expect(decodeURIComponent(wa.getAttribute('href')!)).toContain('Take a look at Blue Pottery Vase by Meera Studio on Craftofy: https://www.craftofy.online/products/blue-vase-p21?utm_source=whatsapp&utm_medium=share');
    expect(wa.getAttribute('target')).toBe('_blank'); expect(wa.getAttribute('rel')).toContain('noopener');
    const sms = within(d).getByRole('link', { name: /messages/i });
    expect(decodeURIComponent(sms.getAttribute('href')!)).toContain('https://www.craftofy.online/products/blue-vase-p21?utm_source=sms&utm_medium=share');
    const mail = within(d).getByRole('link', { name: /email/i });
    expect(mail.getAttribute('href')).toContain('mailto:?subject=Blue%20Pottery%20Vase');
    expect(decodeURIComponent(mail.getAttribute('href')!)).toContain('https://www.craftofy.online/products/blue-vase-p21?utm_source=email&utm_medium=share');
  });
  it('shows the clean link, no query string and no utm', () => {
    const d = open();
    expect((within(d).getByLabelText(/the link/i) as HTMLInputElement).value).toBe('https://www.craftofy.online/products/blue-vase-p21');
  });
  it('each of WhatsApp, Messages and Email reports a share with the channel, the kind of page and the item', () => {
    setDevice(undefined, true);
    const d = open();
    for (const [name, method] of [[/whatsapp/i, 'whatsapp'], [/messages/i, 'sms'], [/email/i, 'email']] as const) {
      const l = within(d).getByRole('link', { name }); noNav(l);
      fireEvent.click(l);
      expect(ga.gaEvent).toHaveBeenLastCalledWith('share', { method, content_type: 'product', item_id: 'p21' });
    }
  });
});

describe('ShareButton: Copy', () => {
  it('copies the clean address, says so, and reports it', async () => {
    const d = open();
    fireEvent.click(within(d).getByRole('button', { name: /^copy$/i }));
    await waitFor(() => expect(write).toHaveBeenCalledWith('https://www.craftofy.online/products/blue-vase-p21'));
    expect(await screen.findByRole('status')).toHaveProperty('textContent', expect.stringContaining('Link copied'));
    expect(within(d).getByRole('button', { name: /^copied$/i })).toBeTruthy();
    expect(ga.gaEvent).toHaveBeenLastCalledWith('share', { method: 'copy_link', content_type: 'product', item_id: 'p21' });
  });
  it('if the browser refuses to copy, an error says so and the link is selected for the visitor to copy by hand', async () => {
    write.mockRejectedValue(new Error('denied'));
    const d = open();
    fireEvent.click(within(d).getByRole('button', { name: /^copy$/i }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining("Couldn't copy"));
    const field = within(d).getByLabelText(/the link/i) as HTMLInputElement;
    expect(field.selectionStart).toBe(0); expect(field.selectionEnd).toBe(field.value.length);
    expect(ga.gaEvent).not.toHaveBeenCalledWith('share', expect.objectContaining({ method: 'copy_link' }));
  });
});

describe('ShareButton: More', () => {
  it('on a phone it opens the phone\'s own share sheet (where Instagram and every other app are), with the tracked address, then closes', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setDevice(share, true);
    const d = open();
    fireEvent.click(within(d).getByRole('button', { name: /^more$/i }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: 'Blue Pottery Vase', text: 'Take a look at Blue Pottery Vase by Meera Studio on Craftofy:', url: 'https://www.craftofy.online/products/blue-vase-p21?utm_source=native&utm_medium=share' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(ga.gaEvent).toHaveBeenLastCalledWith('share', { method: 'native', content_type: 'product', item_id: 'p21' });
  });
  it('a visitor who closes the phone\'s sheet is left where they were: the dialog stays, nothing is reported', async () => {
    setDevice(vi.fn().mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'AbortError' })), true);
    const d = open();
    fireEvent.click(within(d).getByRole('button', { name: /^more$/i }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(ga.gaEvent).not.toHaveBeenCalled();
  });
  it('if the phone\'s sheet fails, or the browser has none, More opens Instagram and Facebook inside the dialog instead', async () => {
    setDevice(vi.fn().mockRejectedValue(new Error('NotAllowedError')), true);
    let d = open();
    fireEvent.click(within(d).getByRole('button', { name: /^more$/i }));
    expect(await within(d).findByRole('link', { name: /instagram/i })).toBeTruthy();
    cleanup();
    setDevice(undefined, false);
    d = open();
    const more = within(d).getByRole('button', { name: /^more$/i });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(within(d).getByRole('link', { name: /instagram/i }).getAttribute('href')).toBe('https://www.instagram.com/');
    const fb = within(d).getByRole('link', { name: /facebook/i });
    expect(decodeURIComponent(fb.getAttribute('href')!)).toContain('u=https://www.craftofy.online/products/blue-vase-p21?utm_source=facebook&utm_medium=share');
    for (const l of [fb, within(d).getByRole('link', { name: /instagram/i })]) { expect(l.getAttribute('target')).toBe('_blank'); expect(l.getAttribute('rel')).toContain('noopener'); }
  });
  it('Facebook reports a share; Instagram (no share address) copies the message with the link, opens Instagram, and reports it', async () => {
    const d = open();
    fireEvent.click(within(d).getByRole('button', { name: /^more$/i }));
    const fb = within(d).getByRole('link', { name: /facebook/i }); noNav(fb); fireEvent.click(fb);
    expect(ga.gaEvent).toHaveBeenLastCalledWith('share', { method: 'facebook', content_type: 'product', item_id: 'p21' });
    const ig = within(d).getByRole('link', { name: /instagram/i }); noNav(ig); fireEvent.click(ig);
    await waitFor(() => expect(write).toHaveBeenCalledWith('Take a look at Blue Pottery Vase by Meera Studio on Craftofy: https://www.craftofy.online/products/blue-vase-p21?utm_source=instagram&utm_medium=share'));
    expect(await screen.findByRole('status')).toHaveProperty('textContent', expect.stringContaining('Message copied. Paste it in Instagram.'));
    expect(ga.gaEvent).toHaveBeenLastCalledWith('share', { method: 'instagram', content_type: 'product', item_id: 'p21' });
  });
});

describe('ShareButton: the dialog itself', () => {
  it('closes on Escape, on the close button and on a click outside, and gives focus back to the Share button', () => {
    for (const close of [(d: HTMLElement) => fireEvent.keyDown(document, { key: 'Escape' }), (d: HTMLElement) => fireEvent.click(within(d).getByRole('button', { name: /close/i })), (d: HTMLElement) => fireEvent.click(d.parentElement!)]) {
      const d = open();
      close(d);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /^share$/i }));
      cleanup();
    }
  });
  it('keeps Tab inside the dialog', () => {
    const d = open();
    const items = [...d.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input')];
    items[items.length - 1].focus();
    fireEvent.keyDown(d, { key: 'Tab' });
    expect(document.activeElement).toBe(items[0]);
    items[0].focus();
    fireEvent.keyDown(d, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });
});
