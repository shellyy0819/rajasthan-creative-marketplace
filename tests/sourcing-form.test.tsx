// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { buildPayload, PostForm } from '@/components/PostForm';
import { AdminTabs } from '@/components/AdminTabs';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/sourcing-types' }));
vi.mock('@/components/CityInput', () => ({ CityInput: () => <input name="cityId" defaultValue="1" /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => null }));
afterEach(cleanup);

const types = [{ id: 1, name: 'Handmade', countsAsHandmade: true, showBadge: false, position: 1, active: true }, { id: 2, name: 'Curated', countsAsHandmade: false, showBadge: true, position: 2, active: true }];
const props = { role: 'admin' as const, categories: ['Pottery'], workshops: [], sellers: [], onSubmit: async () => null, onCancel: () => {} };

describe('product form: sourcing', () => {
  it('shows a required Sourcing select with the active types, the first selected for a new product', () => {
    render(<PostForm {...props} sourcingTypes={types} />);
    const select = screen.getByLabelText('Sourcing') as HTMLSelectElement;
    expect(select.required).toBe(true);
    expect(Array.from(select.options).map(o => o.textContent)).toEqual(['Handmade', 'Curated']);
    expect(select.value).toBe('1');
  });
  it('keeps the product\'s own type selectable even after it was switched off', () => {
    const initial = { id: 'p1', name: 'N', category: 'Pottery', cityId: 1, city: 'Jaipur', citySlug: 'jaipur', pricePaise: 1, seller: 'S', description: 'D', stock: 1, status: 'DRAFT', sellerId: 'u', sellerEmail: 'e@x.co', sourcing: { id: 9, name: 'Vintage', countsAsHandmade: false, showBadge: true } };
    render(<PostForm {...props} sourcingTypes={types} initial={initial as never} />);
    const select = screen.getByLabelText('Sourcing') as HTMLSelectElement;
    expect(Array.from(select.options).map(o => o.textContent)).toEqual(['Handmade', 'Curated', 'Vintage (switched off)']);
    expect(select.value).toBe('9');
  });
  it('is hidden when there are no types, and the payload then carries no sourcingTypeId', () => {
    render(<PostForm {...props} />);
    expect(screen.queryByLabelText('Sourcing')).toBeNull();
    const f = new FormData(); f.set('name', 'N');
    expect('sourcingTypeId' in buildPayload(f)).toBe(false);
    f.set('sourcingTypeId', '2');
    expect(buildPayload(f).sourcingTypeId).toBe(2);
  });
});

describe('dashboard wiring', () => {
  it('the admin tabs link to Sourcing types and mark it as the current page', () => {
    render(<AdminTabs />);
    const link = screen.getByRole('link', { name: 'Sourcing types' });
    expect(link.getAttribute('href')).toBe('/dashboard/sourcing-types');
    expect(link.getAttribute('aria-current')).toBe('page');
  });
  it('the admin page is admin-only and has breadcrumbs; the posts page passes the active types to the form', () => {
    const page = fs.readFileSync('src/app/dashboard/sourcing-types/page.tsx', 'utf8');
    expect(page).toContain('requireAdminPage()'); expect(page).toContain('<Breadcrumbs'); expect(page).toContain('<SourcingTypesAdmin');
    expect(fs.readFileSync('src/app/dashboard/posts/page.tsx', 'utf8')).toContain('sourcingTypes={sourcingTypes}');
  });
});
