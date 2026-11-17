import { money } from './money';
import type { Product } from './types';

/** The default first line a buyer sends a maker, by WhatsApp or email: who, what they saw, and that they are interested. */
export const enquiryMessage = (p: Pick<Product, 'seller' | 'name' | 'pricePaise'>) =>
  `Hi ${p.seller}, I saw ${p.name} (${money(p.pricePaise)}) on Craftofy and I’m interested.`;
