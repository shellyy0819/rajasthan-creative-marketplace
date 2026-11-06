'use client';
import { useEffect, useRef, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useStore } from './StoreProvider';
import { money } from '@/lib/money';

export function CartDialog() {
  const { items, total, removeFromCart, cartOpen, setCartOpen, checkout } = useStore();
  const { data: session } = useSession();
  const ref = useRef<HTMLDialogElement>(null);
  const [placing, setPlacing] = useState(false);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (cartOpen && !d.open) d.showModal();
    if (!cartOpen && d.open) d.close();
  }, [cartOpen]);
  return (
    <dialog ref={ref} onClose={() => setCartOpen(false)} aria-labelledby="cart-title">
      <div className="dialog-head">
        <h2 id="cart-title">Your bag</h2>
        <button className="icon-btn" onClick={() => setCartOpen(false)} aria-label="Close bag">✕</button>
      </div>
      {items.length === 0 ? (
        <p className="empty-cart">Your bag is waiting for something lovely.</p>
      ) : items.map(i => (
        <div className="cart-line" key={i.productId}>
          <div>{i.name}<small>{money(i.pricePaise)} × {i.quantity}</small></div>
          <div><b>{money(i.pricePaise * i.quantity)}</b><br /><button onClick={() => removeFromCart(i.productId)}>Remove</button></div>
        </div>
      ))}
      <div className="cart-total"><span>Subtotal</span><b>{money(total)}</b></div>
      <form onSubmit={async e => {
        e.preventDefault();
        if (placing) return;
        const form = e.currentTarget;
        const f = new FormData(form);
        setPlacing(true);
        try {
          await checkout({ customerName: String(f.get('customerName')), email: String(f.get('email')) });
          form.reset();
        } catch { /* the store reports the error; keep the form as typed */ } finally { setPlacing(false); }
      }}>
        <label><span className="lbl">Your name</span><input name="customerName" required placeholder="Name" /></label>
        <label><span className="lbl">Email</span><input name="email" type="email" required placeholder="you@example.com" defaultValue={session?.user?.email ?? ''} /></label>
        {session?.user
          ? <button className="button primary full" type="submit" disabled={placing} aria-busy={placing}>Place order</button>
          : <button className="button primary full" type="button" onClick={() => signIn('google')}>Sign in with Google to order</button>}
        <p className="fine-print">No payment is collected.</p>
      </form>
    </dialog>
  );
}
