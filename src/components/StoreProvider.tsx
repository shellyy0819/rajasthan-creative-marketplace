'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product, Workshop } from '@/lib/types';
import { money } from '@/lib/money';
import { CartDialog } from './CartDialog';
import { BookingDialog } from './BookingDialog';

export type CartItem = { productId: string; name: string; pricePaise: number; stock: number; quantity: number };
type Store = {
  items: CartItem[]; count: number; total: number;
  addToCart(p: Product): void; removeFromCart(id: string): void;
  cartOpen: boolean; setCartOpen(b: boolean): void;
  booking: Workshop | null; openBooking(w: Workshop): void; closeBooking(): void;
  notify(msg: string): void;
  checkout(f: { customerName: string; email: string }): Promise<void>;
  reserve(f: { workshopId: string; attendeeName: string; email: string; quantity: number }): Promise<void>;
};

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
};

async function api<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Something went wrong');
  return data as T;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [booking, setBooking] = useState<Workshop | null>(null);
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('rr-cart');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed.filter(i => i && typeof i.productId === 'string' && Number.isInteger(i.quantity) && i.quantity > 0));
      }
    } catch {}
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem('rr-cart', JSON.stringify(items)); } catch {}
  }, [items, hydrated]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 3000);
  }, []);

  const addToCart = useCallback((p: Product) => {
    const ex = items.find(i => i.productId === p.id);
    if ((ex?.quantity ?? 0) >= p.stock) { notify('That is all the stock currently available.'); return; }
    notify(`${p.name} added to your bag.`);
    setItems(cur => {
      const e = cur.find(i => i.productId === p.id);
      return e
        ? cur.map(i => (i.productId === p.id ? { ...i, quantity: i.quantity + 1, stock: p.stock } : i))
        : [...cur, { productId: p.id, name: p.name, pricePaise: p.pricePaise, stock: p.stock, quantity: 1 }];
    });
  }, [items, notify]);

  const removeFromCart = useCallback((id: string) => setItems(cur => cur.filter(i => i.productId !== id)), []);

  const checkout = useCallback<Store['checkout']>(async f => {
    if (!items.length) return notify('Your bag is empty.');
    try {
      const order = await api<{ totalPaise: number }>('/api/orders', {
        ...f, items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      });
      setItems([]); setCartOpen(false);
      notify(`Order created! Total ${money(order.totalPaise)}. No payment collected.`);
    } catch (e) { notify((e as Error).message); }
    router.refresh();
  }, [items, notify, router]);

  const reserve = useCallback<Store['reserve']>(async f => {
    try {
      const b = await api<{ status: string; title: string }>('/api/bookings', f);
      setBooking(null);
      notify(`${b.status.includes('FREE') ? 'Free spot confirmed' : 'Booking created'} — ${b.title}. No payment collected.`);
    } catch (e) { notify((e as Error).message); }
    router.refresh();
  }, [notify, router]);

  const value = useMemo<Store>(() => ({
    items, count: items.reduce((s, i) => s + i.quantity, 0),
    total: items.reduce((s, i) => s + i.pricePaise * i.quantity, 0),
    addToCart, removeFromCart, cartOpen, setCartOpen,
    booking, openBooking: setBooking, closeBooking: () => setBooking(null),
    notify, checkout, reserve,
  }), [items, cartOpen, booking, addToCart, removeFromCart, notify, checkout, reserve]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <CartDialog />
      <BookingDialog />
      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </Ctx.Provider>
  );
}
