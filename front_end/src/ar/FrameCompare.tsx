import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Columns2, Layers, Plus, SlidersHorizontal } from "lucide-react";
import type { Product } from "../services/api";
import type { ARFinishId } from "./types";
import { getFrameConfigForProduct } from "./frameCatalog";
import { FrameShowcase } from "./FrameShowcase";
import { cn, formatPrice } from "../lib/utils";
import { getDefaultFinishId, isProductOrderable, isSkuOrderable, resolveSkuForSelection } from "../lib/selection";
import { Button } from "../components/ui/Button";

export interface CompareSlotSelection {
  productId: number;
  finishId: string | null;
}

interface FrameCompareProps {
  products: Product[];
  slotA: CompareSlotSelection;
  slotB: CompareSlotSelection;
  activeSlot: "A" | "B";
  previewMedia: "3d" | "photo";
  onActiveSlotChange: (slot: "A" | "B") => void;
  onSlotAChange: (next: CompareSlotSelection) => void;
  onSlotBChange: (next: CompareSlotSelection) => void;
  onConfigureActive: () => void;
  onAddToCartActive?: () => void;
  className?: string;
}

/**
 * User-driven A/B frame comparator.
 * Mobile prioritizes instant single-canvas A/B toggle (zero dual-WebGL overhead);
 * Desktop adds an optional side-by-side comparison mode with real specs & frame prices.
 */
