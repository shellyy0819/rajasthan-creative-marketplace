import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('@/components/CityInput', () => ({ CityInput: () => <input name="cityRef" /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => <div /> }));

import { HostWorkshopButton } from '@/components/HostWorkshopButton';

describe('HostWorkshopButton on the server', () => {
  it('renders the button without touching document when a shared link asks for the form open', () => {
    const h = renderToString(<HostWorkshopButton defaultOpen shareable />);
    expect(h).toContain('Host a workshop');
  });
});
