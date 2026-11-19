/** True only for exactly `?new=1`. Role-neutral: it decides whether the form opens, never what it shows. */
export function wantsNewPost(searchParams: { [key: string]: string | string[] | undefined }): boolean {
  return searchParams.new === '1';
}
/** True only for exactly `?profile=1`: the account menu's My profile link. */
export function wantsProfile(searchParams: { [key: string]: string | string[] | undefined }): boolean {
  return searchParams.profile === '1';
}
/** A seller's dashboard has two tabs: `?tab=workshops` shows My workshops, anything else My products. */
export function sellerTab(searchParams: { [key: string]: string | string[] | undefined }): 'products' | 'workshops' {
  return searchParams.tab === 'workshops' ? 'workshops' : 'products';
}
