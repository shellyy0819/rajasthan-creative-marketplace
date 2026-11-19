import Link from 'next/link';

/** The seller's two dashboard tabs. Plain links, so a tab can be shared and works without script. */
export function SellerTabs({ current }: { current: 'products' | 'workshops' }) {
  return (
    <nav className="admin-tabs seller-tabs" aria-label="My dashboard">
      <Link href="/dashboard/posts" aria-current={current === 'products' ? 'page' : undefined}>My Products</Link>
      <Link href="/dashboard/posts?tab=workshops" aria-current={current === 'workshops' ? 'page' : undefined}>My Workshops</Link>
    </nav>
  );
}
