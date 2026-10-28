'use client';
import { useState } from 'react';
import { usePlaceSuggest } from './usePlaceSuggest';

type Suggestion = { label: string; name: string; state?: string };

/**
 * Text input with place suggestions (areas, cities, landmarks across India), like a map search box.
 * Suggestions are optional help: any typed text is kept as is. Keeps a plain `name` so it works inside <form>.
 */
export function PlaceInput({ name, defaultValue = '', maxLength, placeholder }: { name: string; defaultValue?: string; maxLength?: number; placeholder?: string }) {
  const [value, setValue] = useState(defaultValue);
  // Suggestions are optional: a failed search stays quiet.
  const { search, loading, inputProps, list } = usePlaceSuggest<Suggestion>({
    url: q => `/api/places?q=${encodeURIComponent(q)}`,
    onPick: s => setValue(s.label),
  });

  return (
    <span className={`place-field${loading ? ' busy' : ''}`}>
      <input
        name={name} value={value} maxLength={maxLength} placeholder={placeholder} {...inputProps}
        onChange={e => { setValue(e.target.value); search(e.target.value); }}
      />
      {list}
    </span>
  );
}
