'use client';
import { useEffect, useRef } from 'react';
import { getSession, signOut, useSession } from 'next-auth/react';

const isApiCall = (input: RequestInfo | URL): boolean => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
  const path = url.startsWith('http') ? new URL(url).pathname : url;
  return path.startsWith('/api/') && !path.startsWith('/api/auth');
};

/**
 * Ends the browser session as soon as the server says the account is deleted or deactivated: the session cookie is cleared,
 * the page reloads on the home page (same landing as the Logout button) and the menu goes back to "Login here". It checks when the session is read (page load, tab focus) and when any /api call
 * comes back 401, so the first action a removed user takes signs them out.
 */
export function SessionGuard() {
  const { data } = useSession();
  const ending = useRef(false);

  useEffect(() => {
    if (!data?.revoked || ending.current) return;
    ending.current = true;
    void signOut({ callbackUrl: '/?signedout=1' });
  }, [data]);

  useEffect(() => {
    const realFetch = window.fetch;
    window.fetch = async (input, init) => {
      const res = await realFetch(input, init);
      if (res.status === 401 && isApiCall(input) && !ending.current) {
        void getSession().then(s => {
          if (s?.revoked && !ending.current) { ending.current = true; void signOut({ callbackUrl: '/?signedout=1' }); }
        }).catch(() => undefined);
      }
      return res;
    };
    return () => { window.fetch = realFetch; };
  }, []);

  return null;
}
