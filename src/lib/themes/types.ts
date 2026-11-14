import type { PresetKey } from './presets';

export type Placement = { id: string; x: number; y: number; s: number };

export type ThemeConfig = {
  primary?: string;
  banner: string;
  sign: string;
  chalkLabel: string;
  chalkTitle: string;
  chalkSub: string;
  /** Where the chalkboard leads when clicked: a path on this site or an https address. Optional; the shop is used when empty. */
  chalkHref?: string;
  bunting: boolean;
  stickers: Placement[];
};

export type BrandToken = '--green' | '--green-d' | '--orange' | '--orange-2' | '--on-green';
export type StallToken =
  | '--sand' | '--sage' | '--clay' | '--stall-indigo' | '--stall-mustard' | '--stall-wood'
  | '--stall-wood-d' | '--stall-terra-d' | '--stall-chalk' | '--stall-board' | '--stall-ground';

export type Preset = {
  label: string;
  /** IST 'YYYY-MM-DDTHH:mm' */
  sample?: { startsAt: string; endsAt: string };
  primary: string;
  brand: Record<BrandToken, string>;
  stall: Partial<Record<StallToken, string>>;
  config: ThemeConfig;
};

export type ThemeStatus = 'draft' | 'scheduled' | 'base';
export type ThemeState = 'draft' | 'scheduled' | 'live' | 'ended' | 'base';

export type ThemeRow = {
  id: number;
  preset: PresetKey;
  status: ThemeStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  config: ThemeConfig;
  updatedAt: Date;
  updatedBy?: string;
};

export const LIMITS = { banner: 60, sign: 34, chalkLabel: 18, chalkTitle: 20, chalkSub: 26, chalkHref: 200 } as const;

/** The chalkboard is drawn only while at least one of its three lines has text. */
export const hasChalkboard = (c: Pick<ThemeConfig, 'chalkLabel' | 'chalkTitle' | 'chalkSub'>): boolean => !!(c.chalkLabel.trim() || c.chalkTitle.trim() || c.chalkSub.trim());
