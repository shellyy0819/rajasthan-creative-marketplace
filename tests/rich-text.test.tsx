import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RichText } from '@/components/RichText';
import { escapeInline, escapeLineStart, parseInline, parseRich, richFits, richLength, richToEditorHtml, richToPlain, wrapSpan } from '@/lib/rich-text';
import { optionalRich } from '@/lib/validate';
import { createWorkshop } from '@/lib/admin';
import { notificationMail } from '@/lib/workshop-notify';
import { resetTestDb } from './helpers/testdb';

const html = (v: string) => renderToStaticMarkup(<RichText value={v} />);

describe('parsing the stored format', () => {
  it('reads bold, italic and underline, alone and together', () => {
    expect(parseInline('a **b** *c* __d__ ***e***')).toEqual([
      { text: 'a ' }, { text: 'b', bold: true }, { text: ' ' }, { text: 'c', italic: true }, { text: ' ' }, { text: 'd', underline: true }, { text: ' ' }, { text: 'e', bold: true, italic: true },
    ]);
  });
  it('a backslash makes a mark a plain character', () => {
    expect(parseInline('2 \\* 3 \\_ \\\\ ok')).toEqual([{ text: '2 * 3 _ \\ ok' }]);
  });
  it('groups consecutive bullets and numbers into one list each, and skips blank lines', () => {
    const b = parseRich('Intro\n\n- one\n• two\n1. first\n2) second\nOutro');
    expect(b.map(x => x.type)).toEqual(['p', 'ul', 'ol', 'p']);
    expect((b[1] as { items: unknown[] }).items).toHaveLength(2);
    expect((b[2] as { items: unknown[] }).items).toHaveLength(2);
  });
  it('older plain text with "•" lines reads as bullets and keeps its words', () => {
    const old = '• Teaching yoga since 2017\n• 200-hour RYT Certified Yoga Teacher\n\nI have conducted corporate wellness';
    expect(parseRich(old).map(x => x.type)).toEqual(['ul', 'p']);
    expect(richToPlain(old)).toBe('• Teaching yoga since 2017\n• 200-hour RYT Certified Yoga Teacher\nI have conducted corporate wellness');
  });
  it('empty and missing values have no blocks', () => {
    for (const v of ['', '  \n ', null, undefined]) expect(parseRich(v)).toEqual([]);
  });
});

describe('writing the stored format', () => {
  it('escapes marks and list-looking line starts so they come back as typed', () => {
    for (const typed of ['5 * 6 = 30', 'snake_case and __dunder__', 'back\\slash', '- not a bullet', '• nor this', '1. nor a number', '2) nor this']) {
      const stored = escapeLineStart(escapeInline(typed));
      expect(parseRich(stored)).toEqual([{ type: 'p', spans: [{ text: typed }] }]);
    }
  });
  it('wraps formatted text in marks, but not blank text', () => {
    expect(wrapSpan('hi', { bold: true, italic: true, underline: true })).toBe('***__hi__***');
    expect(wrapSpan('  ', { bold: true })).toBe('  ');
    expect(parseInline(wrapSpan('a*b', { bold: true }))).toEqual([{ text: 'a*b', bold: true }]);
  });
});

describe('what visitors see', () => {
  it('renders paragraphs, bullets, numbers and the three styles as real elements', () => {
    const h = html('Teaches **since 2017**\n- *Iyengar* trained\n- __RYT 500__\n1. First\n2. Second');
    expect(h).toContain('<p>Teaches <strong>since 2017</strong></p>');
    expect(h).toContain('<ul><li><em>Iyengar</em> trained</li><li><u>RYT 500</u></li></ul>');
    expect(h).toContain('<ol><li>First</li><li>Second</li></ol>');
  });
  it('shows nothing for an empty value', () => {
    expect(html('')).toBe('');
  });
  it('never turns typed markup into markup: tags, scripts and links stay text', () => {
    const h = html('<script>alert(1)</script> <img src=x onerror=alert(1)> [a](javascript:alert(1)) <a href="x">y</a>');
    expect(h).not.toContain('<script');
    expect(h).not.toContain('<img');
    expect(h).not.toContain('<a href');
    expect(h).toContain('&lt;script&gt;');
  });
  it('the editor\'s starting HTML escapes the text too', () => {
    const h = richToEditorHtml('<img src=x onerror=alert(1)> & **bold**');
    expect(h).not.toContain('<img');
    expect(h).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; <strong>bold</strong>');
  });
});

describe('limits', () => {
  it('count what a person sees, not the marks', () => {
    expect(richLength('**abc** *de*\n- fg')).toBe(8); // "abc de" and "fg"
    expect(richFits('**'.repeat(10) + 'x'.repeat(500), 500)).toBe(true); // 500 visible characters with marks around them
    expect(richFits('x'.repeat(501), 500)).toBe(false);
    expect(richFits('*'.repeat(0) + 'x'.repeat(10) + '**'.repeat(800), 500)).toBe(false); // padding with marks is refused
  });
  it('optionalRich keeps formatted text as written and refuses text that is too long', () => {
    expect(optionalRich('  **Hi**\n- one  ', 'experience')).toBe('**Hi**\n- one');
    expect(optionalRich('', 'experience')).toBeUndefined();
    expect(() => optionalRich('x'.repeat(501), 'experience')).toThrow('experience must be text up to 500 characters.');
    expect(() => optionalRich(42, 'experience')).toThrow();
  });
});

describe('plain text for email', () => {
  it('numbers keep their numbers and bullets their dot, with no marks', () => {
    expect(richToPlain('**Bold** and *italic*\n1. one\n2. two\n- a')).toBe('Bold and italic\n1. one\n2. two\n• a');
  });
  it('the team email shows experience and certifications without marks', () => {
    const { text } = notificationMail({
      id: 'r', title: 'Flow', mode: 'online', startDate: '2099-01-05', languages: [], images: [], prices: [], hostName: 'H', contactName: 'C', phone: '9000000000', email: 'h@x.co',
      experience: '**8 years**\n- teaching', certifications: '1. RYT 500',
    } as never, 'Online class');
    expect(text).toContain('Experience: 8 years\n• teaching');
    expect(text).toContain('Certifications: 1. RYT 500');
    expect(text).not.toContain('**');
  });
});

describe('saving a listing with formatted text', () => {
  it('stores the text as typed, and rejects more than 500 visible characters', async () => {
    await resetTestDb();
    const base = { title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'Asha', description: 'Gentle yoga.', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 } };
    const w = await createWorkshop({ ...base, experience: '**8 years**\n- teaching', certifications: '1. RYT 500' });
    expect(w.experience).toBe('**8 years**\n- teaching');
    expect(w.certifications).toBe('1. RYT 500');
    await expect(createWorkshop({ ...base, experience: 'x'.repeat(501) })).rejects.toThrow(/experience must be text up to 500 characters/);
  });
});
