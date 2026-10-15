export type Product = {
  id: string; name: string; category: string; city: string; pricePaise: number;
  seller: string; description: string; stock: number; status: string;
  artistName?: string; instagram?: string; youtube?: string; phone?: string; email?: string; imageUrl?: string;
};
export type Workshop = {
  id: string; title: string; type: 'FREE' | 'PAID'; pricePaise: number; city: string;
  venue: string; date: string; time: string; seats: number; booked: number;
  host: string; description: string; status: string;
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
export type Db = { products: Product[]; workshops: Workshop[]; orders: Order[]; bookings: Booking[] };
