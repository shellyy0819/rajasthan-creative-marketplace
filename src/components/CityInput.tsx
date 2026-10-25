'use client';
import { useEffect, useRef, useState } from 'react';
import { usePlaceSuggest } from './usePlaceSuggest';

type CitySuggestion = { label: string; name: string; state?: string; ref?: string };
/** What the form submits: an existing city by id (the untouched default) or a signed pick from the search. */
type Choice = { kind: 'id'; id: number; label: string } | { kind: 'ref'; ref: string; label: string };

export const CITY_SEARCH_DOWN = 'City search is unavailable. Your current city is kept.';
const CHOOSE = 'Choose a city from the suggestions.';

/**
 * City picker for product, workshop and profile forms. Selection only: typed text never counts until a
 * suggestion is chosen. A chosen suggestion submits a hidden `cityRef`, the untouched default a hidden `cityId`.
 */
export function CityInput({ name = 'city', defaultCity, required = false }: {
  name?: 'city';
  defaultCity?: { id: number; label: string };
  required?: boolean;
}) {
  const initial: Choice | null = defaultCity ? { kind: 'id', id: defaultCity.id, label: defaultCity.label } : null;
  const [value, setValue] = useState(initial?.label ?? '');
  const [choice, setChoice] = useState<Choice | null>(initial);
  // The last valid choice: restored when the search service fails.
  const kept = useRef<Choice | null>(initial);
  const [down, setDown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { search, loading, inputProps, list } = usePlaceSuggest<CitySuggestion>({
    url: q => `/api/places?q=${encodeURIComponent(q)}&type=city`,
    onPick: s => {
      if (!s.ref) return; // the server signs every city result; anything else is not selectable
      const next: Choice = { kind: 'ref', ref: s.ref, label: s.label };
      setValue(s.label); setChoice(next); kept.current = next; setDown(false);
    },
    onError: () => {
      setDown(true);
      if (kept.current) { setValue(kept.current.label); setChoice(kept.current); }
    },
  });

  // Free text that is not a chosen city makes the form invalid; an empty optional field is fine.
  const invalid = value.trim() !== '' && !choice;
  useEffect(() => { inputRef.current?.setCustomValidity(invalid ? CHOOSE : ''); }, [invalid]);

  return (
    <>
      <span className={`place-field${loading ? ' busy' : ''}`}>
        <input
          ref={inputRef} name={name} value={value} required={required} maxLength={200}
          placeholder="Search your city, e.g. Udaipur" title={CHOOSE} {...inputProps}
          onChange={e => {
            const next = e.target.value;
            setValue(next);
            setChoice(null);
            setDown(false);
            search(next);
          }}
        />
        {list}
      </span>
      {choice?.kind === 'id' && <input type="hidden" name="cityId" value={choice.id} />}
      {choice?.kind === 'ref' && <input type="hidden" name="cityRef" value={choice.ref} />}
      {down && <small role="alert" className="field-error">{CITY_SEARCH_DOWN}</small>}
    </>
  );
}
