import type { CityPick } from './city-ref';

/**
 * An area offered in the City field although OpenStreetMap files it as a suburb, which the city search leaves out. It is shown by the name an admin chose
 * ("Hyderabad Shaikpet") and becomes a city of its own when a seller picks it. `aliases` are other names that find it (the area's own OpenStreetMap name).
 */
export type ExtraArea = CityPick & { aliases: string[] };
export const MAX_EXTRA_AREAS = 100;

/** What the City field offers until an admin has saved the list on the Settings page. */
export const DEFAULT_EXTRA_AREAS: readonly ExtraArea[] = [
  { name: 'Hyderabad Shaikpet', state: 'Telangana', aliases: ['Shaikpet'], osmType: 'N', osmId: 2935018020, lat: 17.4057955, lng: 78.4006536 },
];
