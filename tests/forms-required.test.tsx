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
