/** True only for exactly `?new=1`. Role-neutral: it decides whether the form opens, never what it shows. */
export function wantsNewPost(searchParams: { [key: string]: string | string[] | undefined }): boolean {
  return searchParams.new === '1';
}
