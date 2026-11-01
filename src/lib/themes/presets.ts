import type { Placement, Preset } from './types';

const place = (...ids: string[]): Placement[] => ids.map((id) => ({ id, x: 0, y: 0, s: 1 }));

export const PRESETS = {
  everyday: {
    label: 'Everyday',
    primary: '#405746',
    brand: { '--green': '#405746', '--green-d': '#374A3B', '--orange': '#C66B43', '--orange-2': '#C16C47', '--on-green': '#FFFFFF' },
    stall: {},
    config: {
      banner: 'Handmade, direct from the maker',
      sign: "Maker's Row · Stall 12",
      chalkLabel: 'Live today',
      chalkTitle: 'Block printing',
      chalkSub: '4 pm · free to try',
      bunting: true,
      stickers: [],
    },
  },
  dhanteras: {
    label: 'Dhanteras',
    sample: { startsAt: '2026-11-05T06:00', endsAt: '2026-11-06T23:59' },
    primary: '#6E1A2A',
    brand: { '--green': '#6E1A2A', '--green-d': '#581522', '--orange': '#B3262E', '--orange-2': '#B3262E', '--on-green': '#FFF3D6' },
    stall: {
      '--sand': '#F2D79B', '--sage': '#E7B96B', '--stall-indigo': '#6A1F32', '--stall-mustard': '#E8B02E',
      '--stall-wood': '#A9713F', '--stall-wood-d': '#7A4A26', '--stall-terra-d': '#7E1620',
      '--stall-chalk': '#FFF6E2', '--stall-board': '#2A0F14', '--stall-ground': '#E5C98C',
    },
    config: {
      banner: 'Shubh Dhanteras · handmade finds from makers near you',
      sign: "Maker's Row · Dhanteras Special",
      chalkLabel: 'Dhanteras special',
      chalkTitle: 'Brass & diya sets',
      chalkSub: 'Free gift wrapping',
      bunting: false,
      stickers: place('toran', 'lights', 'diya1', 'diya2', 'kalash', 'rangoli', 'lantern'),
    },
  },
  diwali: {
    label: 'Diwali',
    sample: { startsAt: '2026-11-07T06:00', endsAt: '2026-11-09T23:59' },
    primary: '#7A1F5C',
    brand: { '--green': '#7A1F5C', '--green-d': '#62194A', '--orange': '#D2491F', '--orange-2': '#D2491F', '--on-green': '#FFF3D9' },
    stall: {
      '--sand': '#F6C98A', '--sage': '#F0A35E', '--stall-indigo': '#5B2A86', '--stall-mustard': '#F2B01E',
      '--stall-wood': '#A5683A', '--stall-wood-d': '#78441F', '--stall-terra-d': '#9E3414',
      '--stall-chalk': '#FFF6E4', '--stall-board': '#2A1030', '--stall-ground': '#F2D3A0',
    },
    config: {
      banner: 'Shubh Deepavali · handmade gifts from makers near you',
      sign: "Maker's Row · Diwali Bazaar",
      chalkLabel: 'Diwali special',
      chalkTitle: 'Diyas & mithai boxes',
      chalkSub: 'Gift wrapping included',
      bunting: false,
      stickers: place('dfire', 'dkandil', 'dlights', 'ddiyas', 'dthali', 'drangoli'),
    },
  },
  christmas: {
    label: 'Christmas',
    sample: { startsAt: '2026-12-18T06:00', endsAt: '2026-12-25T23:59' },
    primary: '#1E5B3A',
    brand: { '--green': '#1E5B3A', '--green-d': '#18492E', '--orange': '#B3262E', '--orange-2': '#B3262E', '--on-green': '#FFF8EC' },
    stall: {
      '--sand': '#DCE8E2', '--sage': '#9DB8A9', '--stall-indigo': '#1F4D3A', '--stall-mustard': '#D9A93A',
      '--stall-wood': '#A87550', '--stall-wood-d': '#7A5232', '--stall-terra-d': '#861B22',
      '--stall-chalk': '#FFFAF0', '--stall-board': '#14261C', '--stall-ground': '#E8EEEA',
    },
    config: {
      banner: 'Merry Christmas · handmade gifts from makers near you',
      sign: "Maker's Row · Christmas Market",
      chalkLabel: 'Christmas market',
      chalkTitle: 'Handmade gifts',
      chalkSub: 'Wrapped free',
      bunting: false,
      stickers: place('xtree', 'xwreath', 'xlights', 'xgifts', 'xsnow', 'xstar', 'xsanta'),
    },
  },
} as const satisfies Record<string, Preset>;

export type PresetKey = keyof typeof PRESETS;
export const isPresetKey = (v: unknown): v is PresetKey => typeof v === 'string' && Object.hasOwn(PRESETS, v);
export const EVERYDAY: Preset = PRESETS.everyday;
