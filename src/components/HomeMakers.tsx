import { MakersCarousel } from './MakersCarousel';
import { getHomeMakers } from '@/lib/home-cache';
import { getHomeSettings } from '@/lib/home-settings';
import { DEFAULT_HOME_SETTINGS } from '@/lib/home-settings-shared';

/** Loads the home-page makers (cached with the rest of the home data) by itself so the page can stream them, with the admin's choice of seconds per maker. Nothing is drawn when no maker has a published product yet. */
export async function HomeMakers() {
  const [makers, settings] = await Promise.all([getHomeMakers(), getHomeSettings().catch(() => DEFAULT_HOME_SETTINGS)]);   // a settings hiccup must not hide the sellers
  return makers.length ? <MakersCarousel makers={makers} rotateSeconds={settings.makersRotateSeconds} /> : null;
}
