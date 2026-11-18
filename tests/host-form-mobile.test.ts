// @vitest-environment jsdom
import fs from 'node:fs';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: () => React.createElement('input', { name: 'cityRef' }) }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => null }));

import { HostWorkshopButton } from '@/components/HostWorkshopButton';

afterEach(cleanup);
const css = fs.readFileSync('src/components/HostWorkshopStepper.css', 'utf8');

describe('host form on phones: CSS', () => {
  it('inputs are 16px on phones and tablets so iOS does not zoom in on focus, with 44px touch targets', () => {
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.host-form select[\s\S]*font-size: 16px/);
    expect(css).toMatch(/min-height: 44px/);
  });
  it('dropdown values are small (14px), except on iOS where 16px stops Safari zooming in', () => {
    expect(css).toMatch(/\.host-form select \{ font-size: 14px; min-height: 44px; \}/);
    expect(css).toMatch(/@supports \(-webkit-touch-callout: none\)[\s\S]*\.host-form select \{ font-size: 16px; \}/);
  });
  it('the dialog follows the visible screen height (dvh) and the notch (safe-area), and the action bar stays reachable above the keyboard', () => {
    expect(css).toMatch(/100dvh/);
    expect(css).toMatch(/env\(safe-area-inset-bottom\)/);
    expect(css).toMatch(/\.host-form \.admin-actions \{[^}]*position: sticky;[^}]*bottom: 0/);
    expect(css).toMatch(/overscroll-behavior: contain/);
  });
  it('the title and the steps stay in place: only the form between them and the buttons scrolls', () => {
    expect(css).toMatch(/\.host-dialog-form \{[^}]*display: flex;[^}]*flex-direction: column;[^}]*overflow: hidden;/);
    expect(css).toMatch(/\.host-dialog-form form\.host-form \{[^}]*overflow-y: auto;/);
    expect(css).toMatch(/\.host-dialog-form \.dialog-head, \.host-dialog-form \.host-progress \{ flex: none; \}/);
  });
  it('the scrolling form leaves room for the focus ring on every side, so it is not cut off at the left and right', () => {
    expect(css).toMatch(/\.host-dialog-form form\.host-form \{ padding: 4px 4px 0; margin: 0 -4px; \}/);
  });
  it('the dialog is a little shorter than the window on tablets and desktop, and its action bar is compact', () => {
    expect(css).toMatch(/@media \(min-width: 601px\) \{[^@]*\.host-dialog \{[^}]*max-height: calc\(100dvh - 72px\);/);
    expect(css).toMatch(/\.host-form \.admin-actions \{[^}]*padding: 8px 0 calc\(8px \+ env\(safe-area-inset-bottom\)\);/);
  });
  it('on small phones the dialog fills the screen and field pairs stack', () => {
    expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*\.host-dialog[\s\S]*height: 100dvh/);
    expect(css).toMatch(/\.host-form \.admin-form-row \{ grid-template-columns: 1fr; \}/);
  });
});

describe('host form on phones: typing', () => {
  const open = () => { render(React.createElement(HostWorkshopButton)); fireEvent.click(screen.getByRole('button', { name: /host a workshop/i })); };
  const goToLast = () => {
    const set = (l: RegExp, v: string) => fireEvent.change(screen.getByLabelText(l), { target: { value: v } });
    set(/event title/i, 'T'); set(/^type/i, 'workshop'); set(/what happens/i, 'd');
    fireEvent.click(screen.getByRole('button', { name: /^next/i }));
    set(/start date/i, '2099-01-01'); set(/^city/i, 'x'); set(/venue/i, 'v');
    fireEvent.click(screen.getByRole('button', { name: /^next/i }));
  };
  it('email, handle and web fields turn off auto-capitalise, auto-correct and spellcheck', () => {
    open(); goToLast();
    for (const l of [/^email/i, /^instagram/i, /^website/i]) {
      const el = screen.getByLabelText(l);
      expect(el.getAttribute('autocapitalize'), String(l)).toBe('none');
      expect(el.getAttribute('autocorrect'), String(l)).toBe('off');
      expect(el.getAttribute('spellcheck'), String(l)).toBe('false');
    }
  });
  it('names and titles capitalise, and the keyboard shows Next on text fields', () => {
    open();
    expect(screen.getByLabelText(/event title/i).getAttribute('autocapitalize')).toBe('sentences');
    expect(screen.getByLabelText(/event title/i).getAttribute('enterkeyhint')).toBe('next');
    goToLast();
    expect(screen.getByLabelText(/your name/i).getAttribute('autocapitalize')).toBe('words');
    expect(screen.getByLabelText(/host, studio/i).getAttribute('autocapitalize')).toBe('words');
    expect(screen.getByLabelText(/phone number/i).getAttribute('enterkeyhint')).toBe('next');
    expect(screen.getByLabelText(/^email/i).getAttribute('inputmode')).toBe('email');
  });
});
