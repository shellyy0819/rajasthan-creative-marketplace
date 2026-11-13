import { describe, expect, it } from 'vitest';
import { presetKeys, renderTop } from '../tests-layout/render-top';

describe('layout test render helper', () => {
  it('renders banner, header and hero for every preset with its theme attached', () => {
    const keys = presetKeys();
    expect(keys).toContain('everyday');
    for (const k of keys) {
      const html = renderTop(k, '');
      expect(html).toContain(`data-festival="${k}"`);
      expect(html).toContain('class="festive-banner"');
      expect(html).toContain('class="topbar"');
      expect(html).toContain('class="hero-copy"');
      expect(html).toContain('class="hero-art"');
    }
  });
});
