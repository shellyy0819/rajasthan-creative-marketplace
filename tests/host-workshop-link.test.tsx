// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: () => <input name="cityRef" /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => <div /> }));

import { HostWorkshopButton } from '@/components/HostWorkshopButton';
import { wantsHostForm } from '@/lib/host-link';

const dialog = () => screen.queryByRole('dialog', { name: /host a workshop or pop-up/i });

describe('wantsHostForm', () => {
  it('is true only for ?host=1', () => {
    expect(wantsHostForm({ host: '1' })).toBe(true);
    expect(wantsHostForm({ host: ['1', 'x'] })).toBe(true);
    expect(wantsHostForm({ host: '0' })).toBe(false);
    expect(wantsHostForm({ host: 'true' })).toBe(false);
    expect(wantsHostForm({})).toBe(false);
  });
});

describe('HostWorkshopButton share link', () => {
  beforeEach(() => window.history.replaceState(null, '', '/workshops'));
  afterEach(cleanup);

  it('opens the form on first render when defaultOpen is set (a shared ?host=1 link)', () => {
    render(<HostWorkshopButton defaultOpen shareable />);
    expect(dialog()).not.toBeNull();
  });

  it('stays closed by default', () => {
    render(<HostWorkshopButton shareable />);
    expect(dialog()).toBeNull();
  });

  it('puts ?type=in-person in the address bar while the form is open and removes it on close, keeping other params', () => {
    window.history.replaceState(null, '', '/workshops?utm_source=wa');
    render(<HostWorkshopButton shareable />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    expect(window.location.search).toBe('?utm_source=wa&type=in-person');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(dialog()).toBeNull();
    expect(window.location.search).toBe('?utm_source=wa');
  });

  it('removes ?host=1 on close when a shared link opened the form, leaving a clean /workshops', () => {
    window.history.replaceState(null, '', '/workshops?host=1');
    render(<HostWorkshopButton defaultOpen shareable />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(window.location.pathname + window.location.search).toBe('/workshops');
  });

  it('does not touch the address bar when not shareable (home page)', () => {
    window.history.replaceState(null, '', '/');
    render(<HostWorkshopButton />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    expect(dialog()).not.toBeNull();
    expect(window.location.search).toBe('');
  });

  it('an older ?host=class link becomes ?type=online while open and is gone after close', () => {
    window.history.replaceState(null, '', '/workshops?host=class');
    render(<HostWorkshopButton defaultOpen initialPath="class" shareable />);
    expect(window.location.search).toBe('?type=online');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(window.location.search).toBe('');
  });
  it('leaves a price filter (?type=FREE) in the address bar alone', () => {
    window.history.replaceState(null, '', '/workshops?type=FREE');
    render(<HostWorkshopButton shareable />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    expect(window.location.search).toBe('?type=FREE');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(window.location.search).toBe('?type=FREE');
  });
  it('two buttons on one page do not undo each other: the closed one leaves the address alone', () => {
    render(<><HostWorkshopButton shareable label="First" /><HostWorkshopButton shareable label="Second" /></>);
    fireEvent.click(screen.getByRole('button', { name: /second/i }));
    expect(window.location.search).toBe('?type=in-person');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(window.location.search).toBe('');
  });
});
