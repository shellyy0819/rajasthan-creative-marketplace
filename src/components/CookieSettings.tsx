'use client';
import { OPEN_SETTINGS_EVENT } from './Analytics';

/** Footer link: lets visitors change their mind about analytics cookies. */
export function CookieSettings() {
  return <button type="button" className="text-link cookie-settings" onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}>Cookie settings</button>;
}
