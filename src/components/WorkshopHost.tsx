import Link from 'next/link';

/** The host's photo on a workshop card, or the round placeholder when they have none. Colours come from the theme tokens, so it follows light and dark mode. */
function HostAvatar({ logo }: { logo?: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="ws-host-avatar" src={logo} alt="" width={20} height={20} loading="lazy" referrerPolicy="no-referrer" />;
  }
  return (
    <svg className="ws-host-avatar" viewBox="0 0 32 32" width="20" height="20" aria-hidden="true">
      <circle cx="16" cy="16" r="15" style={{ fill: 'var(--cream)', stroke: 'var(--line)' }} strokeWidth="1" />
      <path d="M5.5 26.5c1.2-5.2 5.4-8 10.5-8s9.3 2.8 10.5 8a15 15 0 0 1-21 0Z" style={{ fill: 'var(--green)' }} />
      <circle cx="16" cy="12.5" r="5.2" style={{ fill: 'var(--orange)' }} />
    </svg>
  );
}

/** "Host: <photo> Name" on a card. The name opens the host's Craftofy profile (/artists/<slug>) when they have one; otherwise it is plain text. */
export function WorkshopHost({ label, host, slug, logo }: { label: 'Host' | 'Instructor'; host: string; slug?: string; logo?: string }) {
  return (
    <span className="ws-host">
      {label}: <HostAvatar logo={logo} />
      {slug ? <Link className="ws-host-link" href={`/artists/${slug}`}>{host}</Link> : host}
    </span>
  );
}
