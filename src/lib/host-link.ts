/**
 * `/workshops?type=in-person` opens the "Host a workshop" form on the in-person path and `?type=online` on the online class path.
 * The older `?host=in-person`, `?host=class` and `?host=1` (open, no choice made) still work.
 */
export const HOST_PARAM = 'type';
export const LEGACY_HOST_PARAM = 'host';
export type HostPath = 'event' | 'class';
type SP = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** What the address bar asks for: a path, or just "open" (older links). */
function asked(sp: SP): 'in-person' | 'online' | 'open' | undefined {
  const t = first(sp[HOST_PARAM]);
  if (t === 'in-person' || t === 'online') return t;
  const h = first(sp[LEGACY_HOST_PARAM]);
  if (h === 'in-person') return 'in-person';
  if (h === 'class') return 'online';
  if (h === '1') return 'open';
  return undefined;
}

export const wantsHostForm = (sp: SP): boolean => asked(sp) !== undefined;

/** The path a shared link preselects (null: the visitor chooses). */
export function hostPath(sp: SP): HostPath | null {
  const a = asked(sp);
  return a === 'online' ? 'class' : a === 'in-person' ? 'event' : null;
}

/** The value the address bar shows while a path's form is open. */
export const hostParamFor = (path: HostPath | null): string => (path === 'class' ? 'online' : 'in-person');
