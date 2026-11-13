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
      sign: 'Craftofy · Handmade',
      chalkLabel: 'Handmade',
      chalkTitle: 'Meet the maker',
      chalkSub: 'Made across India',
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
  'govardhan': {
    label: 'Govardhan Pooja',
    sample: { startsAt: '2026-11-09T06:00', endsAt: '2026-11-09T23:59' },
    primary: '#8A4B14',
    brand: { '--green': '#8A4B14', '--green-d': '#703D10', '--orange': '#C2561F', '--orange-2': '#C2561F', '--on-green': '#FFF4DC' },
    stall: {
      '--sand': '#F0D9A8', '--sage': '#D9B77A', '--stall-indigo': '#7A4A1E', '--stall-mustard': '#E8A92E', '--stall-wood': '#A5703F', '--stall-wood-d': '#76481F', '--stall-terra-d': '#8E3A14', '--stall-chalk': '#FFF6E2', '--stall-board': '#2A1A0E', '--stall-ground': '#E6CFA0',
    },
    config: {
      banner: "Govardhan Pooja · annakut wishes from makers near you",
      sign: "Maker's Row · Annakut Special",
      chalkLabel: 'Annakut special',
      chalkTitle: 'Handmade feast gifts',
      chalkSub: 'Free gift wrapping',
      bunting: false,
      stickers: place('gflags', 'gmound', 'gbowls', 'diya1', 'diya2', 'rangoli'),
    },
  },
  'bhaidooj': {
    label: 'Bhai Dooj',
    sample: { startsAt: '2026-11-11T06:00', endsAt: '2026-11-11T23:59' },
    primary: '#0F5C6E',
    brand: { '--green': '#0F5C6E', '--green-d': '#0C4A59', '--orange': '#C93A52', '--orange-2': '#C93A52', '--on-green': '#F2FBFC' },
    stall: {
      '--sand': '#DDEFEF', '--sage': '#A9D2D4', '--stall-indigo': '#14505F', '--stall-mustard': '#E5A92E', '--stall-wood': '#A87A4A', '--stall-wood-d': '#78502B', '--stall-terra-d': '#9C2A3E', '--stall-chalk': '#FFF8EA', '--stall-board': '#0F2A31', '--stall-ground': '#CFE5E5',
    },
    config: {
      banner: "Happy Bhai Dooj · handmade gifts for brothers and sisters",
      sign: "Maker's Row · Bhai Dooj Gifts",
      chalkLabel: 'Bhai Dooj gifts',
      chalkTitle: 'Sweets & keepsakes',
      chalkSub: 'Wrapped with love',
      bunting: true,
      stickers: place('bthread', 'btika', 'bsweets', 'diya1', 'kalash', 'rangoli'),
    },
  },
  'chhath': {
    label: 'Chhath Puja',
    sample: { startsAt: '2026-11-15T06:00', endsAt: '2026-11-15T23:59' },
    primary: '#B5440F',
    brand: { '--green': '#B5440F', '--green-d': '#933609', '--orange': '#E08A1E', '--orange-2': '#E08A1E', '--on-green': '#FFF6E6' },
    stall: {
      '--sand': '#F7DDB0', '--sage': '#EBB877', '--stall-indigo': '#8A3A1A', '--stall-mustard': '#F2B01E', '--stall-wood': '#A8703C', '--stall-wood-d': '#78481E', '--stall-terra-d': '#8E3410', '--stall-chalk': '#FFF6E4', '--stall-board': '#2B140A', '--stall-ground': '#F1D6A4',
    },
    config: {
      banner: "Chhath Puja · handmade offerings from makers near you",
      sign: "Maker's Row · Chhath Puja",
      chalkLabel: 'Chhath special',
      chalkTitle: 'Soop & sugarcane',
      chalkSub: 'Fresh from the maker',
      bunting: false,
      stickers: place('csun', 'ccane', 'csoop', 'ddiyas', 'kalash'),
    },
  },
  'guru-nanak': {
    label: 'Guru Nanak Jayanti',
    sample: { startsAt: '2026-11-24T06:00', endsAt: '2026-11-24T23:59' },
    primary: '#1F3F8F',
    brand: { '--green': '#1F3F8F', '--green-d': '#18326F', '--orange': '#E08A1E', '--orange-2': '#E08A1E', '--on-green': '#F4F7FF' },
    stall: {
      '--sand': '#E6E9F5', '--sage': '#B4BEE0', '--stall-indigo': '#233E85', '--stall-mustard': '#F0B52A', '--stall-wood': '#A57B4B', '--stall-wood-d': '#76512C', '--stall-terra-d': '#2B4A9C', '--stall-chalk': '#FFF9EA', '--stall-board': '#10183A', '--stall-ground': '#D7DCEF',
    },
    config: {
      banner: "Guru Nanak Jayanti · handmade lights from makers near you",
      sign: "Maker's Row · Prakash Utsav",
      chalkLabel: 'Prakash Utsav',
      chalkTitle: 'Lamps & sweets boxes',
      chalkSub: 'Gift wrapping included',
      bunting: false,
      stickers: place('nhanging', 'ncandles', 'nbowl', 'dlights', 'ddiyas', 'drangoli'),
    },
  },
  'thanksgiving': {
    label: 'Thanksgiving',
    sample: { startsAt: '2026-11-26T06:00', endsAt: '2026-11-26T23:59' },
    primary: '#8C3B12',
    brand: { '--green': '#8C3B12', '--green-d': '#72300E', '--orange': '#C9771E', '--orange-2': '#C9771E', '--on-green': '#FFF4E2' },
    stall: {
      '--sand': '#F0DAB8', '--sage': '#D4A56E', '--stall-indigo': '#6B3A1C', '--stall-mustard': '#E0A02A', '--stall-wood': '#9A6A3C', '--stall-wood-d': '#6E4524', '--stall-terra-d': '#7C2E10', '--stall-chalk': '#FFF6E6', '--stall-board': '#2A1608', '--stall-ground': '#E7CFA3',
    },
    config: {
      banner: "Happy Thanksgiving · handmade gifts from makers near you",
      sign: "Maker's Row · Thanksgiving Market",
      chalkLabel: 'Thanksgiving',
      chalkTitle: 'Harvest gifts',
      chalkSub: 'Wrapped free',
      bunting: true,
      stickers: place('tgarland', 'tpumpkins', 'tleaves', 'tturkey'),
    },
  },
} as const satisfies Record<string, Preset>;

export type PresetKey = keyof typeof PRESETS;
export const isPresetKey = (v: unknown): v is PresetKey => typeof v === 'string' && Object.hasOwn(PRESETS, v);
export const EVERYDAY: Preset = PRESETS.everyday;
