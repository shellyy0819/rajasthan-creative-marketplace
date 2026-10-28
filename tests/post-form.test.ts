import { describe, it, expect } from 'vitest';
import { buildPayload } from '@/components/PostForm';

const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const base = { name: ' Lac Bangle ', description: 'Hand-set.', category: 'Accessories', cityId: '3', price: '19.99', stock: '3', status: 'DRAFT', imageUrl: '', workshopId: '', pickupLocation: '' };

describe('buildPayload', () => {
  it('converts rupees to exact paise and trims text', () => {
    const p = buildPayload(form(base));
    expect(p.pricePaise).toBe(1999);
    expect(p.name).toBe('Lac Bangle');
    expect(p.stock).toBe(3);
    expect(p.status).toBe('DRAFT');
  });
  it('rounds float noise correctly', () => {
    for (const [rupees, paise] of [['0.1', 10], ['850', 85000], ['1.005', 100], ['0', 0], ['299.5', 29950]] as const)
      expect(buildPayload(form({ ...base, price: rupees })).pricePaise).toBe(paise);
  });
  it('sends NaN-ish prices as null so the server rejects them with a field-named 400', () => {
    expect(JSON.parse(JSON.stringify(buildPayload(form({ ...base, price: '' })))).pricePaise).toBeNull();
    expect(JSON.parse(JSON.stringify(buildPayload(form({ ...base, price: 'abc' })))).pricePaise).toBeNull();
  });
  it('sends blank or non-numeric stock as null too (never silently 0)', () => {
    expect(buildPayload(form({ ...base, stock: '' })).stock).toBeNull();
    expect(buildPayload(form({ ...base, stock: 'x' })).stock).toBeNull();
    expect(buildPayload(form({ ...base, stock: '0' })).stock).toBe(0);
  });
  it('sends empty optional fields as empty strings (so PATCH clears them)', () => {
    const p = buildPayload(form(base));
    expect(p.imageUrl).toBe('');
    expect(p.workshopId).toBe('');
    expect(p.pickupLocation).toBe('');
  });
  it('no longer sends seller or contact fields (they live in the seller profile)', () => {
    const p = buildPayload(form({ ...base, seller: 'X', phone: '1', instagram: 'i', youtube: 'y', email: 'e', artistName: 'a' }));
    for (const k of ['seller', 'phone', 'instagram', 'youtube', 'email', 'artistName']) expect(p).not.toHaveProperty(k);
  });
  it('status and sellerId are sent only when the form has those controls', () => {
    const { status: _s, ...noStatus } = base;
    expect(buildPayload(form(noStatus))).not.toHaveProperty('status');
    expect(buildPayload(form(base))).not.toHaveProperty('sellerId');
    expect(buildPayload(form({ ...base, sellerId: ' abc ' })).sellerId).toBe('abc');
    expect(buildPayload(form({ ...base, sellerId: '' })).sellerId).toBe('');
  });
  it('sends the untouched default city as a numeric cityId and never a free-text city', () => {
    const p = buildPayload(form({ ...base, city: 'Jodhpur' }));
    expect(p.cityId).toBe(3);
    expect(p).not.toHaveProperty('city');
    expect(p).not.toHaveProperty('cityRef');
  });
  it('sends a chosen suggestion as cityRef (and no cityId)', () => {
    const { cityId: _c, ...noId } = base;
    const p = buildPayload(form({ ...noId, city: 'Kota, Rajasthan', cityRef: 'REF-KOTA' }));
    expect(p.cityRef).toBe('REF-KOTA');
    expect(p).not.toHaveProperty('cityId');
    expect(p).not.toHaveProperty('city');
  });
  it('sends no city fields when none was chosen (the server answers "city is required.")', () => {
    const { cityId: _c, ...noId } = base;
    const p = buildPayload(form({ ...noId, city: 'typed only' }));
    for (const k of ['city', 'cityId', 'cityRef']) expect(p).not.toHaveProperty(k);
  });
});
