// @vitest-environment jsdom
import fs from 'node:fs';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const events = vi.hoisted(() => [] as { name: string; params: Record<string, unknown> }[]);
vi.mock('@/lib/analytics', () => ({ gaEvent: (name: string, params: Record<string, unknown> = {}) => { events.push({ name, params }); } }));

import { TrackFairView } from '@/components/fair/TrackFairView';
import { gaViewFair } from '@/lib/ga-events';

beforeEach(() => { events.length = 0; });
afterEach(cleanup);

describe('who is checking out the Fair (GA4 view_fair)', () => {
  it('gaViewFair sends view_fair with the fair status', () => {
    gaViewFair('open');
    gaViewFair('closed');
    expect(events).toEqual([{ name: 'view_fair', params: { fair_status: 'open' } }, { name: 'view_fair', params: { fair_status: 'closed' } }]);
  });
  it('the page reports one view when it appears, even if it renders again', () => {
    const { rerender } = render(<TrackFairView status="open" />);
    rerender(<TrackFairView status="open" />);
    expect(events.filter(e => e.name === 'view_fair')).toHaveLength(1);
    expect(events[0].params).toEqual({ fair_status: 'open' });
  });
  it('the fair page reports the view in both its states: open and closed (source contract)', () => {
    const src = fs.readFileSync('src/app/fair/page.tsx', 'utf8');
    expect(src).toContain('<TrackFairView status="open" />');
    expect(src).toContain('<TrackFairView status="closed" />');
  });
  it('the component only reports through the consent-gated GA helper, and sends no personal data', () => {
    const src = fs.readFileSync('src/components/fair/TrackFairView.tsx', 'utf8');
    expect(src).toContain('gaViewFair(status)');
    expect(fs.readFileSync('src/lib/ga-events.ts', 'utf8')).toMatch(/gaEvent\('view_fair', \{ fair_status: status \}\)/);
  });
});
