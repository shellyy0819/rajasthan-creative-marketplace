/** Shapes shared by the exhibition's server code (data, presence, settings) and its client components. */

/** What the admin toggle chooses: stalls built from live approved sellers, or the invented sample makers. */
export type FairSource = 'real' | 'sample';

/** Artwork drawn for a product on the shelf and on its card. */
export type ArtKind = 'frock' | 'lily' | 'rose' | 'tulip' | 'drop' | 'chandbali' | 'bands' | 'pot' | 'bowls' | 'coaster' | 'tray' | 'stole' | 'saree' | 'suit' | 'woodtoy' | 'woodbox' | 'tree' | 'ornament' | 'stocking' | 'box';
/** Which craft a maker's "watch them work" moment shows. */
export type CraftKind = 'crochet' | 'pottery' | 'resin' | 'jewellery' | 'print' | 'wood' | 'christmas' | 'handmade';
/** Colours a maker is drawn in; the names are design tokens (see globals.css). */
export type MakerLook = { skin: 'skin' | 'skin-2'; top: string; acc: string; long?: boolean; bun?: boolean };

export type FairItem = {
  key: string; name: string; pricePaise: number; art: ArtKind; color?: string;
  /** Link to the real product page; absent for sample items. */
  href?: string; imageUrl?: string;
};
export type FairMaker = {
  id: string; name: string; city: string; craft: CraftKind; category: string; look: MakerLook;
  greet: string; thanks: string; items: FairItem[];
  /** Link to the real artist page; absent for sample makers. */
  href?: string;
  /** The stall that has the full-length mirror (exactly one). */
  mirror?: boolean;
};
/** One of the eight places on the fair floor: a maker's stall, or an open stall (named for the category it is waiting for). */
export type FairStall = { maker: FairMaker | null; label: string };
/** `stalls` is the floor plan (always 8, row by row); `makers` is just the stalls that have one. */
export type FairData = { source: FairSource; stalls: FairStall[]; makers: FairMaker[] };

export type Facing = 'up' | 'down' | 'left' | 'right';
export type Emote = 'wave' | 'namaste' | 'hello';
/** Another visitor, as the presence endpoint reports them. The character is derived from `code` on the client. */
export type FairVisitor = { code: string; x: number; y: number; facing: Facing; look: string | null; emote: Emote | null; emoteSeq: number };
