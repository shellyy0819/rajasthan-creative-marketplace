import { describe, it, expect } from 'vitest';
import { buildPayload } from '@/components/PostForm';

const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const base = { name: ' Lac Bangle ', seller: 'Marwar Lac', description: 'Hand-set.', category: 'Accessories', city: 'Jodhpur', price: '19.99', stock: '3', status: 'DRAFT', imageUrl: '', artistName: '', instagram: '', youtube: '', phone: '', email: '' };

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
    expect(p.instagram).toBe('');
  });
});
