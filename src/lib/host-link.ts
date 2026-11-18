/** `/workshops?host=1` opens the "Host a workshop" form with no choice made; `?host=class` opens it on the online class path. */
export const HOST_PARAM = 'host';
export type HostPath = 'event' | 'class';

const value = (sp: Record<string, string | string[] | undefined>) => {
  const v = sp[HOST_PARAM];
  return Array.isArray(v) ? v[0] : v;
};

export function wantsHostForm(sp: Record<string, string | string[] | undefined>): boolean {
  const v = value(sp);
  return v === '1' || v === 'class';
}

/** The path a shared link preselects: 'class' for ?host=class, otherwise null (the visitor chooses). */
export function hostPath(sp: Record<string, string | string[] | undefined>): HostPath | null {
  return value(sp) === 'class' ? 'class' : null;
}
