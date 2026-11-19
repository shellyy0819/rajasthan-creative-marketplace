import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkshopContact } from '@/components/WorkshopContact';

describe('instructor Instagram button', () => {
  it("is labelled \"Open Instructor's Instagram\" and opens in a new tab", () => {
    const html = renderToStaticMarkup(<WorkshopContact w={{ whatsapp: null, instagram: 'swatiyoga', website: null }} />);
    expect(html).toContain("Open Instructor&#x27;s Instagram");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