export function FrameCompare({
  products,
  slotA,
  slotB,
  activeSlot,
  previewMedia,
  onActiveSlotChange,
  onSlotAChange,
  onSlotBChange,
  onConfigureActive,
  onAddToCartActive,
  className,
}: FrameCompareProps) {
  const { t, i18n } = useTranslation("ar-studio");
  const isZh = i18n.language === "zh";
  const [desktopSideBySide, setDesktopSideBySide] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window === "undefined" || typeof window.matchMedia !== "function"
      ? true
      : window.matchMedia("(min-width: 768px)").matches
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => setIsDesktopViewport(event.matches);
    setIsDesktopViewport(mql.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const productA = useMemo(
    () => products.find((p) => p.id === slotA.productId) ?? products[0] ?? null,
    [products, slotA.productId]
  );
  const productB = useMemo(
    () => products.find((p) => p.id === slotB.productId) ?? products[1] ?? products[0] ?? null,
    [products, slotB.productId]
  );

  const frameA = useMemo(
    () => (productA ? getFrameConfigForProduct(productA, (slotA.finishId as ARFinishId | null) ?? null) : null),
    [productA, slotA.finishId]
  );
  const frameB = useMemo(
    () => (productB ? getFrameConfigForProduct(productB, (slotB.finishId as ARFinishId | null) ?? null) : null),
    [productB, slotB.finishId]
  );

  if (!productA || !productB || !frameA || !frameB) return null;

  const resolveFinishLabel = (prod: Product, finishId: string | null) => {
    const finishes = prod.arConfigs ?? [];
    const effective = finishes.find((f) => f.id === finishId) ?? finishes[0] ?? null;
    if (!effective) return "";
    return t("color." + effective.id, {
      defaultValue: t(effective.finishLabelKey, { defaultValue: effective.id }),
    });
  };

  const nameA = isZh ? productA.nameZh : productA.nameEn;
  const nameB = isZh ? productB.nameZh : productB.nameEn;
  const finishLabelA = resolveFinishLabel(productA, slotA.finishId);
  const finishLabelB = resolveFinishLabel(productB, slotB.finishId);
  const showSideBySide = desktopSideBySide && isDesktopViewport;

  const activeProd = activeSlot === "A" ? productA : productB;
  const activeFinishId = activeSlot === "A" ? slotA.finishId : slotB.finishId;
  const activeFrame = activeSlot === "A" ? frameA : frameB;
  const activeName = activeSlot === "A" ? nameA : nameB;
  const activeFinishLbl = activeSlot === "A" ? finishLabelA : finishLabelB;
  const activeSku = resolveSkuForSelection(activeProd, { finishId: activeFinishId });
  const isActiveOrderable = isProductOrderable(activeProd) && isSkuOrderable(activeSku);

  const renderSlotPicker = (
    slotKey: "A" | "B",
    prod: Product,
    finishId: string | null,
    onChange: (next: CompareSlotSelection) => void
  ) => {
    const finishes = prod.arConfigs ?? [];
    return (
      <div
        className={cn(
          "rounded-2xl border p-3.5 flex flex-col gap-2.5 transition-colors",
          activeSlot === slotKey
            ? "border-brand-primary bg-brand-primary/5"
            : "border-slate-200 bg-white"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
            {slotKey === "A" ? t("compare.pickA") : t("compare.pickB")}
          </span>
          <button
            type="button"
            aria-pressed={activeSlot === slotKey}
            onClick={() => onActiveSlotChange(slotKey)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
              activeSlot === slotKey
                ? "bg-brand-primary text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {slotKey === "A" ? t("compare.viewA") : t("compare.viewB")}
          </button>
        </div>

        <select
          aria-label={slotKey === "A" ? t("compare.pickA") : t("compare.pickB")}
          value={prod.id}
          onChange={(e) => {
            const nextProd = products.find((p) => p.id === Number(e.target.value));
            if (!nextProd) return;
            onChange({
              productId: nextProd.id,
              finishId: getDefaultFinishId(nextProd) ?? null,
            });
          }}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-primary focus:border-brand-primary focus:outline-none"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {isZh ? p.nameZh : p.nameEn} · {formatPrice(p.basePrice)}
            </option>
          ))}
        </select>

        {finishes.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {finishes.map((f) => {
              const effectiveId = finishId ?? getDefaultFinishId(prod) ?? finishes[0].id;
              const isSelectedFinish = effectiveId === f.id;
              const lbl = t("color." + f.id, {
                defaultValue: t(f.finishLabelKey, { defaultValue: f.id }),
              });
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={isSelectedFinish}
                  onClick={() => {
                    onChange({ productId: prod.id, finishId: f.id });
                    onActiveSlotChange(slotKey);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                    isSelectedFinish
                      ? "border-brand-primary bg-white text-brand-primary"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                    style={{ backgroundColor: f.frameColor }}
                  />
                  <span>{lbl}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
          <span>
            {t("compare.sizeSpec")}: <span className="font-mono text-brand-primary">{prod.specsSize || "—"}</span>
          </span>
          <span className="font-mono font-semibold text-brand-primary">{formatPrice(prod.basePrice)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col gap-4", className)} data-testid="frame-compare">
      {/* Top Bar: Fast A/B Toggle + Desktop Side-by-Side Switch */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-0.5">
          <button
            type="button"
            aria-pressed={activeSlot === "A"}
            onClick={() => onActiveSlotChange("A")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
              activeSlot === "A" ? "bg-brand-primary text-white shadow-xs" : "text-slate-600 hover:text-brand-primary"
            )}
          >
            {t("compare.viewA")} · {nameA}
          </button>
          <button
            type="button"
            aria-pressed={activeSlot === "B"}
            onClick={() => onActiveSlotChange("B")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
              activeSlot === "B" ? "bg-brand-primary text-white shadow-xs" : "text-slate-600 hover:text-brand-primary"
            )}
          >
            {t("compare.viewB")} · {nameB}
          </button>
        </div>

        {/* Desktop-only Side-by-Side vs Quick Toggle */}
        <div className="hidden md:inline-flex rounded-full border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            aria-pressed={!desktopSideBySide}
            onClick={() => setDesktopSideBySide(false)}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors",
              !desktopSideBySide ? "bg-slate-900 text-white" : "text-slate-500"
            )}
          >
            <Layers className="w-3 h-3" />
            {t("compare.layoutSwitch")}
          </button>
          <button
            type="button"
            aria-pressed={desktopSideBySide}
            onClick={() => setDesktopSideBySide(true)}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors",
              desktopSideBySide ? "bg-slate-900 text-white" : "text-slate-500"
            )}
          >
            <Columns2 className="w-3 h-3" />
            {t("compare.layoutSideBySide")}
          </button>
        </div>
      </div>

      {/* Preview Stage — mount ONLY the active layout so hidden WebGL canvases are never created */}
      {showSideBySide ? (
        <div className="grid grid-cols-2 gap-4">
          {[
            { slot: "A" as const, prod: productA, frame: frameA, name: nameA, finishLbl: finishLabelA },
            { slot: "B" as const, prod: productB, frame: frameB, name: nameB, finishLbl: finishLabelB },
          ].map((entry) => (
            <div
              key={entry.slot}
              onClick={() => onActiveSlotChange(entry.slot)}
              className={cn(
                "rounded-2xl border p-3 flex flex-col gap-2 cursor-pointer transition-all bg-white",
                activeSlot === entry.slot ? "border-brand-primary ring-2 ring-brand-primary/20" : "border-slate-200"
              )}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-brand-primary">
                <span>
                  {entry.slot === "A" ? t("compare.slotA") : t("compare.slotB")} · {entry.name}
                  {entry.finishLbl ? ` · ${entry.finishLbl}` : ""}
                </span>
                <span className="font-mono">{formatPrice(entry.prod.basePrice)}</span>
              </div>
              <div className="h-52 rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50 to-slate-100 overflow-hidden flex items-center justify-center">
                {previewMedia === "3d" ? (
                  <FrameShowcase
                    key={entry.slot}
                    frame={entry.frame}
                    className="w-full h-full"
                  />
                ) : (
                  <img
                    src={entry.prod.imageUrl}
                    alt={entry.name}
                    className="w-4/5 h-4/5 object-contain mix-blend-multiply"
                    loading="lazy"
                  />
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-mono text-center">
                {t("compare.sizeSpec")}: {entry.prod.specsSize || "—"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 aspect-[4/3] max-h-72 w-full overflow-hidden flex items-center justify-center relative">
          {previewMedia === "3d" ? (
            <FrameShowcase
              frame={activeFrame}
              className="w-full h-full"
            />
          ) : (
            <img
              src={activeProd.imageUrl}
              alt={activeName}
              className="w-4/5 h-4/5 object-contain mix-blend-multiply"
              loading="lazy"
            />
          )}
          <div className="absolute left-3 top-3 rounded-full bg-brand-primary/90 text-white px-3 py-1 text-[11px] font-semibold select-none pointer-events-none">
            {activeSlot === "A" ? t("compare.slotA") : t("compare.slotB")} · {activeName}
            {activeFinishLbl ? ` · ${activeFinishLbl}` : ""}
          </div>
        </div>
      )}

      {/* Slot A & B Selectors + Real Specs & Frame Prices */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {renderSlotPicker("A", productA, slotA.finishId, onSlotAChange)}
        {renderSlotPicker("B", productB, slotB.finishId, onSlotBChange)}
      </div>

      {!isActiveOrderable && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800">
          {t("unavailableOrderHint")}
        </p>
      )}

      <div className={cn("grid gap-2.5", onAddToCartActive ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
        <Button
          type="button"
          variant="primary"
          disabled={!isActiveOrderable}
          onClick={onConfigureActive}
          className="w-full rounded-xl py-3.5 text-xs"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {t("compare.useActive")} ({activeName})
        </Button>
        {onAddToCartActive && (
          <Button
            type="button"
            variant="secondary"
            disabled={!isActiveOrderable}
            onClick={onAddToCartActive}
            className="w-full rounded-xl py-3.5 text-xs"
          >
            <Plus className="w-4 h-4" />
            {t("compare.addActiveToCart")} ({activeName})
          </Button>
        )}
      </div>
    </div>
  );
}
