import type { Kind, Level, Mode } from './workshop-listing';

/** What a host can list on /workshops today. The page, the host form intro and a test all read this, so the wording cannot promise more than the form accepts. */
export const SUPPORTED_LISTINGS: { label: string; kind: Kind; mode: Mode }[] = [
  { label: 'workshops', kind: 'workshop', mode: 'in_person' },
  { label: 'meetups', kind: 'meetup', mode: 'in_person' },
  { label: 'pop-ups', kind: 'popup', mode: 'in_person' },
  { label: 'flea markets', kind: 'market', mode: 'in_person' },
  { label: 'online classes', kind: 'class', mode: 'online' },
];

export function supportLine(): string {
  const labels = SUPPORTED_LISTINGS.map(s => s.label);
  return `You can list ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}.`;
}

export const LEVEL_LABEL: Record<Level, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', all: 'All levels' };
