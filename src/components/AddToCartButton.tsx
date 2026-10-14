'use client';
import type { Product } from '@/lib/types';
import { useStore } from './StoreProvider';

export function AddToCartButton({ product }: { product: Product }) {
  const { addToCart } = useStore();
  const soldOut = product.stock < 1;
  return <button className="add-btn" disabled={soldOut} onClick={() => addToCart(product)}>{soldOut ? 'Sold out' : '+ Add to bag'}</button>;
}
