import { MakersCarousel } from './MakersCarousel';
import { getHomeMakers } from '@/lib/home-cache';

/** Loads the home-page makers (cached with the rest of the home data) by itself so the page can stream them. Nothing is drawn when no maker has a published product yet. */
export async function HomeMakers() {
  const makers = await getHomeMakers();
  return makers.length ? <MakersCarousel makers={makers} /> : null;
}
