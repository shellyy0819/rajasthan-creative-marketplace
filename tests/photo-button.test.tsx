// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PhotoButton } from '@/components/PhotoButton';

afterEach(cleanup);

describe('PhotoButton', () => {
  it('renders just the children when there is no photo', () => {
    render(<PhotoButton images={[undefined]} label="Bag"><span>x</span></PhotoButton>);
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('opens the full photo, moves between photos, and closes with Escape', () => {
    render(<PhotoButton images={['/a.png', '/b.png']} label="Bag"><span>thumb</span></PhotoButton>);
    fireEvent.click(screen.getByRole('button', { name: 'View photo of Bag' }));
    const dlg = screen.getByRole('dialog');
    expect(dlg.querySelector('img')!.getAttribute('src')).toBe('/a.png');
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(dlg.querySelector('img')!.getAttribute('src')).toBe('/b.png');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('has no arrows for a single photo, and a click outside the photo closes it', () => {
    render(<PhotoButton images={['/a.png']} label="Bag"><span>thumb</span></PhotoButton>);
    fireEvent.click(screen.getByRole('button', { name: 'View photo of Bag' }));
    expect(screen.queryByRole('button', { name: 'Next photo' })).toBeNull();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
