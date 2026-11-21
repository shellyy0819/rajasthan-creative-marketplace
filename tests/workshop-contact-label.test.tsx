import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WorkshopContact } from '@/components/WorkshopContact';

describe('instructor Instagram and WhatsApp buttons', () => {
  it('Instagram is an icon button with no "Open Insta" text, named for screen readers, opening in a new tab', () => {
    const html = renderToStaticMarkup(<WorkshopContact w={{ whatsapp: null, instagram: 'swatiyoga', website: null }} workshopId="w1" contentType="class" placement="card" />);
    expect(html).not.toContain('Open Insta<');
    expect(html).not.toMatch(/>\s*Open Insta/);
    expect(html).toContain('linearGradient'); // the same Instagram mark the product pages use (shared BrandIcon)
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('aria-label="Open the instructor&#x27;s Instagram"');
    expect(html).toContain('title="Open the instructor&#x27;s Instagram"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it('WhatsApp is an icon button with no "WhatsApp" text, named for screen readers, opening a chat in a new tab', () => {
    const html = renderToStaticMarkup(<WorkshopContact w={{ whatsapp: '+919989898999', instagram: null, website: null }} workshopId="w1" contentType="class" placement="card" />);
    expect(html).not.toMatch(/>\s*WhatsApp\s*</);
    expect(html).toContain('aria-label="Chat on WhatsApp"');
    expect(html).toContain('href="https://wa.me/919989898999"');
    expect(html).toContain('#25D366'); // the same WhatsApp mark the product pages use (shared BrandIcon)
    expect(html).toContain('ws-icon ws-whatsapp');
    expect(html).toContain('target="_blank"');
  });
  it('a button only appears when the number or account exists; Call is the shared phone icon and Website keeps its word', () => {
    expect(renderToStaticMarkup(<WorkshopContact w={{ whatsapp: null, instagram: null, website: null }} workshopId="w1" contentType="class" placement="card" />)).toBe('');
    const html = renderToStaticMarkup(<WorkshopContact w={{ whatsapp: null, instagram: null, website: 'https://x.example', publicPhone: '+919989898999' }} workshopId="w1" contentType="class" placement="card" />);
    expect(html).not.toContain('>Call<');
    expect(html).toContain('ws-icon ws-call');
    expect(html).toContain('aria-label="Call +919989898999"');
    expect(html).toContain('href="tel:+919989898999"');
    expect(html).toContain('ws-call-disc'); // the product card's round phone button
    expect(html).toContain('stroke-width="1.8"'); // the same phone mark the product and class pages use (shared BrandIcon)
    expect(html).toContain('>Website<');
  });
  it('the icon buttons are the mark alone with no ring, still 40px (44px on tablets and phones) to tap (source contract)', () => {
    const css = fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ');
    expect(css).toMatch(/\.ws-contact \.ws-icon \{[^}]*width: 40px; height: 40px;[^}]*border: 0;/);
    expect(css).toMatch(/@media \(max-width: 900px\) \{ \.ws-contact \.ws-icon \{ width: 44px; height: 44px; \} \}/);
  });
});

describe('the contact marks are shared with the product pages (source contract)', () => {
  it('the product page, the workshop cards and the class pages draw WhatsApp and Instagram with the same BrandMark', () => {
    for (const f of ['src/components/MakerCard.tsx', 'src/components/class/ChannelIcon.tsx']) expect(fs.readFileSync(f, 'utf8')).toContain("BrandIcon'");
    const icon = fs.readFileSync('src/components/class/ChannelIcon.tsx', 'utf8');
    expect(icon).toContain("<BrandMark name={kind}");
    expect(icon).toContain('<CallMark size={size}');
    expect(fs.readFileSync('src/components/WorkshopContact.tsx', 'utf8')).toContain('ChannelIcon');
  });
  it('MakerCard no longer keeps its own copy of the marks', () => {
    expect(fs.readFileSync('src/components/MakerCard.tsx', 'utf8')).not.toContain('25D366');
  });
});
