import type { FairData, FairMaker } from './fair-types';

/** Invented makers and products for the exhibition's "sample" mode. None of this is a real seller or listing. */
const rs = (n: number) => n * 100;
export const SAMPLE_MAKERS: FairMaker[] = [
  { id: 'dhaga', name: 'Rangili Dhaga', city: 'Jaipur', craft: 'crochet', category: 'Crochet', look: { skin: 'skin', top: 'orange', acc: 'mustard', bun: true },
    greet: 'Welcome! Everything on this shelf is crocheted by hand.', thanks: 'Good pick. I will wrap it up for you.',
    items: [
      { key: 'dhaga:0', name: 'Cotton Crochet Dress', pricePaise: rs(1450), art: 'frock' }, { key: 'dhaga:1', name: 'Pink Lotus', pricePaise: rs(220), art: 'lily', color: '#e58aa6' },
      { key: 'dhaga:2', name: 'Red Rose Bloom', pricePaise: rs(210), art: 'rose', color: '#b3262e' }, { key: 'dhaga:3', name: 'Marigold Tulip', pricePaise: rs(140), art: 'tulip', color: '#f29a1f' } ] },
  { id: 'kundan', name: 'Kundan Kothi', city: 'Jodhpur', craft: 'jewellery', category: 'Accessories', look: { skin: 'skin-2', top: 'indigo', acc: 'chalk', long: true }, mirror: true,
    greet: 'Hello! Have a look at the earrings. There is a mirror on the wall if you want to try them on.', thanks: 'These look lovely on. Thank you!',
    items: [ { key: 'kundan:0', name: 'Aqua Pearl Drop Earrings', pricePaise: rs(220), art: 'drop', color: '#4fb6b8' }, { key: 'kundan:1', name: 'Rainbow Chandbali Earrings', pricePaise: rs(240), art: 'chandbali' } ] },
  { id: 'mitti', name: 'Mitti Mahal', city: 'Molela', craft: 'pottery', category: 'Pottery', look: { skin: 'skin-2', top: 'mustard', acc: 'orange' },
    greet: 'Come in! Each piece is shaped on the wheel and fired in a wood kiln.', thanks: 'Handle it gently. It is still a little proud of itself.',
    items: [ { key: 'mitti:0', name: 'Terracotta Planter', pricePaise: rs(380), art: 'pot' }, { key: 'mitti:1', name: 'Stacked Serving Bowls', pricePaise: rs(650), art: 'bowls' } ] },
  { id: 'resin', name: 'Resin Rang', city: 'Kota', craft: 'resin', category: 'Resin Art', look: { skin: 'skin', top: 'green', acc: 'chalk', long: true },
    greet: 'Hi! These coasters are poured one at a time, so no two match.', thanks: 'Lovely choice. Keep it away from hot pans!',
    items: [ { key: 'resin:0', name: 'Ocean Resin Coasters', pricePaise: rs(520), art: 'coaster' }, { key: 'resin:1', name: 'Marigold Resin Tray', pricePaise: rs(340), art: 'tray' } ] },
  { id: 'bandhani', name: 'Bandhani Bazaar', city: 'Pushkar', craft: 'jewellery', category: 'Accessories', look: { skin: 'skin', top: 'sage', acc: 'orange' },
    greet: 'Hi there! Come closer, the hair bands are right here.', thanks: 'Thank you! Enjoy it.',
    items: [ { key: 'bandhani:0', name: 'Silk Hair Bands, set of 3', pricePaise: rs(90), art: 'bands' } ] },
  { id: 'chhapai', name: 'Chhapai Ghar', city: 'Bagru', craft: 'print', category: 'Textiles', look: { skin: 'skin-2', top: 'orange', acc: 'chalk', bun: true },
    greet: 'Namaste! Block by block, these are printed with natural dyes.', thanks: 'A fine stole. It gets softer with every wash.',
    items: [ { key: 'chhapai:0', name: 'Indigo Block-Print Stole', pricePaise: rs(780), art: 'stole', color: '#35506f' }, { key: 'chhapai:1', name: 'Mustard Block-Print Stole', pricePaise: rs(780), art: 'stole', color: '#d9a441' } ] },
];
export const sampleFairData = (): FairData => ({ source: 'sample', makers: SAMPLE_MAKERS });
