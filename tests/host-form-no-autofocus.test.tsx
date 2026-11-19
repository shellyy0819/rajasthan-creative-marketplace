// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: () => <input aria-label="City" name="cityRef" /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => <div /> }));
vi.mock('@/components/RequestReceived', () => ({ RequestReceived: () => <p>received</p> }));

import { HostWorkshopButton } from '@/components/HostWorkshopButton';

afterEach(() => cleanup());

describe('opening the Host a workshop form', () => {
  it('does not put the cursor in the Event title (no keyboard pops up on a phone); the dialog itself takes focus', () => {
    render(<HostWorkshopButton topics={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).not.toBe(screen.getByLabelText(/event title/i));
    expect(document.activeElement).toBe(dialog);
  });
  it('the same for a class form opened straight away from a shared link', () => {
    render(<HostWorkshopButton defaultOpen initialPath="class" topics={[]} />);
    expect(document.activeElement).not.toBe(screen.getByLabelText(/class title/i));
  });
});
