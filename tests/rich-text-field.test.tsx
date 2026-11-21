// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RichTextField, serializeEditor } from '@/components/RichTextField';
import { parseRich } from '@/lib/rich-text';

const dom = (inner: string) => { const d = document.createElement('div'); d.innerHTML = inner; return d; };
const exec = vi.fn();

beforeEach(() => { exec.mockReset(); (document as unknown as { execCommand: unknown }).execCommand = exec; });
afterEach(() => { cleanup(); delete (document as unknown as { execCommand?: unknown }).execCommand; });

describe('serializeEditor: what the box shows becomes the stored text', () => {
  it('writes bold, italic and underline as marks, however the browser spelled them', () => {
    expect(serializeEditor(dom('plain <b>bold</b> <strong>strong</strong> <i>it</i> <em>em</em> <u>un</u>'))).toBe('plain **bold** **strong** *it* *em* __un__');
    expect(serializeEditor(dom('<b><i><u>all</u></i></b>'))).toBe('***__all__***');
  });
  it('writes each line (a div, a paragraph or a break) as its own line', () => {
    expect(serializeEditor(dom('one<div>two</div><p>three</p>four<br>five'))).toBe('one\ntwo\nthree\nfour\nfive');
  });
  it('writes bulleted and numbered lists, numbering from one each time', () => {
    expect(serializeEditor(dom('intro<ul><li>a</li><li>b</li></ul><ol><li>x</li><li>y</li></ol>'))).toBe('intro\n- a\n- b\n1. x\n2. y');
  });
  it('drops everything but the words and the three marks (spans, links, styles, scripts)', () => {
    const s = serializeEditor(dom('<span style="color:red">red</span> <a href="javascript:alert(1)">link</a><script>alert(1)</script><img src=x>'));
    expect(s).toBe('red link');
  });
  it('escapes what would read as formatting, and keeps a typed dash or number from becoming a list', () => {
    const s = serializeEditor(dom('2 * 3<div>- not a bullet</div><div>1. not a number</div><div>snake_case</div>'));
    expect(parseRich(s).map(b => b.type)).toEqual(['p', 'p', 'p', 'p']);
    expect(s).toContain('2 \\* 3');
  });
  it('skips empty lines and turns non-breaking spaces into spaces', () => {
    expect(serializeEditor(dom('a&nbsp;b<div><br></div><div></div>'))).toBe('a b');
  });
});

describe('the Experience field', () => {
  const setup = () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const utils = render(<RichTextField name="experience" label="Experience" />, { container: form });
    return { form, hidden: form.elements.namedItem('experience') as HTMLInputElement, editor: screen.getByRole('textbox', { name: 'Experience' }), utils };
  };

  it('is a labelled text box with a toolbar of five buttons', () => {
    setup();
    expect(screen.getByRole('textbox', { name: 'Experience' }).getAttribute('aria-multiline')).toBe('true');
    expect(screen.getByRole('toolbar', { name: 'Experience formatting' })).toBeTruthy();
    for (const n of ['Bold', 'Italic', 'Underline', 'Bulleted list', 'Numbered list']) expect(screen.getByRole('button', { name: n })).toBeTruthy();
  });

  it('keeps the value in a hidden field the form can read, and tells the form when it changes', () => {
    const { form, hidden, editor } = setup();
    const seen: string[] = [];
    form.addEventListener('input', e => { if ((e.target as HTMLInputElement).name === 'experience') seen.push((e.target as HTMLInputElement).value); });
    editor.innerHTML = 'Taught <b>8 years</b><ul><li>yoga</li></ul>';
    fireEvent.input(editor);
    expect(hidden.value).toBe('Taught **8 years**\n- yoga');
    expect(new FormData(form).get('experience')).toBe('Taught **8 years**\n- yoga');
    expect(seen).toContain('Taught **8 years**\n- yoga'); // the form heard it from the named field, so a draft is saved and an error clears
    expect(screen.getByText('18/500')).toBeTruthy();
  });

  it('follows a value set from outside (an edited listing, a restored draft)', () => {
    const { hidden, editor } = setup();
    hidden.value = '**Bold** start\n1. one\n2. two';
    act(() => { hidden.dispatchEvent(new Event('rr-sync')); });
    expect(editor.innerHTML).toBe('<p><strong>Bold</strong> start</p><ol><li>one</li><li>two</li></ol>');
    expect(screen.getByText('16/500')).toBeTruthy();
  });

  it('each toolbar button runs its own command and then saves', () => {
    const { hidden, editor } = setup();
    editor.innerHTML = 'hello';
    for (const [name, cmd] of [['Bold', 'bold'], ['Italic', 'italic'], ['Underline', 'underline'], ['Bulleted list', 'insertUnorderedList'], ['Numbered list', 'insertOrderedList']]) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(exec).toHaveBeenLastCalledWith(cmd, false);
    }
    expect(hidden.value).toBe('hello');
  });

  it('pasting inserts the words only, never formatting', () => {
    const { editor } = setup();
    const paste = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    paste.clipboardData = { getData: (t: string) => (t === 'text/plain' ? 'just words' : '<b onclick=x>bold</b>') };
    editor.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    expect(exec).toHaveBeenCalledWith('insertText', false, 'just words');
  });

  it('shows the count in red and marks the box invalid past the limit', () => {
    const { editor } = setup();
    editor.textContent = 'x'.repeat(520);
    fireEvent.input(editor);
    const count = screen.getByText('520/500');
    expect(count.className).toContain('over');
    expect(editor.getAttribute('aria-invalid')).toBe('true');
  });

  it('is marked invalid, and can be found by the form\'s error handling, when the server named it', () => {
    render(<RichTextField name="certifications" label="Certifications" error="too long" />);
    expect(screen.getByRole('textbox', { name: 'Certifications' }).getAttribute('data-field')).toBe('certifications');
    expect(screen.getByRole('textbox', { name: 'Certifications' }).getAttribute('aria-invalid')).toBe('true');
  });
});

describe('the host form uses it (source contract)', () => {
  it('Experience and Certifications are editors, not plain textareas', () => {
    const src = fs.readFileSync('src/components/HostListingFields.tsx', 'utf8');
    expect(src).toContain('<RichTextField name="experience" label="Experience"');
    expect(src).toContain('<RichTextField name="certifications" label="Certifications"');
    expect(src).not.toMatch(/<textarea name="(experience|certifications)"/);
  });
  it('looks like the form\'s other fields: same border, surface and 12px text, with larger touch sizes on phones', () => {
    const css = fs.readFileSync('src/components/RichTextField.css', 'utf8').replace(/\s+/g, ' ');
    expect(css).toMatch(/\.rich-box \{[^}]*border: 1px solid var\(--line\); background: var\(--white\);/);
    expect(css).toMatch(/\.rich-editor \{[^}]*font: 12px\/1\.6 var\(--font-sans\)/);
    expect(css).toMatch(/@media \(max-width: 700px\) \{ \.rich-btn \{ width: 40px; height: 40px; \} \.rich-editor \{ font-size: 16px;/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
