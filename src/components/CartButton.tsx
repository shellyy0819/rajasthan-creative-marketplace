'use client';
import { useStore } from './StoreProvider';

export function CartButton() {
  const { count, setCartOpen } = useStore();
  return <button className="cart-btn" onClick={() => setCartOpen(true)} aria-haspopup="dialog">Bag <span aria-label={`${count} items`}>{count}</span></button>;
}
