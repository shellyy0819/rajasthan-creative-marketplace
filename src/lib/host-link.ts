/** `/workshops?host=in-person` opens the "Host a workshop" form on the in-person path, `?host=class` on the online class path, and the older `?host=1` with no choice made. */
export const HOST_PARAM = 'host';
export type HostPath = 'event' | 'class';

const value = (sp: Record<string, string | string[] | undefined>) => {
  const v = sp[HOST_PARAM];
  return Array.isArray(v) ? v[0] : v;
};

export function wantsHostForm(sp: Record<string, string | string[] | undefined>): boolean {
  const v = value(sp);
  return v === '1' || v === 'in-person' || v === 'class';
}

/** The path a shared link preselects: 'class' for ?host=class, 'event' for ?host=in-person, otherwise null (the visitor chooses). */
export function hostPath(sp: Record<string, string | string[] | undefined>): HostPath | null {
  const v = value(sp);
  return v === 'class' ? 'class' : v === 'in-person' ? 'event' : null;
}

/** The value the address bar shows while a path's form is open. */
export const hostParamFor = (path: HostPath | null): string => (path === 'class' ? 'class' : 'in-person');
