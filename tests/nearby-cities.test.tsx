// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NearbyCities } from '@/components/NearbyCities';

afterEach(cleanup);

const MESSAGE = "Right now we don't have anything for you to shop at, but you can still explore nearby cities' shops and workshops.";
const jaipur = { id: 1, name: 'Jaipur', slug: 'jaipur', km: 330.4 };
const jodhpur = { id: 2, name: 'Jodhpur', slug: 'jodhpur', km: -1 };

describe('NearbyCities', () => {
  it('renders the message and one link per city with its distance', () => {
    render(<NearbyCities cityName="Kota" cities={[jaipur, { ...jodhpur, km: 250 }]} />);
    expect(screen.getByText(MESSAGE)).toBeTruthy();
    const a = screen.getByRole('link', { name: /Jaipur/ });
    expect(a.getAttribute('href')).toBe('/cities/jaipur');
    expect(a.textContent).toContain('~330 km');
    expect(screen.getByRole('link', { name: /Jodhpur/ }).getAttribute('href')).toBe('/cities/jodhpur');
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('renders only the message when there are no cities', () => {
    render(<NearbyCities cityName="Kota" cities={[]} />);
    expect(screen.getByText(MESSAGE)).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('omits the distance when km is -1', () => {
    render(<NearbyCities cityName="Kota" cities={[jodhpur]} />);
    const a = screen.getByRole('link', { name: /Jodhpur/ });
    expect(a.textContent).toBe('Jodhpur');
    expect(a.textContent).not.toContain('km');
  });
});
