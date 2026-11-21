import Link from 'next/link';

/**
 * A round illustrated avatar that opens the host's profile (/artists/<slug>): their other classes, workshops and pieces. It sits with the
 * contact icons under the host's name. Colours come from the theme tokens, so it follows light and dark mode.
 */
export function HostProfileLink({ slug, host }: { slug: string; host: string }) {
  return (
    <Link className="cd-profile" href={`/artists/${slug}`} aria-label={`View ${host}'s profile`} title="View profile">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <circle cx="16" cy="16" r="15" style={{ fill: 'var(--cream)', stroke: 'var(--line)' }} strokeWidth="1" />
        <path d="M5.5 26.5c1.2-5.2 5.4-8 10.5-8s9.3 2.8 10.5 8a15 15 0 0 1-21 0Z" style={{ fill: 'var(--green)' }} />
        <circle cx="16" cy="12.5" r="5.2" style={{ fill: 'var(--orange)' }} />
        <path d="M10.8 11.6c.6-3.2 2.8-4.8 5.2-4.8s4.6 1.6 5.2 4.8c-1.7-1.5-3.3-2.2-5.2-2.2s-3.5.7-5.2 2.2Z" style={{ fill: 'var(--ink)' }} />
      </svg>
    </Link>
  );
}
