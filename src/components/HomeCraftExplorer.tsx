"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { ProductGrid } from "./ProductGrid";

/** Home-page browser: filters come from the categories of the published products, nothing is hard-coded. */
export function HomeCraftExplorer({ products }: { products: Product[] }) {
  const [category, setCategory] = useState("");
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  }, [products]);
  const visible = category ? products.filter((p) => p.category === category) : products;

  return (
    <div className="craft-explorer">
      {categories.length > 0 && (
        <div className="craft-tabs" role="group" aria-label="Browse by category">
          <button type="button" className={category ? "" : "active"} aria-pressed={!category} onClick={() => setCategory("")}>
            All <small>{products.length}</small>
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
        <div className="craft-results-heading">
          <h3>{category || "Handmade finds"}</h3>
          <span>
            {visible.length} {visible.length === 1 ? "piece" : "pieces"}
          </span>
        </div>
        <ProductGrid products={visible} emptyMessage="No handmade finds yet. Check back soon." />
      </div>
    </div>
  );
}
