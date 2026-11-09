/** True only for exactly `?new=1`. Role-neutral: it decides whether the form opens, never what it shows. */
export function wantsNewPost(searchParams: { [key: string]: string | string[] | undefined }): boolean {
  return searchParams.new === '1';
}
/** True only for exactly `?profile=1`: the account menu's My profile link. */
export function wantsProfile(searchParams: { [key: string]: string | string[] | undefined }): boolean {
  return searchParams.profile === '1';
}
