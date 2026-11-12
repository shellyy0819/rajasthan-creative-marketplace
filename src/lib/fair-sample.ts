import { DEFAULT_STALLS, fillStalls, makersOf } from './fair-stalls';
import type { FairData, FairMaker } from './fair-types';

/**
 * Invented makers and products for the exhibition's "sample" mode. None of this is a real seller or listing.
 * One maker for each of the five default stalls, in floor order: crochet, resin, wood, sarees and suits, Christmas.
 */
const rs = (n: number) => n * 100;
export const SAMPLE_MAKERS: FairMaker[] = [
  { id: 'dhaga', name: 'Rangili Dhaga', city: 'Jaipur', craft: 'crochet', category: 'Handmade crochet', look: { skin: 'skin', top: 'orange', acc: 'mustard', bun: true },
    greet: 'Welcome! Everything on this shelf is crocheted by hand.', thanks: 'Good pick. I will wrap it up for you.',
    items: [
      { key: 'dhaga:0', name: 'Cotton Crochet Dress', pricePaise: rs(1450), art: 'frock' }, { key: 'dhaga:1', name: 'Pink Lotus', pricePaise: rs(220), art: 'lily', color: '#e58aa6' },
      { key: 'dhaga:2', name: 'Red Rose Bloom', pricePaise: rs(210), art: 'rose', color: '#b3262e' }, { key: 'dhaga:3', name: 'Marigold Tulip', pricePaise: rs(140), art: 'tulip', color: '#f29a1f' } ] },
  { id: 'resin', name: 'Resin Rang', city: 'Kota', craft: 'resin', category: 'Resin Art', look: { skin: 'skin', top: 'green', acc: 'chalk', long: true },
    greet: 'Hi! These coasters are poured one at a time, so no two match.', thanks: 'Lovely choice. Keep it away from hot pans!',
    items: [ { key: 'resin:0', name: 'Ocean Resin Coasters', pricePaise: rs(520), art: 'coaster' }, { key: 'resin:1', name: 'Marigold Resin Tray', pricePaise: rs(340), art: 'tray' } ] },
  { id: 'kaath', name: 'Kaath Ghar', city: 'Bassi', craft: 'wood', category: 'Wood craft', look: { skin: 'skin-2', top: 'mustard', acc: 'orange' },
    greet: 'Come in! Every piece is carved from a single block of local wood.', thanks: 'It will last a lifetime. Mind the little ones, they love the elephant.',
    items: [ { key: 'kaath:0', name: 'Hand-carved Elephant', pricePaise: rs(650), art: 'woodtoy' }, { key: 'kaath:1', name: 'Carved Keepsake Box', pricePaise: rs(890), art: 'woodbox' } ] },
  { id: 'bandhej', name: 'Bandhej Boutique', city: 'Jodhpur', craft: 'print', category: 'Sarees and suits', look: { skin: 'skin-2', top: 'indigo', acc: 'chalk', long: true }, mirror: true,
    greet: 'Namaste! Try anything on at the mirror, the colours look different in the light.', thanks: 'That suits you beautifully. Thank you!',
    items: [
      { key: 'bandhej:0', name: 'Bandhani Saree', pricePaise: rs(2400), art: 'saree', color: '#b3262e' }, { key: 'bandhej:1', name: 'Block-Print Cotton Suit', pricePaise: rs(1650), art: 'suit', color: '#35506f' },
      { key: 'bandhej:2', name: 'Leheriya Dupatta', pricePaise: rs(480), art: 'stole', color: '#e58aa6' } ] },
  { id: 'noel', name: 'Noel Nest', city: 'Ajmer', craft: 'christmas', category: 'Christmas items', look: { skin: 'skin', top: 'sage', acc: 'orange', bun: true },
    greet: 'Merry Christmas! Everything here is made by hand, ready to hang.', thanks: 'Wonderful. It will look lovely on your tree!',
    items: [
      { key: 'noel:0', name: 'Felt Christmas Tree', pricePaise: rs(380), art: 'tree' }, { key: 'noel:1', name: 'Star Ornaments, set of 3', pricePaise: rs(260), art: 'ornament' },
      { key: 'noel:2', name: 'Crochet Christmas Stocking', pricePaise: rs(320), art: 'stocking' } ] },
];
export const sampleFairData = (): FairData => {
  const stalls = fillStalls(SAMPLE_MAKERS.map((m, i) => ({ maker: m, label: DEFAULT_STALLS[i].label })));
  return { source: 'sample', stalls, makers: makersOf(stalls) };
};
