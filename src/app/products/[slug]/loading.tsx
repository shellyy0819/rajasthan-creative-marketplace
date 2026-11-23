import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ProductPreviewShell } from '@/components/ProductPreviewShell';

/** Shown the moment a product card is clicked, while the page's data loads: the page's own frame, filled with the card's data when there is one. */
export default function ProductLoading() {
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: 'Product', path: '/shop' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <ProductPreviewShell />
    </>
  );
}
