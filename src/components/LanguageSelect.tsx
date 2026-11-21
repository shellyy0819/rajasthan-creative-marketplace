'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { LANGUAGES } from '@/lib/languages';
import { RemovableChip } from './RemovableChip';

const MAX = 5;

/**
 * A multi-select dropdown of languages: pick up to five from the list (or add one that is not listed), shown as chips.
 * The choice travels in a hidden `languages` field as "Hindi, English". Code that fills the field from outside (a restored draft,
 * an edited listing) sets its value and fires an `rr-sync` event on it, and the chips follow.
 */
export function LanguageSelect({ name = 'languages', error }: { name?: string; error?: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const hidden = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const labelId = useId();

  // Follow a value set from outside.
  useEffect(() => {
    const el = hidden.current;
    if (!el) return;
    const read = () => setSelected(el.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, MAX));
    el.addEventListener('rr-sync', read);
    return () => el.removeEventListener('rr-sync', read);
  }, []);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const away = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => LANGUAGES.filter(l => !q || l.toLowerCase().includes(q)), [q]);
  const exact = LANGUAGES.some(l => l.toLowerCase() === q) || selected.some(l => l.toLowerCase() === q);
  const canAdd = query.trim().length >= 2 && query.trim().length <= 30 && !exact;
  const full = selected.length >= MAX;

  const toggle = (lang: string) => {
    setSelected(cur => {
      if (cur.includes(lang)) return cur.filter(l => l !== lang);
      return cur.length >= MAX ? cur : [...cur, lang];
    });
  };
  const add = () => { toggle(query.trim()); setQuery(''); };

  return (
    <div className="host-lang" ref={root}>
      <input ref={hidden} type="hidden" name={name} value={selected.join(', ')} readOnly />
      <span className="host-lang-label" id={labelId}>Languages</span>
      <div className="host-lang-box">
        <div className="host-lang-chips" data-testid="language-chips">
          {selected.map(l => <RemovableChip key={l} className="host-lang-chip" label={l} onRemove={() => toggle(l)} />)}
        </div>
        <button type="button" role="combobox" className="host-lang-trigger" aria-labelledby={labelId} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {selected.length ? `${selected.length} selected` : 'Select languages'}
        </button>
      </div>
      {error && <small className="field-error" id="err-languages" role="alert">{error}</small>}
      {open && (
        <div className="host-lang-panel">
          <input ref={search} type="search" role="searchbox" aria-label="Search languages" placeholder="Search or type a language" value={query} autoCapitalize="words" autoCorrect="off" spellCheck={false}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); } if (e.key === 'Enter') { e.preventDefault(); if (canAdd && !shown.length) add(); } }} />
          {full && <p className="host-lang-note">Up to {MAX} languages.</p>}
          <ul role="listbox" aria-multiselectable="true" aria-label="Languages">
            {canAdd && <li role="option" aria-selected="false" aria-disabled={full} onClick={() => { if (!full) add(); }}>Add “{query.trim()}”</li>}
            {shown.map(l => {
              const on = selected.includes(l);
              return <li key={l} role="option" aria-selected={on} aria-disabled={!on && full} onClick={() => { if (on || !full) toggle(l); }}>{l}</li>;
            })}
            {!shown.length && !canAdd && <li className="host-lang-empty" aria-disabled="true">No match</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
