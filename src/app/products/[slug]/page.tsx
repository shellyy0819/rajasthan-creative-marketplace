import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { MakerCard } from "@/components/MakerCard";
import { LikeButton } from "@/components/LikeButton";
import { TrackOnMount } from "@/components/TrackOnMount";
import { ProductGallery } from "@/components/ProductGallery";
import { visualIndex } from "@/components/ProductCard";
import { ProductPlaceholder } from "@/components/ProductPlaceholder";
import { RelatedProducts } from "@/components/RelatedProducts";
import { getProductBySlug, productSlug } from "@/lib/catalog";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/jsonld";
import { isHandmade, madeByPhrase } from "@/lib/handmade";
import { pageMetadata } from "@/lib/meta";
import { hasSharePhoto } from "@/lib/share-image";
import { money } from "@/lib/money";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return { title: "Product not found", robots: { index: false } };
  return pageMetadata({
    title: isHandmade(p) ? `${p.name} — handmade in ${p.city}` : `${p.name} — from ${p.city}`,
    description: `${p.description} ${madeByPhrase(p)} ${p.seller} in ${p.city}. ${money(p.pricePaise)}.`,
    path: `/products/${productSlug(p)}`,
    // A small copy of the first photo when there is one (so WhatsApp and others show the real product); otherwise the generated card.
    image: hasSharePhoto(p) ? `/products/${productSlug(p)}/share-image` : false,
  });
}

export default async function ProductPage({ params }: Props) {
  const p = await getProductBySlug((await params).slug);
  if (!p) notFound();
  const i = visualIndex(p.id);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
    { name: p.name, path: `/products/${productSlug(p)}` },
  ];
  return (
    <>
      <JsonLd data={[productJsonLd(p), breadcrumbJsonLd(crumbs)]} />
      <Breadcrumbs items={crumbs} />
      <article className="detail">
        <ProductGallery
          images={p.images ?? (p.imageUrl ? [p.imageUrl] : [])}
          alt={p.name}
          variant={i}
          fallback={<ProductPlaceholder />}
        />
        <div>
          <span className="product-meta">{p.category}</span>
          <h1>{p.name}</h1>
          {p.sourcing?.showBadge && (
            <p className="detail-tags">
              <span className="source-tag" data-testid="sourcing-tag">
                {p.sourcing.name}
              </span>
            </p>
          )}
          <TrackOnMount productId={p.id} type="view" />
          <p className="detail-price">
            <span className="price">{money(p.pricePaise)}</span>
            <small>Price set by the maker</small>
          </p>
          <p className="lead">{p.description}</p>
          <MakerCard product={p} />
          <dl>
            <dt>
              <span className="detail-label">
                <svg
                  className="detail-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                City
              </span>
            </dt>
            <dd>
              <Link href={`/cities/${p.citySlug}`}>{p.city}</Link>
            </dd>
            <dt>
              <span className="detail-label">
                <svg
                  className="detail-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="m3 7 9-4 9 4v10l-9 4-9-4V7Z" />
                  <path d="m3 7 9 4 9-4M12 11v10" />
                </svg>
                Availability
              </span>
            </dt>
            <dd>{p.stock > 0 ? `${p.stock} in stock` : "Sold out"}</dd>
            <dt>
              <span className="detail-label">How it’s made</span>
            </dt>
            <dd>
              <b>
                {isHandmade(p)
                  ? "Handmade by the artist"
                  : `${madeByPhrase(p)} ${p.seller}`}
              </b>
            </dd>
          </dl>
          {isHandmade(p) && (
            <ul className="detail-pills">
              <li>Direct from the maker</li>
            </ul>
          )}
          <div className="detail-like">
            <p className="detail-like-prompt">If you really liked the product, give it a like</p>
            <LikeButton
              productId={p.id}
              initialCount={p.likeCount ?? 0}
              productName={p.name}
            />
          </div>
        </div>
      </article>
      <Suspense fallback={null}>
        <RelatedProducts product={p} />
      </Suspense>
    </>
  );
}
