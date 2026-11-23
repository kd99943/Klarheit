import { useParams, useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowLeft,
  Box,
  Check,
  Eye,
  Info,
  Plus,
  RotateCcw,
  Ruler,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { fetchProductById, type Product } from "../services/api";
import { getFrameConfigForProduct } from "../ar/frameCatalog";
import { Button } from "../components/ui/Button";
import { SectionCard } from "../components/ui/SectionCard";
import { cn, formatPrice } from "../lib/utils";
import { useCart, cartItemFromProduct } from "../hooks/useCart";
import { track } from "../services/analytics";
import {
  getDefaultFinishId,
  getDistinctSizeSpecsForProduct,
  getProductPhotoGallery,
  isProductLowStock,
  isProductOrderable,
  isSkuLowStock,
  isSkuOrderable,
  persistProductSelection,
  readCatalogNavState,
  readSavedFinishForProduct,
  resolveFinishForProduct,
  resolveSkuForSelection,
} from "../lib/selection";

const LazyFrameShowcase = lazy(() =>
  import("../ar/FrameShowcase").then((mod) => ({ default: mod.FrameShowcase }))
);

type ProductDetailsLocationState = {
  productId?: number;
  finishId?: string;
  sizeSpec?: string;
  skuId?: number;
  catalogReturnUrl?: string;
};

type CartFeedbackState =
  | { type: "added"; itemId: string; productName: string; finishLabel: string | null }
  | { type: "undone" }
  | null;

export function ProductDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeState = (location.state as ProductDetailsLocationState | null) ?? null;

  const { t, i18n } = useTranslation("collections");
  const { t: tAr } = useTranslation("ar-studio");
  const { t: tCommon } = useTranslation("common");
  const { addItem, removeItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedFinishId, setSelectedFinishId] = useState<string | undefined>(undefined);
  const [selectedSizeSpec, setSelectedSizeSpec] = useState<string | undefined>(undefined);
  const [finishUnavailableNotice, setFinishUnavailableNotice] = useState(false);
  const [mediaMode, setMediaMode] = useState<"photo" | "3d">("photo");
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [cartFeedback, setCartFeedback] = useState<CartFeedbackState>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const touchStartXRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const catalogReturnUrl = useMemo(() => {
    return routeState?.catalogReturnUrl || readCatalogNavState()?.returnUrl || "/collections";
  }, [routeState?.catalogReturnUrl]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadProduct() {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      setActivePhotoIndex(0);
      setMediaMode("photo");
      setCartFeedback(null);
      try {
        const data = await fetchProductById(Number(id));
        if (!active) return;
        setProduct(data);

        const finishFromUrl = searchParams.get("finish");
        const finishFromState =
          routeState?.finishId &&
          (routeState.productId === undefined || Number(routeState.productId) === data.id)
            ? routeState.finishId
            : undefined;
        const finishFromStorage = readSavedFinishForProduct(data.id);
        const requestedFinish = finishFromUrl || finishFromState || finishFromStorage;

        const resolved = resolveFinishForProduct(data, requestedFinish);
        setSelectedFinishId(resolved.finishId);
        setFinishUnavailableNotice(resolved.wasInvalid);

        const sizeFromUrl = searchParams.get("size");
        const sizeFromState =
          routeState?.sizeSpec &&
          (routeState.productId === undefined || Number(routeState.productId) === data.id)
            ? routeState.sizeSpec
            : undefined;
        const distinctSizes = getDistinctSizeSpecsForProduct(data, resolved.finishId);
        const requestedSize = sizeFromUrl || sizeFromState;
        const initialSize =
          (requestedSize && distinctSizes.find((s) => s.toLowerCase() === requestedSize.trim().toLowerCase())) ||
          distinctSizes[0] ||
          data.specsSize ||
          undefined;
        setSelectedSizeSpec(initialSize);

        const initialSku = resolveSkuForSelection(data, {
          skuId: routeState?.skuId,
          finishId: resolved.finishId,
          sizeSpec: initialSize,
        });

        if (!resolved.wasInvalid && resolved.finishId) {
          persistProductSelection(data.id, resolved.finishId, initialSize, initialSku?.id ?? null);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load product details.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadProduct();
    if (id) {
      track("product_details_viewed", { product_id: id });
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isZh = i18n.language === "zh";

  const finishes = useMemo(() => product?.arConfigs ?? [], [product]);
  const defaultFinishId = useMemo(
    () => (product ? getDefaultFinishId(product) : undefined),
    [product]
  );

  const activeFinish = useMemo(() => {
    if (finishes.length === 0) return null;
    return finishes.find((f) => f.id === selectedFinishId) ?? finishes[0];
  }, [finishes, selectedFinishId]);

  const activeFinishLabel = useMemo(() => {
    if (!activeFinish) return null;
    return tAr("color." + activeFinish.id, {
      defaultValue: tAr(activeFinish.finishLabelKey, { defaultValue: activeFinish.id }),
    });
  }, [activeFinish, tAr]);

  const photoGallery = useMemo(() => (product ? getProductPhotoGallery(product) : []), [product]);

  const active3DFrame = useMemo(() => {
    if (!product) return null;
    return getFrameConfigForProduct(product, selectedFinishId ?? null);
  }, [product, selectedFinishId]);

  if (isLoading) {
    return (
      <div className="w-full text-center py-32 text-sm uppercase tracking-[0.2em] text-slate-400">
        {t("product.loadingDetails")}
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-xl mx-auto py-20 px-5 text-center">
        <SectionCard className="border-red-200 bg-red-50/70" title={t("product.error")}>
          <p className="text-sm text-red-700 mb-6">{error || t("product.error")}</p>
          <Link to={catalogReturnUrl}>
            <Button variant="outline-light">{t("product.backToCatalog")}</Button>
          </Link>
        </SectionCard>
      </div>
    );
  }

  const name = isZh ? product.nameZh : product.nameEn;
  const materialLabel = isZh ? product.materialZh : product.materialEn;

  const shapeLabelMap: Record<string, string> = {
    ROUND: t("product.shapeRound"),
    SQUARE: t("product.shapeSquare"),
    RECTANGLE: t("product.shapeRectangle"),
    AVIATOR: t("product.shapeAviator"),
    CAT_EYE: t("product.shapeCatEye"),
    GEOMETRIC: t("product.shapeGeometric"),
  };

  const shapeText = shapeLabelMap[product.shape.toUpperCase()] || product.shape;
  const salesStatus = product.salesStatus ?? "AVAILABLE";
  const skus = product.skus ?? [];
  const availableSizesForFinish = getDistinctSizeSpecsForProduct(product, selectedFinishId);
  const effectiveSizeSpec =
    (selectedSizeSpec &&
      availableSizesForFinish.find((s) => s.toLowerCase() === selectedSizeSpec.toLowerCase())) ||
    availableSizesForFinish[0] ||
    product.specsSize ||
    undefined;
  const activeFinishSku =
    resolveSkuForSelection(product, {
      finishId: selectedFinishId,
      sizeSpec: effectiveSizeSpec,
    }) ?? null;
  const isSelectedFinishSoldOut = activeFinishSku !== null && !isSkuOrderable(activeFinishSku);
  const isOrderable = isProductOrderable(product);
  const isDefaultPhotoFinish = !selectedFinishId || selectedFinishId === defaultFinishId;
  const canProceedWithSelection = isOrderable && !finishUnavailableNotice && !isSelectedFinishSoldOut;

  const isFinishOrderable = (finishId: string) => {
    if (!isOrderable) return false;
    const finishSkus = skus.filter((sku) => sku.finishId.toLowerCase() === finishId.toLowerCase());
    if (finishSkus.length === 0) return true;
    return finishSkus.some((sku) => isSkuOrderable(sku));
  };

  const hasOtherOrderableFinish =
    isOrderable &&
    finishes.some((finish) => finish.id !== activeFinish?.id && isFinishOrderable(finish.id));

  const hasOtherOrderableSizeInFinish =
    isOrderable &&
    availableSizesForFinish.some((size) => {
      if (effectiveSizeSpec && size.toLowerCase() === effectiveSizeSpec.toLowerCase()) return false;
      const skuForSize = resolveSkuForSelection(product, {
        finishId: selectedFinishId ?? defaultFinishId,
        sizeSpec: size,
      });
      return skuForSize !== undefined && isSkuOrderable(skuForSize);
    });

  const allFinishesSoldOut =
    !isOrderable ||
    (finishes.length > 0 && finishes.every((finish) => !isFinishOrderable(finish.id)));

  const selectionSummaryText = [name, activeFinishLabel, availableSizesForFinish.length > 1 ? effectiveSizeSpec : null]
    .filter(Boolean)
    .join(" · ");

  function scheduleFeedbackClear(ms: number) {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setCartFeedback(null);
      feedbackTimerRef.current = null;
    }, ms);
  }

  function handleSelectFinish(finishId: string) {
    if (!product) return;
    setSelectedFinishId(finishId);
    setFinishUnavailableNotice(false);
    const sizesForNext = getDistinctSizeSpecsForProduct(product, finishId);
    const nextSize =
      (selectedSizeSpec && sizesForNext.find((s) => s.toLowerCase() === selectedSizeSpec.toLowerCase())) ||
      sizesForNext[0] ||
      product.specsSize ||
      undefined;
    setSelectedSizeSpec(nextSize);
    const matchedSku = resolveSkuForSelection(product, { finishId, sizeSpec: nextSize });
    persistProductSelection(product.id, finishId, nextSize, matchedSku?.id ?? null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("finish", finishId);
    if (nextSize && sizesForNext.length > 1) {
      nextParams.set("size", nextSize);
    }
    setSearchParams(nextParams, { replace: true });
  }

  function handleSelectSize(sizeSpec: string) {
    if (!product) return;
    setSelectedSizeSpec(sizeSpec);
    const effectiveFinish = selectedFinishId ?? defaultFinishId;
    const matchedSku = resolveSkuForSelection(product, { finishId: effectiveFinish, sizeSpec });
    persistProductSelection(product.id, effectiveFinish, sizeSpec, matchedSku?.id ?? null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("size", sizeSpec);
    setSearchParams(nextParams, { replace: true });
  }

  function handleARTryOn() {
    if (!product) return;
    const effectiveFinish = selectedFinishId ?? defaultFinishId;
    persistProductSelection(product.id, effectiveFinish, effectiveSizeSpec, activeFinishSku?.id ?? null);
    navigate("/virtual-studio", {
      state: {
        productId: product.id,
        finishId: effectiveFinish,
        sizeSpec: effectiveSizeSpec,
        skuId: activeFinishSku?.id,
        fromProductDetails: true,
        catalogReturnUrl,
      },
    });
  }

  function handleConfigure() {
    if (!product || !canProceedWithSelection) return;
    const effectiveFinish = selectedFinishId ?? defaultFinishId;
    persistProductSelection(product.id, effectiveFinish, effectiveSizeSpec, activeFinishSku?.id ?? null);
    navigate("/config-lab", {
      state: {
        productId: product.id,
        finishId: effectiveFinish,
        sizeSpec: effectiveSizeSpec,
        skuId: activeFinishSku?.id,
      },
    });
  }

  function handleAddToCart() {
    if (!product || !canProceedWithSelection) return;
    const effectiveFinish = selectedFinishId ?? defaultFinishId;
    persistProductSelection(product.id, effectiveFinish, effectiveSizeSpec, activeFinishSku?.id ?? null);
    const added = addItem(
      cartItemFromProduct(product, {
        finishId: effectiveFinish,
        sizeSpec: effectiveSizeSpec,
        skuId: activeFinishSku?.id,
      })
    );
    setCartFeedback({
      type: "added",
      itemId: added.id,
      productName: name,
      finishLabel: activeFinishLabel,
    });
    scheduleFeedbackClear(10000);
  }

  function handleUndoAddToCart(itemId: string) {
    removeItem(itemId);
    setCartFeedback({ type: "undone" });
    scheduleFeedbackClear(3500);
  }

  function getPhotoAngleLabel(index: number): string {
    if (index === 0) return t("product.angleFront");
    if (index === 1) return t("product.angleSide");
    return t("product.angleDetail", { index: index + 1 });
  }

  const effectiveExactStock = activeFinishSku
    ? activeFinishSku.availableQty
    : product.stockQuantity;
  const effectiveSalesStatus = activeFinishSku ? activeFinishSku.salesStatus : salesStatus;
  const effectiveLowStock = activeFinishSku
    ? isSkuLowStock(activeFinishSku)
    : isProductLowStock(product);
  const availabilityBadge = !isOrderable
    ? salesStatus === "PAUSED"
      ? { text: t("product.paused"), style: "bg-amber-50 text-amber-700 border-amber-200" }
      : salesStatus === "ARCHIVED"
        ? { text: t("product.archived"), style: "bg-slate-100 text-slate-500 border-slate-200" }
        : { text: t("product.outOfStock"), style: "bg-red-50 text-red-700 border-red-200" }
    : isSelectedFinishSoldOut
      ? effectiveSalesStatus === "PAUSED"
        ? { text: t("product.paused"), style: "bg-amber-50 text-amber-700 border-amber-200" }
        : effectiveSalesStatus === "ARCHIVED"
          ? { text: t("product.archived"), style: "bg-slate-100 text-slate-500 border-slate-200" }
          : { text: t("product.outOfStock"), style: "bg-red-50 text-red-700 border-red-200" }
      : effectiveLowStock
        ? {
            text:
              typeof effectiveExactStock === "number"
                ? t("product.lowStock", { count: effectiveExactStock })
                : t("product.lowStockPublic"),
            style: "bg-amber-50 text-amber-700 border-amber-200",
          }
        : { text: t("product.available"), style: "bg-emerald-50 text-emerald-700 border-emerald-200" };

  return (
    <div className="w-full bg-surface-offwhite px-5 py-8 pb-28 sm:px-8 lg:px-12 lg:py-12 md:pb-12">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
        <Link
          to={catalogReturnUrl}
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 hover:text-brand-primary transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t("product.backToCatalogNav")}
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch mt-2">
          {/* Left Column: Visual Stage (Photos + 3D Finish Preview), Specs & Pre-login Optical Guide */}
          <div className="md:col-span-7 flex flex-col gap-6">
            <div className="bg-white border border-slate-200/60 rounded-[32px] p-5 sm:p-8 flex flex-col gap-4 shadow-sm">
              {/* Live Selection Header + Media Mode Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-brand-primary">
                    {activeFinish && (
                      <span
                        className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                        style={{ backgroundColor: activeFinish.frameColor }}
                      />
                    )}
                    <span>{selectionSummaryText}</span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                      availabilityBadge.style
                    )}
                  >
                    {availabilityBadge.text}
                  </span>
                </div>

                {active3DFrame && (
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-100/80 p-0.5">
                    <button
                      type="button"
                      aria-pressed={mediaMode === "photo"}
                      onClick={() => setMediaMode("photo")}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                        mediaMode === "photo"
                          ? "bg-white text-brand-primary shadow-xs"
                          : "text-slate-500 hover:text-brand-primary"
                      )}
                    >
                      {t("product.viewPhoto")}
                    </button>
                    <button
                      type="button"
                      aria-pressed={mediaMode === "3d"}
                      onClick={() => setMediaMode("3d")}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold transition-all inline-flex items-center gap-1",
                        mediaMode === "3d"
                          ? "bg-brand-primary text-white shadow-xs"
                          : "text-slate-500 hover:text-brand-primary"
                      )}
                    >
                      <Sparkles className="w-3 h-3" />
                      {t("product.view3D")}
                    </button>
                  </div>
                )}
              </div>

              {/* Stage Canvas: Photo Carousel or Real-Color 3D Preview */}
              {mediaMode === "3d" && active3DFrame ? (
                <div className="relative rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50 to-slate-100 aspect-[4/3] overflow-hidden">
                  <Suspense
                    fallback={
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                        {t("product.loading3D")}
                      </div>
                    }
                  >
                    <LazyFrameShowcase
                      frame={active3DFrame}
                      className="w-full h-full"
                    />
                  </Suspense>
                  <div className="absolute left-4 bottom-4 pointer-events-none">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 shadow-xs backdrop-blur-sm">
                      {t("product.preview3DBadge")}
                    </span>
                  </div>
                  <div className="absolute right-4 top-4 bg-white/85 border border-slate-200/70 backdrop-blur-sm rounded-2xl px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 select-none pointer-events-none">
                    <Box className="w-3.5 h-3.5" />
                    {shapeText}
                  </div>
                </div>
              ) : (
                <div
                  className="relative rounded-2xl border border-slate-100 bg-slate-50/40 aspect-[4/3] flex items-center justify-center p-6 sm:p-10 overflow-hidden"
                  onTouchStart={(e) => {
                    touchStartXRef.current = e.touches[0]?.clientX ?? null;
                  }}
                  onTouchEnd={(e) => {
                    if (touchStartXRef.current === null || photoGallery.length <= 1) return;
                    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
                    const delta = endX - touchStartXRef.current;
                    touchStartXRef.current = null;
                    if (Math.abs(delta) < 36) return;
                    setActivePhotoIndex((prev) =>
                      delta < 0
                        ? (prev + 1) % photoGallery.length
                        : (prev - 1 + photoGallery.length) % photoGallery.length
                    );
                  }}
                >
                  <img
                    src={photoGallery[activePhotoIndex] || product.imageUrl}
                    alt={selectionSummaryText}
                    className="w-11/12 h-full object-contain mix-blend-multiply relative z-10 drop-shadow-lg transition-all duration-300"
                    loading="lazy"
                  />

                  {!isDefaultPhotoFinish && (
                    <div className="absolute left-4 top-4 z-20">
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1 text-[11px] font-semibold text-amber-800 shadow-xs">
                        {t("product.schematicPhotoBadge")}
                      </span>
                    </div>
                  )}

                  <div className="absolute right-4 top-4 z-20 bg-white/85 border border-slate-200/70 backdrop-blur-sm rounded-2xl px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Box className="w-3.5 h-3.5" />
                    {shapeText}
                  </div>
                </div>
              )}

              {/* Honest Notice + 1-Tap 3D Switch When Selected Finish Has No Dedicated Real Photo */}
              {mediaMode === "photo" && !isDefaultPhotoFinish && activeFinishLabel && active3DFrame && (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 text-xs text-slate-700">
                    {activeFinish && (
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                        style={{ backgroundColor: activeFinish.frameColor }}
                      />
                    )}
                    <span>{t("product.noFinishPhotoNotice", { finish: activeFinishLabel })}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMediaMode("3d")}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-primary/90 transition-colors shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {t("product.viewFinish3D", { finish: activeFinishLabel })}
                  </button>
                </div>
              )}

              {/* Multi-angle Photo Controls (when multiple real photos exist) */}
              {mediaMode === "photo" && photoGallery.length > 1 && (
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {photoGallery.map((url, idx) => (
                    <button
                      key={url}
                      type="button"
                      aria-pressed={activePhotoIndex === idx}
                      onClick={() => setActivePhotoIndex(idx)}
                      className={cn(
                        "rounded-full border px-3.5 py-1 text-xs font-medium transition-all",
                        activePhotoIndex === idx
                          ? "border-brand-primary bg-brand-primary text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {getPhotoAngleLabel(idx)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200/60 rounded-[24px] p-6 shadow-sm">
              <h3 className="font-display font-medium text-brand-primary tracking-wide mb-4 text-sm uppercase">
                {t("product.specifications")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {t("product.frameMaterial")}
                  </span>
                  <span className="text-sm font-semibold text-brand-primary">{materialLabel}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {t("product.frameDimensions")}
                  </span>
                  <span className="text-sm font-semibold text-brand-primary flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5 text-slate-400" />
                    {product.specsSize}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {t("product.bestFaceFit")}
                  </span>
                  <span className="text-sm font-semibold text-brand-primary">
                    {product.shape === "ROUND" ? t("product.faceFitRound") : t("product.faceFitOther")}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">{t("product.sizeGuide")}</p>
            </div>

            {/* Pre-login Prescription & Pricing Preview */}
            <div className="bg-white border border-slate-200/60 rounded-[24px] p-6 shadow-sm flex flex-col gap-3">
              <h3 className="font-display font-medium text-brand-primary text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-brand-cyan shrink-0" />
                {t("product.preLoginGuideTitle")}
              </h3>
              <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <li>• {t("product.preLoginPrescription")}</li>
                <li>• {t("product.preLoginLensPreview")}</li>
                <li>• {t("product.preLoginShipping")}</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Information, Swatches & Actions */}
          <div className="md:col-span-5 flex flex-col justify-between gap-8 bg-white border border-slate-200/60 rounded-[32px] p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col gap-6">
              <div>
                <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate-400">
                  {t("product.premiumCollection")}
                </span>
                <h1 className="text-3xl sm:text-4xl font-display font-medium text-brand-primary tracking-tight mt-1">
                  {name}
                </h1>
                <p className="text-2xl font-semibold text-brand-primary mt-3">
                  {formatPrice(product.basePrice)}
                </p>
              </div>

              {finishes.length > 0 && (
                <div className="border-t border-slate-100 pt-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">
                      {t("product.finishSelect")}
                    </p>
                    {activeFinish && activeFinishLabel && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary">
                        <span
                          className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                          style={{ backgroundColor: activeFinish.frameColor }}
                        />
                        <span>{t("product.currentSelectionValue", { finish: activeFinishLabel })}</span>
                      </span>
                    )}
                  </div>

                  {finishUnavailableNotice && (
                    <div
                      role="alert"
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 flex items-start gap-2 text-xs text-amber-800"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <span>{t("product.finishUnavailableNotice")}</span>
                    </div>
                  )}

                  {isSelectedFinishSoldOut && activeFinishLabel && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 flex items-start gap-2 text-xs text-red-700"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                      <div className="flex flex-col gap-1.5">
                        <span>
                          {allFinishesSoldOut
                            ? activeFinishSku?.restockEta
                              ? t("product.allFinishesSoldOutWithEta", { eta: activeFinishSku.restockEta })
                              : t("product.allFinishesSoldOutNotice")
                            : hasOtherOrderableFinish
                              ? activeFinishSku?.restockEta
                                ? t("product.skuSoldOutWithEta", {
                                    finish: activeFinishLabel,
                                    eta: activeFinishSku.restockEta,
                                  })
                                : t("product.skuSoldOutNotice", { finish: activeFinishLabel })
                              : hasOtherOrderableSizeInFinish
                                ? activeFinishSku?.restockEta
                                  ? t("product.skuSizeSoldOutWithEta", {
                                      finish: activeFinishLabel,
                                      eta: activeFinishSku.restockEta,
                                    })
                                  : t("product.skuSizeSoldOutNotice", { finish: activeFinishLabel })
                                : t("product.allFinishesSoldOutNotice")}
                        </span>
                        {allFinishesSoldOut && (
                          <Link
                            to={catalogReturnUrl}
                            className="inline-block w-fit font-semibold underline underline-offset-4 hover:text-red-900"
                          >
                            {t("product.backToCatalog")}
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  {activeFinishSku && !isSelectedFinishSoldOut && isSkuLowStock(activeFinishSku) && (
                    <p className="text-[11px] font-medium text-amber-700">
                      {typeof activeFinishSku.availableQty === "number"
                        ? t("product.skuStockRemaining", { count: activeFinishSku.availableQty })
                        : t("product.skuLowStockPublic")}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {finishes.map((finish) => {
                      const active = !finishUnavailableNotice && (selectedFinishId ?? finishes[0].id) === finish.id;
                      const label = tAr("color." + finish.id, {
                        defaultValue: tAr(finish.finishLabelKey, { defaultValue: finish.id }),
                      });
                      const finishSkus = skus.filter((sku) => sku.finishId === finish.id);
                      const finishSoldOut =
                        finishSkus.length > 0 && finishSkus.every((sku) => !isSkuOrderable(sku));
                      return (
                        <button
                          key={finish.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => handleSelectFinish(finish.id)}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-all",
                            finishSoldOut
                              ? active
                                ? "border-red-300 bg-red-50/70 text-red-700 ring-2 ring-red-200"
                                : "border-slate-200 bg-slate-100/80 text-slate-400 hover:border-slate-300"
                              : active
                                ? "border-brand-primary bg-brand-primary/5 text-brand-primary ring-2 ring-brand-primary/25 shadow-xs"
                                : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                          )}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                            style={{ backgroundColor: finish.frameColor }}
                          />
                          <span className={finishSoldOut ? "line-through" : ""}>{label}</span>
                          {finishSoldOut && (
                            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                              {t("product.skuSoldOutTag")}
                            </span>
                          )}
                          {active && !finishSoldOut && <Check className="w-3.5 h-3.5 text-brand-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {availableSizesForFinish.length > 1 && (
                <div className="border-t border-slate-100 pt-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">
                      {t("product.sizeSelect")}
                    </p>
                    {effectiveSizeSpec && (
                      <span className="text-xs font-mono font-semibold text-brand-primary">
                        {t("product.sizeSpecValue", { size: effectiveSizeSpec })}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableSizesForFinish.map((size) => {
                      const sizeActive = effectiveSizeSpec?.toLowerCase() === size.toLowerCase();
                      const skuForSize = resolveSkuForSelection(product, {
                        finishId: selectedFinishId ?? defaultFinishId,
                        sizeSpec: size,
                      });
                      const sizeSoldOut = skuForSize !== undefined && !isSkuOrderable(skuForSize);
                      return (
                        <button
                          key={size}
                          type="button"
                          aria-pressed={sizeActive}
                          onClick={() => handleSelectSize(size)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-mono font-medium transition-all",
                            sizeSoldOut
                              ? sizeActive
                                ? "border-red-300 bg-red-50/70 text-red-700 ring-2 ring-red-200"
                                : "border-slate-200 bg-slate-100/80 text-slate-400"
                              : sizeActive
                                ? "border-brand-primary bg-brand-primary/5 text-brand-primary ring-2 ring-brand-primary/25 shadow-xs"
                                : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                          )}
                        >
                          <span className={sizeSoldOut ? "line-through" : ""}>{size}</span>
                          {sizeSoldOut && (
                            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-sans font-bold text-red-600">
                              {t("product.skuSoldOutTag")}
                            </span>
                          )}
                          {sizeActive && !sizeSoldOut && <Check className="w-3.5 h-3.5 text-brand-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-6 flex flex-col gap-4">
                <p className="text-sm text-slate-500 leading-relaxed font-light">
                  {t("product.description", { name })}
                </p>

                <div className="flex items-start gap-2 text-xs text-brand-primary font-medium bg-slate-50 rounded-xl p-3 border border-slate-100 mt-2">
                  <ShieldCheck className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
                  <span>{t("product.qualityGuarantee")}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {tCommon("support.preSalesHint")}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-6 border-t border-slate-100">
              {!isOrderable ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 space-y-3">
                  <p>{t("product.unavailableHint")}</p>
                  <Link to={catalogReturnUrl} className="inline-block underline font-semibold">
                    {t("product.backToCatalog")}
                  </Link>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!canProceedWithSelection}
                    onClick={handleConfigure}
                    className="w-full bg-brand-primary text-white border border-transparent rounded-2xl py-4 flex items-center justify-center gap-2 hover:bg-brand-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-semibold shadow-sm"
                  >
                    <Settings className="w-4 h-4" />
                    {t("product.configLab")}
                  </button>

                  <button
                    type="button"
                    disabled={!canProceedWithSelection}
                    onClick={handleAddToCart}
                    className="w-full bg-white text-slate-700 border border-slate-200 rounded-2xl py-3.5 flex items-center justify-center gap-2 hover:bg-slate-50 hover:text-brand-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    {t("product.addToCart")}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleARTryOn}
                className="w-full bg-slate-50 text-brand-primary border border-slate-200 rounded-2xl py-3.5 flex items-center justify-center gap-2 hover:bg-slate-100 transition-all text-sm font-semibold"
              >
                <Eye className="w-4 h-4" />
                {t("product.arTryOn")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Non-blocking In-Place Add-to-Cart Confirmation Bar with Undo */}
      {cartFeedback && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-4 right-4 bottom-24 md:bottom-6 md:left-auto md:right-6 md:max-w-md z-40 rounded-2xl border border-slate-800 bg-brand-primary text-white px-4 py-3.5 shadow-2xl flex items-center justify-between gap-3"
        >
          {cartFeedback.type === "added" ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">
                  {cartFeedback.finishLabel
                    ? t("product.addedToastWithFinish", {
                        name: cartFeedback.productName,
                        finish: cartFeedback.finishLabel,
                      })
                    : t("product.addedToast", { name: cartFeedback.productName })}
                </p>
                <span className="inline-block mt-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-brand-cyan">
                  {t("product.addedPendingLens")}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/cart"
                  className="rounded-xl bg-white text-brand-primary px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 transition-colors"
                >
                  {t("product.viewCart")}
                </Link>
                <button
                  type="button"
                  onClick={() => handleUndoAddToCart(cartFeedback.itemId)}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/25 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  {t("product.undoAdd")}
                </button>
                <button
                  type="button"
                  aria-label={t("product.dismissNotice")}
                  onClick={() => setCartFeedback(null)}
                  className="p-1 text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-white/90">{t("product.undoneToast")}</p>
              <button
                type="button"
                aria-label={t("product.dismissNotice")}
                onClick={() => setCartFeedback(null)}
                className="p-1 text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {activeFinish && (
                <span
                  className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                  style={{ backgroundColor: activeFinish.frameColor }}
                />
              )}
              <p className="text-xs font-semibold text-brand-primary truncate">{selectionSummaryText}</p>
            </div>
            <p className="text-xs font-mono text-slate-500 mt-0.5">{formatPrice(product.basePrice)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleARTryOn}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-brand-primary hover:bg-slate-100 transition-colors"
            >
              {t("product.mobileTryOn")}
            </button>
            <button
              type="button"
              disabled={!canProceedWithSelection}
              onClick={handleConfigure}
              className="rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
            >
              {t("product.mobileSelectLenses")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
