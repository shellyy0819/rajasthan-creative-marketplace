// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LanguageSelect } from '@/components/LanguageSelect';
import { LANGUAGES } from '@/lib/languages';

afterEach(cleanup);
const hidden = () => document.querySelector<HTMLInputElement>('input[name="languages"]')!;
const box = () => screen.getByRole('combobox', { name: /languages/i });
const pick = (...names: string[]) => { fireEvent.click(box()); for (const n of names) fireEvent.click(screen.getByRole('option', { name: n })); };

describe('language list', () => {
  it('covers Indian and world languages, with no duplicates', () => {
    for (const l of ['Hindi', 'English', 'Marathi', 'Tamil', 'Bengali', 'Gujarati', 'Rajasthani', 'Marwari', 'Sanskrit', 'Arabic', 'Spanish', 'French', 'German', 'Japanese', 'Mandarin Chinese']) expect(LANGUAGES, l).toContain(l);
    expect(LANGUAGES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(LANGUAGES).size).toBe(LANGUAGES.length);
  });
});

describe('LanguageSelect', () => {
  it('opens a list of languages; picking several shows them as chips and puts them in the form value', () => {
    render(<LanguageSelect />);
    expect(screen.queryByRole('listbox')).toBeNull();
    pick('Hindi', 'English');
    expect(hidden().value).toBe('Hindi, English');
    expect(within(screen.getByTestId('language-chips')).getAllByRole('button').map(b => b.textContent)).toEqual(['Hindi ✕', 'English ✕']);
    expect(screen.getByRole('option', { name: 'Hindi' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true');
  });
  it('picking a selected language again removes it; a chip removes it too', () => {
    render(<LanguageSelect />);
    pick('Hindi', 'English', 'Hindi');
    expect(hidden().value).toBe('English');
    fireEvent.click(screen.getByRole('button', { name: /remove english/i }));
    expect(hidden().value).toBe('');
  });
  it('the search box narrows the list', () => {
    render(<LanguageSelect />);
    fireEvent.click(box());
    fireEvent.change(screen.getByRole('searchbox', { name: /search languages/i }), { target: { value: 'tam' } });
    const names = screen.getAllByRole('option').map(o => o.textContent);
    expect(names).toContain('Tamil');
    expect(names).not.toContain('Hindi');
  });
  it('a language that is not in the list can be added by typing it', () => {
    render(<LanguageSelect />);
    fireEvent.click(box());
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Tulu dialect' } });
    fireEvent.click(screen.getByRole('option', { name: 'Add “Tulu dialect”' }));
    expect(hidden().value).toBe('Tulu dialect');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'x' } }); // too short to add
    expect(screen.queryByRole('option', { name: /add “x”/i })).toBeNull();
  });
  it('stops at five languages and says so', () => {
    render(<LanguageSelect />);
    pick('Hindi', 'English', 'Marathi', 'Tamil', 'Bengali');
    expect(screen.getByText(/up to 5 languages/i)).toBeTruthy();
    expect((screen.getByRole('option', { name: 'Gujarati' }) as HTMLElement).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: 'Gujarati' }));
    expect(hidden().value).toBe('Hindi, English, Marathi, Tamil, Bengali');
  });
  it('Escape closes the list and keeps the choice', () => {
    render(<LanguageSelect />);
    pick('Hindi');
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(hidden().value).toBe('Hindi');
  });
  it('follows a value set from outside (a restored draft or an edited listing) when told to re-read', () => {
    render(<LanguageSelect />);
    hidden().value = 'Tamil, Hindi';
    hidden().dispatchEvent(new Event('rr-sync'));
    return screen.findByRole('button', { name: /remove tamil/i }).then(() => expect(hidden().value).toBe('Tamil, Hindi'));
  });
});
