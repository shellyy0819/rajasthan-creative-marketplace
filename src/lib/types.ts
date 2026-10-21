export type Product = {
  id: string; name: string; category: string; city: string; pricePaise: number;
  seller: string; description: string; stock: number; status: string;
  instagram?: string; youtube?: string; phone?: string; email?: string; imageUrl?: string; workshopId?: string;
  likeCount?: number; sellerSlug?: string;
};
/** What admins and sellers see: the public product plus ownership and publishing details. */
export type AdminProduct = Product & {
  sellerId: string; sellerEmail: string; pickupLocation?: string; publishedBy?: string; publishedAt?: string;
  publishedByEmail?: string; workshopTitle?: string; createdAt?: string; updatedAt?: string;
};
export type Workshop = {
  id: string; title: string; type: 'FREE' | 'PAID'; pricePaise: number; city: string;
  venue: string; date: string; time: string; seats: number; booked: number;
  host: string; description: string; status: string; hostId?: string;
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
export type SellerProfile = {
  userId: string; displayName: string; publicPhone?: string; publicEmail?: string; instagram?: string; youtube?: string;
};
export type AdminUser = {
  id: string; email: string; name: string; active: boolean; roles: ('seller' | 'admin')[]; createdAt: string;
  products: number; workshops: number; orders: number; bookings: number;
};
/** Shape of data/db.json (the old JSON-file store); still the seed format. */
export type LegacyProduct = Product & { artistName?: string };
export type Db = { products: LegacyProduct[]; workshops: Workshop[]; orders: Order[]; bookings: Booking[]; counters?: { p?: number; w?: number } };
