// The shape of a fair player event. No server imports here: the browser queue uses it too.

/** What a player did at the fair, as the admin "Fair players" page counts it. */
export const FAIR_EVENT_KINDS = ['stall', 'shortlist', 'activity', 'quest'] as const;
export type FairEventKind = (typeof FAIR_EVENT_KINDS)[number];
export type FairEventInput = { kind: FairEventKind; detail: string };
export const MAX_EVENTS_PER_CALL = 10;
export const DETAIL_MAX = 80;
