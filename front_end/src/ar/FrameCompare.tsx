import { useMemo } from "react";
import type { Product } from "../services/api";
import { getFrameConfigForProduct } from "./frameCatalog";
import { FrameShowcase } from "./FrameShowcase";

interface FrameCompareProps {
  products: Product[];
  activeProductId: number | null;
  activeFinishId?: string | null;
  className?: string;
}

/**
 * Side-by-side turntable of the active frame and its neighbor.
 * Helps decide silhouettes without toggling the catalog.
 */
export function FrameCompare({
  products,
  activeProductId,
  activeFinishId,
  className,
}: FrameCompareProps) {
  const pair = useMemo(() => {
    if (products.length === 0) return [] as Product[];
    const idx = Math.max(
      0,
      products.findIndex((p) => p.id === activeProductId)
    );
    const current = products[idx];
    const next = products[(idx + 1) % products.length];
    return current && next && current.id !== next.id ? [current, next] : [current];
  }, [products, activeProductId]);

  if (pair.length === 0) return null;

  return (
    <div className={className ?? "grid grid-cols-2 gap-3"}>
      {pair.map((product, i) => {
        const frame = getFrameConfigForProduct(
          product,
          i === 0 ? activeFinishId : null
        );
        return (
          <div
            key={product.id}
            className="flex flex-col gap-1.5"
          >
            <span className="text-[9px] uppercase tracking-widest font-bold text-slate-400">
              {i === 0 ? "当前 · " : "对比 · "}
              {product.name}
            </span>
            <div className="h-32 rounded-xl bg-gradient-to-b from-slate-100 to-slate-200/80 border border-slate-100 overflow-hidden">
              <FrameShowcase frame={frame} className="h-full w-full" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
