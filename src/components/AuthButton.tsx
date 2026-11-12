'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';

/** Fired on the window to open the profile when the dashboard posts page is already showing. */
export const OPEN_PROFILE_EVENT = 'craftofy:open-profile';

/** The seller's brand logo, or a default person icon while there is none (or it cannot be loaded). */
function MenuAvatar({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => { setFailed(false); }, [src]);
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src]);
  if (src && !failed) {
    // Plain <img>: the logo lives on the storage host, which next/image cannot know up front.
    // eslint-disable-next-line @next/next/no-img-element
    return <img ref={ref} className="avatar-img" src={src} alt="" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  }
  return (
    <svg className="avatar-default" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}

/** `dashboardUrl` is the dashboard host's origin when the dashboard lives on its own subdomain (empty: same site). */
export function AuthButton({ dashboardUrl = '' }: { dashboardUrl?: string }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [logo, setLogo] = useState<string | undefined>();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const staff = session?.user?.role === 'seller' || session?.user?.role === 'admin';

  useEffect(() => {
    if (!staff) return;
    let live = true;
    fetch('/api/profile', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(p => { if (live && p && typeof p.logoUrl === 'string') setLogo(p.logoUrl); })
      .catch(() => {});
    return () => { live = false; };
  }, [staff]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (status === 'loading') return <span className="cart-btn" aria-hidden="true" style={{ visibility: 'hidden' }}>Sign in</span>;
  if (!session?.user) {
    const login = () => signIn('google', { callbackUrl: '/sell' });
    return (
      <>
        <span className="seller-prompt">
          Are you a seller?{' '}
          <button type="button" className="seller-login-link" onClick={login}>Login here</button>
        </span>
        <button type="button" className="cart-btn seller-login-btn" onClick={login}>Login here</button>
      </>
    );
  }
  const posts = `${dashboardUrl}/dashboard/posts`;
  const profileHref = `${posts}?profile=1`;
  const openProfile = (e: React.MouseEvent) => {
    setOpen(false);
    // Already on the posts page of this site: open the dialog in place instead of reloading the page.
    const here = dashboardUrl ? dashboardUrl === window.location.origin : true;
    if (here && window.location.pathname === '/dashboard/posts') {
      e.preventDefault();
      window.dispatchEvent(new Event(OPEN_PROFILE_EVENT));
    }
  };
  return (
    <>
      {session.user.role === 'admin' && <Link href={posts}>Admin</Link>}
      {session.user.role === 'seller' && <Link href={posts}>My products</Link>}
      <div className="user-menu" ref={wrap}>
        <button ref={trigger} type="button" className="user-menu-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" title={session.user.email ?? undefined} onClick={() => setOpen(o => !o)}>
          <MenuAvatar src={logo} />
        </button>
        {open && (
          <div className="user-menu-list" role="menu" aria-label="Account">
            {staff && <Link role="menuitem" href={profileHref} onClick={openProfile}>My profile</Link>}
            <button type="button" role="menuitem" onClick={() => signOut({ callbackUrl: '/?signedout=1' })}>Logout</button>
          </div>
        )}
      </div>
    </>
  );
}
