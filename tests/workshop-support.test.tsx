// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: () => <input name="cityRef" /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => <div /> }));

import { HostWorkshopButton } from '@/components/HostWorkshopButton';
import { SUPPORTED_LISTINGS, supportLine } from '@/lib/workshop-support';

afterEach(cleanup);

describe('what the workshops page says we support', () => {
  it('names every supported listing type in one short line', () => {
    const line = supportLine();
    for (const s of SUPPORTED_LISTINGS) expect(line).toContain(s.label);
    expect(line.length).toBeLessThan(120);
  });
  it('promises nothing the form cannot take: every entry has a matching choice in the host form', () => {
    render(<HostWorkshopButton />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    const typeValues = Array.from((screen.getByLabelText(/^type/i) as HTMLSelectElement).options).map(o => o.value);
    for (const s of SUPPORTED_LISTINGS) {
      if (s.mode === 'in_person') expect(typeValues, s.label).toContain(s.kind);
      else expect(screen.getByLabelText('Online class'), s.label).toBeTruthy();
    }
  });
  it('the host form intro shows the same line', () => {
    render(<HostWorkshopButton />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    expect(screen.getByText(supportLine())).toBeTruthy();
  });
});
