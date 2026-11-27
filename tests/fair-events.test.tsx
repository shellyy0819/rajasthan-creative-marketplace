// @vitest-environment jsdom
import fs from 'node:fs';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const events = vi.hoisted(() => [] as { name: string; params: Record<string, unknown> }[]);
vi.mock('@/lib/analytics', () => ({ gaEvent: (name: string, params: Record<string, unknown> = {}) => { events.push({ name, params }); } }));

import { gaFairActivityStart, gaFairProductClick, gaFairQuestComplete, gaFairShortlistAdd, gaFairStallOpen } from '@/lib/ga-events';
import { ShortlistSheet, StallSheet } from '@/components/fair/FairSheets';
import { SportsSheet } from '@/components/fair/FairActivities';
import type { FairData, FairMaker } from '@/lib/fair-types';

// Invented maker and products, only for these tests.
const maker: FairMaker = {
  id: 'sample-maker', name: 'Sample Maker', city: 'Jaipur', craft: 'wood', category: 'Wood craft', look: { skin: 'skin', top: 'green', acc: 'orange' },
  greet: 'Hello', thanks: 'Thanks', href: '/artists/sample-maker',
  items: [{ key: 'sample-maker:0', name: 'Sample Box', pricePaise: 89000, art: 'woodtoy', href: '/products/sample-box' }],
};
const sampleItem = { key: 'dhaga:0', name: 'Sample Dress', pricePaise: 145000, art: 'frock' as const };

beforeEach(() => {
  events.length = 0;
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute('open'); };
});
afterEach(cleanup);

describe('the fair events (GA4)', () => {
  it('fair_stall_open names the maker by their public artist handle and the category, and sends nothing for a sample maker handle', () => {
    gaFairStallOpen(maker);
    gaFairStallOpen({ category: 'Resin Art' });
    expect(events).toEqual([
      { name: 'fair_stall_open', params: { item_category: 'Wood craft', seller_id: 'sample-maker' } },
      { name: 'fair_stall_open', params: { item_category: 'Resin Art' } },
    ]);
  });

  it('fair_shortlist_add sends the item, its price in rupees and the maker, never the player code', () => {
    gaFairShortlistAdd(maker.items[0], maker);
    gaFairShortlistAdd(sampleItem, undefined);
    expect(events).toEqual([
      { name: 'fair_shortlist_add', params: { item_id: 'sample-box', value: 890, currency: 'INR', item_category: 'Wood craft', seller_id: 'sample-maker' } },
      { name: 'fair_shortlist_add', params: { item_id: 'dhaga:0', value: 1450, currency: 'INR' } },
    ]);
  });

  it('fair_product_click says where the link was: the stall or the shortlist', () => {
    gaFairProductClick(maker.items[0], maker, 'stall');
    expect(events).toEqual([{ name: 'fair_product_click', params: { item_id: 'sample-box', placement: 'stall', item_category: 'Wood craft', seller_id: 'sample-maker' } }]);
  });

  it('fair_activity_start and fair_quest_complete carry only the activity or quest', () => {
    gaFairActivityStart('tug_of_war');
    gaFairQuestComplete({ questId: 'meet-three', done: 2, total: 3 });
    gaFairQuestComplete({ questId: 'garland', done: 3, total: 3 });
    expect(events).toEqual([
      { name: 'fair_activity_start', params: { activity: 'tug_of_war' } },
      { name: 'fair_quest_complete', params: { quest_id: 'meet-three', quests_done: 2, all_done: false } },
      { name: 'fair_quest_complete', params: { quest_id: 'garland', quests_done: 3, all_done: true } },
    ]);
  });

  it('View product in a stall reports the click', () => {
    render(<StallSheet maker={maker} real shortlist={{}} onAdd={() => undefined} onWatch={() => undefined} onOpenShortlist={() => undefined} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('link', { name: 'View product' }));
    expect(events.filter(e => e.name === 'fair_product_click')).toEqual([{ name: 'fair_product_click', params: { item_id: 'sample-box', placement: 'stall', item_category: 'Wood craft', seller_id: 'sample-maker' } }]);
  });

  it('a product link in the shortlist reports the click', () => {
    const data = { source: 'real', makers: [maker], stalls: [] } as unknown as FairData;
    render(<ShortlistSheet data={data} shortlist={{ 'sample-maker:0': 1 }} onChange={() => undefined} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('link', { name: 'Sample Box' }));
    expect(events.filter(e => e.name === 'fair_product_click').map(e => e.params.placement)).toEqual(['shortlist']);
  });

  it('pressing Start in the tug of war reports the activity once per game', () => {
    render(<SportsSheet onFinish={() => undefined} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(events).toEqual([{ name: 'fair_activity_start', params: { activity: 'tug_of_war' } }]);
  });

  it('the game sends each event from the place it happens (source contract)', () => {
    const game = fs.readFileSync('src/components/fair/FairGame.tsx', 'utf8');
    expect(game).toMatch(/visit\(slot\.maker\.id, slot\.maker\.name\);[^}]*gaFairStallOpen\(slot\.maker\)/);
    expect(game).toMatch(/const addItem = [^]*?gaFairShortlistAdd\(item, /);
    expect(game).toMatch(/r\.completed\.forEach\(q => gaFairQuestComplete\(/);
    for (const a of ['balloon', 'music', 'holy_dip']) expect(game, a).toContain(`gaFairActivityStart('${a}')`);
  });

  it('only the consent-gated GA helper is used, and the player code is never an event parameter', () => {
    const src = fs.readFileSync('src/lib/ga-events.ts', 'utf8');
    const fair = src.slice(src.indexOf('// ---- The fair (/fair)')).replace(/\/\*[^]*?\*\//g, '').replace(/^\/\/.*$/gm, '');   // code only, not the comments
    expect(fair).toContain("gaEvent('fair_stall_open'");
    expect(fair).not.toMatch(/\bcode\b|token/);
  });
});
