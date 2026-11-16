"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Product } from "@/lib/types";
import { SHELF_PAGE_SIZE } from "@/lib/catalog-shared";
import { dataKey, useDataVersion } from "./DataVersion";
import { PageLoader } from "./PageLoader";
import { ProductGrid } from "./ProductGrid";

/** Fetched pages never go stale on their own: they are replaced only when the data version changes (see DataVersion). */
const SHELF_KEEP_MS = 60 * 60_000;

async function fetchPage(category: string, offset: number, signal?: AbortSignal): Promise<Product[]> {
  const sp = new URLSearchParams({ limit: String(SHELF_PAGE_SIZE), offset: String(offset) });
  if (category) sp.set("category", category);
  const res = await fetch(`/api/products?${sp}`, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || "Could not load more finds.");
  return body;
}

/**
 * Home-page browser. The server sends the first page and the category counts; the rest of each category arrives a page at a time as the
 * visitor scrolls (or taps "Show more"), and every page fetched is kept until an admin or seller changes something, so going back to a category costs nothing.
 */
export function HomeCraftExplorer({ initialItems, categories, emptyMessage = "No finds yet. Check back soon." }: { initialItems: Product[]; categories: { name: string; count: number }[]; emptyMessage?: string }) {
  const version = useDataVersion();
  const [category, setCategory] = useState("");
  const all = useMemo(() => categories.reduce((n, c) => n + c.count, 0), [categories]);
  const total = category ? (categories.find((c) => c.name === category)?.count ?? 0) : all;

  const query = useInfiniteQuery({
    queryKey: dataKey(version, "shelf", category),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => fetchPage(category, pageParam, signal),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.length, 0);
      return last.length > 0 && loaded < total ? loaded : undefined;
    },
    // The page the server already rendered seeds "All"; other categories load their first page when first opened.
    initialData: category === "" ? { pages: [initialItems], pageParams: [0] } : undefined,
    staleTime: Infinity,
    gcTime: SHELF_KEEP_MS,
  });
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage, refetch } = query;
  // Pages are cut by position, so a product added meanwhile can shift one onto the next page: show each only once.
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages ?? []).flat().filter((p) => !seen.has(p.id) && seen.add(p.id));
  }, [query.data]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage || isError || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage(); }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isError, isFetchingNextPage, fetchNextPage, items.length]);

  const openingCategory = query.isFetching && !isFetchingNextPage && items.length === 0;

  return (
    <div className="craft-explorer">
      {categories.length > 0 && (
        <div className="craft-tabs" role="group" aria-label="Browse by category">
          <button type="button" className={category ? "" : "active"} aria-pressed={!category} onClick={() => setCategory("")}>
            All <small>{all}</small>
          </button>
          {categories.map((c) => (
            <button
              type="button"
              key={c.name}
              className={category === c.name ? "active" : ""}
              aria-pressed={category === c.name}
              onClick={() => setCategory((cur) => (cur === c.name ? "" : c.name))}
            >
              {c.name} <small>{c.count}</small>
            </button>
          ))}
        </div>
      )}

      <div className="craft-results" aria-live="polite">
        <div className="craft-results-heading">{category && <h3>{category}</h3>}</div>
        <ProductGrid products={items} emptyMessage={isError ? "Could not load these finds. Please try again." : openingCategory ? "Loading finds…" : emptyMessage} />
        {(hasNextPage || isError) && (
          <div ref={sentinel} className="craft-more">
            {isError && items.length > 0 && <p role="alert">Could not load more. Please try again.</p>}
            <button type="button" className="button outline" disabled={isFetchingNextPage} aria-busy={isFetchingNextPage} onClick={() => void (items.length ? fetchNextPage() : refetch())}>
              {isError ? "Try again" : "Show more"}
            </button>
          </div>
        )}
        <PageLoader show={openingCategory} blocking={false} label="Loading finds" />
      </div>
    </div>
  );
}
