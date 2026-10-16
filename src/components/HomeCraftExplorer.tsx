"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { ProductGrid } from "./ProductGrid";

const crafts = [
  {
    id: "crochet",
    label: "Crochet",
    icon: "🧶",
    terms: ["crochet", "textile", "yarn"],
  },
  { id: "leather", label: "Leather", icon: "👜", terms: ["leather"] },
  { id: "wood", label: "Wood", icon: "🪵", terms: ["wood", "wooden"] },
  { id: "resin", label: "Resin", icon: "🌼", terms: ["resin"] },
] as const;

const subfilters = [
  {
    label: "Home & décor",
    icon: "⌂",
    terms: ["home", "decor", "coaster", "dish", "trinket", "bouquet"],
  },
  {
    label: "Desk",
    icon: "❋",
    terms: ["home", "decor", "coaster", "dish", "trinket", "bouquet"],
  },
  { label: "Aesthetic decor", icon: "⌂", terms: ["cute", "decor"] },
  {
    label: "Accessories",
    icon: "✳",
    terms: ["accessor", "bag", "charm", "wear"],
  },
  {
    label: "Gifts & keepsakes",
    icon: "⌂",
    terms: ["gift", "keepsake", "bouquet", "charm"],
  },
];

const matches = (product: Product, terms: readonly string[]) => {
  const text =
    `${product.name} ${product.category} ${product.description}`.toLowerCase();
  return terms.some((term) => text.includes(term));
};

export function HomeCraftExplorer({ products }: { products: Product[] }) {
  const [craft, setCraft] = useState<string>("all");
  const [subfilter, setSubfilter] = useState<string>("");
  const selectedCraft = crafts.find((item) => item.id === craft);
  const craftProducts = useMemo(
    () =>
      selectedCraft
        ? products.filter((product) => matches(product, selectedCraft.terms))
        : products,
    [products, selectedCraft],
  );
  const visibleProducts = useMemo(() => {
    const selectedSubfilter = subfilters.find(
      (item) => item.label === subfilter,
    );
    return selectedSubfilter
      ? craftProducts.filter((product) =>
          matches(product, selectedSubfilter.terms),
        )
      : craftProducts;
  }, [craftProducts, subfilter]);

  return (
    <div className="craft-explorer">
      

      <div
        className="craft-subfilters"
        role="group"
        aria-label="Explore product collections"
      >
        {subfilters.map((item) => {
          const count = craftProducts.filter((product) =>
            matches(product, item.terms),
          ).length;
          return (
            <button
              type="button"
              className={`craft-collection${subfilter === item.label ? " selected" : ""}`}
              key={item.label}
              aria-pressed={subfilter === item.label}
              onClick={() =>
                setSubfilter((current) =>
                  current === item.label ? "" : item.label,
                )
              }
            >
              <span className="craft-collection-art" aria-hidden="true">
                {item.icon}
              </span>
              <span className="craft-collection-name">{item.label}</span>
              <span className="craft-collection-count">
                {count} {count === 1 ? "find" : "finds"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="craft-results" aria-live="polite">
        <div className="craft-results-heading">
          <h3>
            {subfilter ||
              (selectedCraft
                ? `${selectedCraft.label} finds`
                : "Handmade finds")}
          </h3>
          <span>
            {visibleProducts.length}{" "}
            {visibleProducts.length === 1 ? "piece" : "pieces"}
          </span>
        </div>
        <ProductGrid products={visibleProducts} />
      </div>
    </div>
  );
}
