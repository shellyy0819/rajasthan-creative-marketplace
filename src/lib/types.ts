import type { Kind, Level, Mode, PriceRow, Schedule } from './workshop-listing';
/** How a product came to be listed. Managed by admins; see lib/sourcing-types.ts. */
export type SourcingType = { id: number; name: string; countsAsHandmade: boolean; showBadge: boolean; position: number; active: boolean };
export type AdminSourcingType = SourcingType & { productCount: number };
export type Product = {
  id: string; name: string; category: string; city: string; cityId: number; citySlug: string; cityState?: string; pricePaise: number | null;
  seller: string; description: string; stock: number; status: string;
  instagram?: string; youtube?: string; phone?: string; whatsapp?: string; email?: string; imageUrl?: string; workshopId?: string;
  sourcing?: Pick<SourcingType, 'id' | 'name' | 'countsAsHandmade' | 'showBadge'>;
  images?: string[]; likeCount?: number; sellerSlug?: string; sellerLogo?: string; artistBio?: string; artistCity?: string;
};
/** What admins and sellers see: the public product plus ownership and publishing details. */
export type AdminProduct = Product & {
  sellerId: string; sellerEmail: string; pickupLocation?: string; publishedBy?: string; publishedAt?: string;
  publishedByEmail?: string; workshopTitle?: string; createdAt?: string; updatedAt?: string;
};
export type Workshop = {
  id: string; title: string; type: 'FREE' | 'PAID'; pricePaise: number;
  kind: Kind; mode: Mode; topicId: number | null; topic?: { id: number; name: string; slug: string };
  city: string | null; cityId: number | null; citySlug: string | null; cityState?: string;
  venue: string | null; date: string; time: string; endsOn: string | null; seats: number | null; booked: number;
  host: string; description: string; status: string; hostId?: string;
  platform: string | null; schedule: Schedule | null; languages: string[]; level: Level | null;
  experience: string | null; certifications: string | null; freeTrial: boolean;
  whatsapp: string | null; instagram: string | null; website: string | null; images: string[]; prices: PriceRow[];
  /** Admin-only: how staff reach the host, who added the listing and which request it came from. The public mapper never sets these. */
  contactName?: string; contactPhone?: string; contactEmail?: string; createdBy?: string; sourceRequestId?: string;
};
export type OrderItem = {
  productId: string; name: string; seller: string; quantity: number;
  unitPricePaise: number; lineTotalPaise: number;
};
export type Order = {
  id: string; createdAt: string; userEmail: string; customerName: string; email: string;
  items: OrderItem[]; totalPaise: number; status: string; note: string;
};
export type Booking = {
  id: string; createdAt: string; userEmail: string; workshopId: string; title: string; attendeeName: string;
  email: string; quantity: number; totalPaise: number; status: string; note: string;
};
export type ContactMethod = 'whatsapp' | 'instagram' | 'website' | 'phone';
export type SellerProfile = {
  userId: string; displayName: string; publicPhone?: string; publicEmail?: string; instagram?: string; youtube?: string; bio?: string; city?: string; cityId?: number;
  website?: string; category?: string; logoUrl?: string; whatsapp?: string; contactMethods?: ContactMethod[]; onboardedAt?: string;
};
export type AdminUser = {
  id: string; email: string; name: string; active: boolean; roles: ('seller' | 'admin')[]; createdAt: string;
  products: number; workshops: number; orders: number; bookings: number;
};
/** Shape of data/db.json (the old JSON-file store); still the seed format. */
export type LegacyProduct = Product & { artistName?: string };
export type Db = { products: LegacyProduct[]; workshops: Workshop[]; orders: Order[]; bookings: Booking[]; counters?: { p?: number; w?: number } };
