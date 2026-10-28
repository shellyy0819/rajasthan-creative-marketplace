import Link from 'next/link';
import type { City } from '@/lib/cities';

const MESSAGE = "Right now we don't have anything for you to shop at, but you can still explore nearby cities' shops and workshops.";

/** Empty state shown when the visitor's city has no approved products or workshops. */
export function NearbyCities({ cities }: { cityName: string; cities: (City & { km: number })[] }) {
  return (
    <div className="empty nearby-cities">
      <p>{MESSAGE}</p>
      {cities.length > 0 && (
        <div className="link-row">
          {cities.map(c => (
            <Link key={c.id} href={`/cities/${c.slug}`}>
              {c.name}
              {c.km >= 0 && <span className="muted"> ~{Math.round(c.km)} km</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
