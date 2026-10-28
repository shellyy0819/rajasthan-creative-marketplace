import { signCityRef, type CityPick } from '../../src/lib/city-ref';

process.env.NEXTAUTH_SECRET ??= 'test-secret';

const PICKS: Record<string, CityPick> = {
  Udaipur: { osmType: 'relation', osmId: 1001, name: 'Udaipur', state: 'Rajasthan', lat: 24.5854, lng: 73.7125 },
  Jaipur: { osmType: 'relation', osmId: 1002, name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
  Jodhpur: { osmType: 'relation', osmId: 1003, name: 'Jodhpur', state: 'Rajasthan', lat: 26.2389, lng: 73.0243 },
  Kota: { osmType: 'relation', osmId: 1004, name: 'Kota', state: 'Rajasthan', lat: 25.2138, lng: 75.8648 },
};

/** A freshly signed cityRef for a known test city, as place search would hand to the client. */
export const cityRef = (name: keyof typeof PICKS | string): string => signCityRef(PICKS[name]);
