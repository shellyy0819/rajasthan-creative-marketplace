// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { sendEvent } from '@/lib/track';
import { TrackOnMount } from '@/components/TrackOnMount';
import { TrackedLink } from '@/components/TrackedLink';

let beacon: ReturnType<typeof vi.fn>; let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { beacon = vi.fn(() => true); fetchMock = vi.fn(() => Promise.resolve({ ok: true })); Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true }); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const sent = async () => JSON.parse(await (beacon.mock.calls[0][1] as Blob).text());

describe('sendEvent', () => {
  it('posts {type, productId} as JSON through sendBeacon', async () => {
    sendEvent('view', 'p1');
    expect(beacon.mock.calls[0][0]).toBe('/api/events');
    expect((beacon.mock.calls[0][1] as Blob).type).toBe('application/json');
    expect(await sent()).toEqual({ type: 'view', productId: 'p1' });
  });
  it('falls back to a keepalive fetch when sendBeacon is missing or refuses, and never throws', () => {
    beacon.mockReturnValue(false);
    expect(() => sendEvent('contact', 'p2')).not.toThrow();
    expect(fetchMock).toHaveBeenCalledWith('/api/events', expect.objectContaining({ method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' } }));
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    expect(() => sendEvent('artist', 'p3')).not.toThrow();
  });
});

describe('sendEvent when sendBeacon throws (older Chrome with non-safelisted Blob types)', () => {
  it('falls back to fetch instead of dropping the event', () => {
    beacon.mockImplementation(() => { throw new TypeError('blocked'); });
    expect(() => sendEvent('view', 'p4')).not.toThrow();
    expect(fetchMock).toHaveBeenCalledWith('/api/events', expect.objectContaining({ method: 'POST', keepalive: true }));
  });
});

describe('TrackOnMount', () => {
  it('sends once per mount, even if re-rendered; renders nothing', async () => {
    const { container, rerender } = render(<TrackOnMount productId="p1" type="view" />);
    rerender(<TrackOnMount productId="p1" type="view" />);
    expect(container.innerHTML).toBe('');
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(await sent()).toEqual({ type: 'view', productId: 'p1' });
  });
  it('a different product (client-side navigation to another product page) sends a new event', () => {
    const { rerender } = render(<TrackOnMount productId="p1" type="view" />);
    rerender(<TrackOnMount productId="p2" type="view" />);
    expect(beacon).toHaveBeenCalledTimes(2);
  });
});

describe('TrackedLink', () => {
  it('renders a normal anchor with its attributes, sends a contact event on click and does not prevent navigation', async () => {
    render(<TrackedLink productId="p1" type="contact" href="tel:+919989898999" target="_blank" rel="noreferrer">Call</TrackedLink>);
    const a = screen.getByRole('link', { name: 'Call' });
    expect(a.getAttribute('href')).toBe('tel:+919989898999');
    expect(a.getAttribute('target')).toBe('_blank');
    const notPrevented = fireEvent.click(a);
    expect(notPrevented).toBe(true);
    expect(await sent()).toEqual({ type: 'contact', productId: 'p1' });
  });
  it('middle-click counts once; right-click does not', () => {
    render(<TrackedLink productId="p1" type="contact" href="mailto:a@b.co">Mail</TrackedLink>);
    const a = screen.getByRole('link', { name: 'Mail' });
    fireEvent(a, new MouseEvent('auxclick', { button: 1, bubbles: true }));
    fireEvent(a, new MouseEvent('auxclick', { button: 2, bubbles: true }));   // right-click is not a visit
    expect(beacon).toHaveBeenCalledTimes(1);
  });
});
