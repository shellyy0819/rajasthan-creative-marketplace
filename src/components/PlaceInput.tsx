'use client';
import { useEffect, useId, useRef, useState } from 'react';

type Suggestion = { label: string; name: string; state?: string };
const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

/**
 * Text input with place suggestions (areas, cities, landmarks across India), like a map search box.
 * Suggestions are optional help: any typed text is kept as is. Keeps a plain `name` so it works inside <form>.
 */
export function PlaceInput({ name, defaultValue = '', maxLength, placeholder }: { name: string; defaultValue?: string; maxLength?: number; placeholder?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); ctrl.current?.abort(); }, []);

  function cancelPending() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    ctrl.current?.abort();
    ctrl.current = null;
  }

  function onChange(next: string) {
    setValue(next);
    setActive(-1);
    cancelPending();
    const q = next.trim();
    if (q.length < MIN_CHARS) { setOptions([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const c = new AbortController();
      ctrl.current = c;
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: c.signal });
        if (!res.ok) throw new Error(String(res.status));
        const list = (await res.json()) as Suggestion[];
        if (c.signal.aborted) return; // a newer search took over
        setOptions(list);
        setOpen(list.length > 0);
      } catch {
        if (!c.signal.aborted) { setOptions([]); setOpen(false); } // suggestions are optional: stay quiet
      }
    }, DEBOUNCE_MS);
  }

  function pick(s: Suggestion) {
    cancelPending();
    setValue(s.label);
    setOpen(false);
    setOptions([]);
    setActive(-1);
  }

  return (
    <span className="place-field">
      <input
        name={name} value={value} maxLength={maxLength} placeholder={placeholder} autoComplete="off"
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onFocus={() => { if (options.length) setOpen(true); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); setOpen(true); setActive(a => (a + 1) % options.length); }
          else if (e.key === 'ArrowUp' && open) { e.preventDefault(); setActive(a => (a <= 0 ? options.length - 1 : a - 1)); }
          else if (e.key === 'Enter' && open && active >= 0) { e.preventDefault(); pick(options[active]); }
          else if (e.key === 'Escape' && open) { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation?.(); setOpen(false); }
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="place-list">
          {options.map((o, i) => (
            <li key={o.label} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'active' : undefined}
              onMouseDown={e => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(i)}>
              {o.label}
            </li>
          ))}
          <li role="presentation" className="place-credit">Suggestions from OpenStreetMap</li>
        </ul>
      )}
    </span>
  );
}
