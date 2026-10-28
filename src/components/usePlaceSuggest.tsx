'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

/**
 * Shared type-ahead behaviour for place fields (PlaceInput, CityInput): debounced search from 3 characters,
 * stale responses aborted, arrow/Enter/Escape keyboard handling and the combobox ARIA wiring.
 * The caller owns the input value; call `search(text)` from onChange.
 */
export function usePlaceSuggest<S extends { label: string }>({ url, onPick, onError }: {
  url: (q: string) => string;
  onPick: (s: S) => void;
  /** Called when a search fails (not when it was superseded). */
  onError?: () => void;
}) {
  const [options, setOptions] = useState<S[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); ctrl.current?.abort(); }, []);

  function cancel() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    ctrl.current?.abort();
    ctrl.current = null;
    setLoading(false);
  }

  function search(next: string) {
    setActive(-1);
    cancel();
    const q = next.trim();
    if (q.length < MIN_CHARS) { setOptions([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const c = new AbortController();
      ctrl.current = c;
      setLoading(true);
      try {
        const res = await fetch(url(q), { signal: c.signal });
        if (!res.ok) throw new Error(String(res.status));
        const list = (await res.json()) as S[];
        if (c.signal.aborted) return; // a newer search took over
        setOptions(list);
        setOpen(list.length > 0);
      } catch {
        if (!c.signal.aborted) { setOptions([]); setOpen(false); onError?.(); }
      } finally {
        if (ctrl.current === c) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  function pick(s: S) {
    cancel();
    setOpen(false);
    setOptions([]);
    setActive(-1);
    onPick(s);
  }

  const inputProps = {
    autoComplete: 'off',
    role: 'combobox',
    'aria-busy': loading,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': open,
    'aria-controls': open ? listId : undefined,
    'aria-activedescendant': open && active >= 0 ? `${listId}-${active}` : undefined,
    onBlur: () => { setTimeout(() => setOpen(false), 120); },
    onFocus: () => { if (options.length) setOpen(true); },
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); setOpen(true); setActive(a => (a + 1) % options.length); }
      else if (e.key === 'ArrowUp' && open) { e.preventDefault(); setActive(a => (a <= 0 ? options.length - 1 : a - 1)); }
      else if (e.key === 'Enter' && open && active >= 0) { e.preventDefault(); pick(options[active]); }
      else if (e.key === 'Escape' && open) { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation?.(); setOpen(false); }
    },
  };

  const list = open ? (
    <ul id={listId} role="listbox" className="place-list">
      {options.map((o, i) => (
        <li key={o.label} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'active' : undefined}
          onMouseDown={e => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(i)}>
          {o.label}
        </li>
      ))}
      <li role="presentation" className="place-credit">Suggestions from OpenStreetMap</li>
    </ul>
  ) : null;

  return { search, cancel, loading, inputProps, list };
}
