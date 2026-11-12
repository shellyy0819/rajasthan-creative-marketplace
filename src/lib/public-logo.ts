import { isHttpUrl } from './onboarding-validate';
import { isOwnLogoUrl, storageConfig } from './storage';

/** A stored logo is shown only if it is an http(s) link and, when uploads are configured, one of the maker's own files in our storage (the rule it was written under). */
export function publicLogo(userId: string, url: string): boolean {
  if (!isHttpUrl(url)) return false;
  const cfg = storageConfig();
  return cfg ? isOwnLogoUrl(cfg, userId, url) : true;
}
