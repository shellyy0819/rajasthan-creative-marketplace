// @vitest-environment jsdom
import fs from 'node:fs';
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

describe('required marker contract', () => {
  // Every <label> whose control is required must wrap its text in span.lbl so the CSS draws the red asterisk.
  it.each(['PostForm', 'CartDialog', 'BookingDialog', 'ProfileDialog', 'UsersAdmin'])('%s: required controls have a .lbl wrapper', file => {
    const src = fs.readFileSync(`src/components/${file}.tsx`, 'utf8');
    const labels = src.match(/<label[^>]*>.*?<\/label>/gs) ?? [];
    const required = labels.filter(l => /\brequired\b/.test(l));
    expect(required.length).toBeGreaterThan(0);
    for (const l of required) expect(l).toContain('className="lbl"');
  });
  it('the stylesheet draws a red asterisk for required labels', () => {
    const css = fs.readFileSync('src/app/globals.css', 'utf8');
    expect(css).toMatch(/label:has\(> :required\)>\.lbl::after\{content:' \*';color:#d0312d/);
  });
});

describe('select styling contract', () => {
  const css = fs.readFileSync('src/app/globals.css', 'utf8');
  it('every select gets the chevron with selector specificity above component select rules', () => {
    expect(css).toMatch(/select:not\(\[multiple\]\),\.select\{appearance:none[^}]*background-image:var\(--chevron\)/);
  });
  it('no component stylesheet rule applies the background shorthand to an element that is a select via class after the chevron rule', () => {
    const after = css.slice(css.indexOf('Shared form-control language'));
    expect(after).not.toMatch(/select[^{]*\{[^}]*background:/);
  });
  it('controls share one height token', () => {
    expect(css).toMatch(/--control-h:36px/);
    expect(css).toMatch(/\.admin-row \.admin-status-select\{min-height:var\(--control-h\)\}|\.admin-row \.admin-status-select\{[^}]*min-height:var\(--control-h\)/);
  });
});

import { render, screen } from '@testing-library/react';
import { PostForm } from '@/components/PostForm';
import { ProfileDialog } from '@/components/ProfileDialog';

describe('PostForm and ProfileDialog use CityInput', () => {
  const noop = () => undefined;
  const hidden = (n: string) => document.querySelector(`input[type="hidden"][name="${n}"]`) as HTMLInputElement | null;
  it('PostForm: the city is a required city search (no hard-coded dropdown), pre-filled from the post when editing', () => {
    const initial = { id: 'p1', name: 'Bowl', category: 'Pottery', city: 'Kota', cityId: 42, citySlug: 'kota', pricePaise: 100, seller: 'S', description: 'd', stock: 1, status: 'DRAFT', sellerId: 'u1' };
    render(<PostForm initial={initial as never} role="admin" categories={['Pottery']} workshops={[]} sellers={[]} onSubmit={async () => null} onCancel={noop} />);
    expect(document.querySelector('select[name="city"]')).toBeNull();
    const city = screen.getByLabelText(/^City/) as HTMLInputElement;
    expect(city.getAttribute('role')).toBe('combobox');
    expect(city.required).toBe(true);
    expect(city.value).toBe('Kota');
    expect(hidden('cityId')!.value).toBe('42');
    expect(fs.readFileSync('src/components/PostForm.tsx', 'utf8')).toContain('<CityInput');
  });
  it('PostForm: a new post starts with no city chosen', () => {
    render(<PostForm role="seller" categories={['Pottery']} workshops={[]} sellers={[]} onSubmit={async () => null} onCancel={noop} />);
    expect((screen.getByLabelText(/^City/) as HTMLInputElement).value).toBe('');
    expect(hidden('cityId')).toBeNull();
  });
  it('ProfileDialog: the artist city is an optional city search pre-filled from the profile', () => {
    render(<ProfileDialog title="My profile" initial={{ userId: 'u', displayName: 'D', city: 'Jaipur', cityId: 2 }} url="/api/profile" onSaved={noop} onCancel={noop} />);
    const city = screen.getByLabelText(/^City/) as HTMLInputElement;
    expect(city.getAttribute('role')).toBe('combobox');
    expect(city.required).toBe(false);
    expect(city.value).toBe('Jaipur');
    expect(hidden('cityId')!.value).toBe('2');
    expect(fs.readFileSync('src/components/ProfileDialog.tsx', 'utf8')).toContain('<CityInput');
  });
  it('ProfileDialog: a profile with no city starts empty', () => {
    render(<ProfileDialog title="My profile" initial={{ userId: 'u', displayName: 'D' }} url="/api/profile" onSaved={noop} onCancel={noop} />);
    expect((screen.getByLabelText(/^City/) as HTMLInputElement).value).toBe('');
    expect(hidden('cityId')).toBeNull();
  });
  it('the stylesheet draws the red asterisk for a required control nested in a place field', () => {
    const css = fs.readFileSync('src/app/globals.css', 'utf8');
    expect(css).toMatch(/label:has\(> \.place-field > :required\)>\.lbl::after\{content:' \*';color:#d0312d/);
  });
});
