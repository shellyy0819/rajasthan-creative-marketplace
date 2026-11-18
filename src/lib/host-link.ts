/** `/workshops?host=1` opens the "Host a workshop" form, so the form can be shared as a link. */
export const HOST_PARAM = 'host';

export function wantsHostForm(sp: Record<string, string | string[] | undefined>): boolean {
  const v = sp[HOST_PARAM];
  return (Array.isArray(v) ? v[0] : v) === '1';
}
