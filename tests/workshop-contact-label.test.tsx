import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkshopContact } from '@/components/WorkshopContact';

describe('instructor Instagram button', () => {
  it('shows the Instagram icon and "Open Insta", and opens in a new tab', () => {
    const html = renderToStaticMarkup(<WorkshopContact w={{ whatsapp: null, instagram: 'swatiyoga', website: null }} />);
    expect(html).toContain('Open Insta');
    expect(html).toContain('instagram-icon');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('aria-label="Open the instructor&#x27;s Instagram"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
