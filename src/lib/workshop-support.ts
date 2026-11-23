import type { Kind, Level, Mode } from './workshop-listing';

/**
 * What the page and the host form say a host can list on /workshops today. They and a test all read this, so the wording cannot promise more than the form accepts.
 * Pop-ups are left out of the wording for now (the form still takes the kind), so nothing on the page mentions them.
 */
export const SUPPORTED_LISTINGS: { label: string; kind: Kind; mode: Mode }[] = [
  { label: 'workshops', kind: 'workshop', mode: 'in_person' },
  { label: 'meetups', kind: 'meetup', mode: 'in_person' },
  { label: 'flea markets', kind: 'market', mode: 'in_person' },
  { label: 'online classes', kind: 'class', mode: 'online' },
];

export function supportLine(): string {
  const labels = SUPPORTED_LISTINGS.map(s => s.label);
  return `Hosting one for visitors and locals? You can list ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}.`;
}

export const LEVEL_LABEL: Record<Level, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', all: 'All levels' };
