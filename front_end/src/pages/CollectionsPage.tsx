import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { fetchProductsFiltered, type Product, type ProductFilterParams } from "../services/api";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { cn, formatPrice } from "../lib/utils";
import { track } from "../services/analytics";
import {
  clearCatalogNavState,
  isProductLowStock,
  isProductOrderable,
  readCatalogNavState,
  saveCatalogNavState,
} from "../lib/selection";

interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function CollectionsPage() {
  const { t, i18n } = useTranslation("collections");
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Hydrate initial filter state from URL query params so Back navigation restores seamlessly
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [material, setMaterial] = useState(() => searchParams.get("material") ?? "");
  const [shape, setShape] = useState(() => searchParams.get("shape") ?? "");
  const [minPrice, setMinPrice] = useState<number | undefined>(() => {
    const raw = searchParams.get("minPrice");
    return raw && Number.isFinite(Number(raw)) ? Number(raw) : undefined;
  });
  const [maxPrice, setMaxPrice] = useState<number | undefined>(() => {
    const raw = searchParams.get("maxPrice");
    return raw && Number.isFinite(Number(raw)) ? Number(raw) : undefined;
  });
  const [sortBy, setSortBy] = useState(() => searchParams.get("sort") ?? "default");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Catalog State
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightedProductId, setHighlightedProductId] = useState<number | null>(null);
  const restoredScrollRef = useRef(false);

  // Keep URL search params synchronized with active filters (replace so Back stays clean)
  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim()) next.set("q", search.trim());
    if (shape) next.set("shape", shape);
    if (material) next.set("material", material);
    if (minPrice !== undefined && !Number.isNaN(minPrice)) next.set("minPrice", String(minPrice));
    if (maxPrice !== undefined && !Number.isNaN(maxPrice)) next.set("maxPrice", String(maxPrice));
    if (sortBy && sortBy !== "default") next.set("sort", sortBy);

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [search, shape, material, minPrice, maxPrice, sortBy, searchParams, setSearchParams]);

  const isPriceRangeInvalid =
    minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice;

  const loadFilteredCatalog = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: ProductFilterParams = {
        search: search.trim() || undefined,
        material: material || undefined,
        shape: shape || undefined,
        minPrice,
        maxPrice,
        sortBy: sortBy !== "default" ? sortBy : undefined,
      };
      const data = await fetchProductsFiltered(params);
      setProducts(data);
      if (search.trim()) {
        track("product_search_used", { query_length: search.trim().length, result_count: data.length });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load filtered catalog.");
    } finally {
      setIsLoading(false);
    }
  }, [search, material, shape, minPrice, maxPrice, sortBy]);

  useEffect(() => {
    if (isPriceRangeInvalid) {
      setIsLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      void loadFilteredCatalog();
    }, 220);
    return () => clearTimeout(timer);
  }, [loadFilteredCatalog, isPriceRangeInvalid]);

  const isZh = i18n.language === "zh";

  useEffect(() => {
    track("collections_viewed", {});
  }, []);

  // Restore scroll & highlight original card when returning from ProductDetailsPage
  useEffect(() => {
    if (isLoading || products.length === 0 || restoredScrollRef.current) return;
    const saved = readCatalogNavState();
    if (!saved) return;
    restoredScrollRef.current = true;
    clearCatalogNavState();

    const targetCard = document.querySelector(`[data-product-id="${saved.productId}"]`);
    if (targetCard && typeof targetCard.scrollIntoView === "function") {
      targetCard.scrollIntoView({ block: "center", behavior: "auto" });
      setHighlightedProductId(saved.productId);
      const timer = window.setTimeout(() => setHighlightedProductId(null), 1600);
      return () => window.clearTimeout(timer);
    }
    if (typeof saved.scrollY === "number" && saved.scrollY > 0) {
      window.scrollTo(0, saved.scrollY);
    }
  }, [isLoading, products]);

  const shapeLabelMap = useMemo<Record<string, string>>(
    () => ({
      ROUND: t("collections.shapeRound"),
      SQUARE: t("collections.shapeSquare"),
      RECTANGLE: t("collections.shapeRectangle"),
      AVIATOR: t("collections.shapeAviator"),
      CAT_EYE: t("collections.shapeCatEye"),
      GEOMETRIC: t("collections.shapeGeometric"),
    }),
    [t]
  );

  const materialLabelMap = useMemo<Record<string, string>>(
    () => ({
      "Grade 5 Titanium": t("collections.materialTitanium"),
      "Japanese Acetate": t("collections.materialAcetate"),
      "Surgical Steel / Titanium": t("collections.materialSurgicalSteel"),
      "Crystal Acetate": t("collections.materialCrystal"),
    }),
    [t]
  );

  const sortLabelMap = useMemo<Record<string, string>>(
    () => ({
      price_asc: t("collections.sortPriceAsc"),
      price_desc: t("collections.sortPriceDesc"),
    }),
    [t]
  );

  const activeFilters = useMemo<ActiveFilterChip[]>(() => {
    const list: ActiveFilterChip[] = [];
    if (search.trim()) {
      list.push({
        key: "search",
        label: t("collections.chipSearch", { value: search.trim() }),
        onRemove: () => setSearch(""),
      });
    }
    if (shape) {
      list.push({
        key: "shape",
        label: t("collections.chipShape", { value: shapeLabelMap[shape] ?? shape }),
        onRemove: () => setShape(""),
      });
    }
    if (material) {
      list.push({
        key: "material",
        label: t("collections.chipMaterial", { value: materialLabelMap[material] ?? material }),
        onRemove: () => setMaterial(""),
      });
    }
    if (minPrice !== undefined) {
      list.push({
        key: "minPrice",
        label: t("collections.chipMinPrice", { value: minPrice }),
        onRemove: () => setMinPrice(undefined),
      });
    }
    if (maxPrice !== undefined) {
      list.push({
        key: "maxPrice",
        label: t("collections.chipMaxPrice", { value: maxPrice }),
        onRemove: () => setMaxPrice(undefined),
      });
    }
    if (sortBy && sortBy !== "default") {
      list.push({
        key: "sortBy",
        label: t("collections.chipSort", { value: sortLabelMap[sortBy] ?? sortBy }),
        onRemove: () => setSortBy("default"),
      });
    }
    return list;
  }, [search, shape, material, minPrice, maxPrice, sortBy, t, shapeLabelMap, materialLabelMap, sortLabelMap]);

  function handleProductClick(productId: number) {
    const product = products.find((p) => p.id === productId);
    if (product) {
      track("product_card_clicked", {
        product_id: String(productId),
        product_name: isZh ? product.nameZh : product.nameEn,
      });
    }
    const returnUrl = `${location.pathname}${location.search}`;
    saveCatalogNavState({
      returnUrl,
      productId,
      scrollY: typeof window !== "undefined" ? window.scrollY : 0,
    });
    navigate(`/product/${productId}`, {
      state: { catalogReturnUrl: returnUrl },
    });
  }

  function handleResetFilters() {
    setSearch("");
    setMaterial("");
    setShape("");
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setSortBy("default");
  }

  function handleRemoveLastFilter() {
    const last = activeFilters[activeFilters.length - 1];
    if (last) last.onRemove();
  }

  const filterFormBody = (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <h3 className="font-display font-medium text-brand-primary tracking-wide flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          {t("collections.advancedFilters")}
        </h3>
        <button
          type="button"
          onClick={handleResetFilters}
          className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-brand-primary transition-colors font-semibold"
        >
          {t("collections.reset")}
        </button>
      </div>

      {/* Search Input */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
          {t("collections.searchLabel")}
        </label>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("collections.searchPlaceholder")}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary transition-colors bg-slate-50/50"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>
      </div>

      {/* Shape Filter */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
          {t("collections.frameShape")}
        </label>
        <select
          value={shape}
          onChange={(e) => {
            const value = e.target.value;
            setShape(value);
            track("product_filter_applied", { filter_type: "shape", filter_value: value });
          }}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50 transition-colors"
        >
          <option value="">{t("collections.allShapes")}</option>
          <option value="ROUND">{t("collections.shapeRound")}</option>
          <option value="SQUARE">{t("collections.shapeSquare")}</option>
          <option value="RECTANGLE">{t("collections.shapeRectangle")}</option>
          <option value="AVIATOR">{t("collections.shapeAviator")}</option>
          <option value="CAT_EYE">{t("collections.shapeCatEye")}</option>
          <option value="GEOMETRIC">{t("collections.shapeGeometric")}</option>
        </select>
      </div>

      {/* Material Filter */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
          {t("collections.material")}
        </label>
        <select
          value={material}
          onChange={(e) => {
            const value = e.target.value;
            setMaterial(value);
            track("product_filter_applied", { filter_type: "material", filter_value: value });
          }}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50 transition-colors"
        >
          <option value="">{t("collections.allMaterials")}</option>
          <option value="Grade 5 Titanium">{t("collections.materialTitanium")}</option>
          <option value="Japanese Acetate">{t("collections.materialAcetate")}</option>
          <option value="Surgical Steel / Titanium">{t("collections.materialSurgicalSteel")}</option>
          <option value="Crystal Acetate">{t("collections.materialCrystal")}</option>
        </select>
      </div>

      {/* Price Filters */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
          {t("collections.priceRange")}
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={minPrice ?? ""}
            aria-invalid={isPriceRangeInvalid}
            onChange={(e) => {
              const value = e.target.value;
              setMinPrice(value !== "" ? Number(value) : undefined);
              track("product_filter_applied", { filter_type: "minPrice", filter_value: value });
            }}
            placeholder={t("collections.priceMin")}
            className={cn(
              "w-1/2 px-3 py-2 border rounded-xl text-sm focus:outline-none bg-slate-50/50 transition-colors",
              isPriceRangeInvalid
                ? "border-red-400 focus:border-red-500"
                : "border-slate-200 focus:border-brand-primary"
            )}
          />
          <input
            type="number"
            min={0}
            value={maxPrice ?? ""}
            aria-invalid={isPriceRangeInvalid}
            onChange={(e) => {
              const value = e.target.value;
              setMaxPrice(value !== "" ? Number(value) : undefined);
              track("product_filter_applied", { filter_type: "maxPrice", filter_value: value });
            }}
            placeholder={t("collections.priceMax")}
            className={cn(
              "w-1/2 px-3 py-2 border rounded-xl text-sm focus:outline-none bg-slate-50/50 transition-colors",
              isPriceRangeInvalid
                ? "border-red-400 focus:border-red-500"
                : "border-slate-200 focus:border-brand-primary"
            )}
          />
        </div>
        {isPriceRangeInvalid && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {t("collections.priceRangeInvalid")}
          </p>
        )}
      </div>

      {/* Sorting */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
          {t("collections.sortBy")}
        </label>
        <select
          value={sortBy}
          onChange={(e) => {
            const value = e.target.value;
            setSortBy(value);
            track("product_filter_applied", { filter_type: "sortBy", filter_value: value });
          }}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50 transition-colors"
        >
          <option value="default">{t("collections.sortDefault")}</option>
          <option value="price_asc">{t("collections.sortPriceAsc")}</option>
          <option value="price_desc">{t("collections.sortPriceDesc")}</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col w-full px-5 sm:px-8 lg:px-12 max-w-[1440px] mx-auto py-10 sm:py-16 gap-8 lg:gap-12">
      <PageIntro
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
              {t("collections.productCount")}
            </p>
            <p className="mt-2 text-2xl font-display font-medium text-brand-primary">{products.length}</p>
          </div>
        }
      />

      {/* Mobile Compact Filter Trigger Bar */}
      <div className="flex lg:hidden items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen((v) => !v)}
          aria-expanded={mobileFiltersOpen}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-primary/90"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>
            {activeFilters.length > 0
              ? t("collections.filterButtonWithCount", { count: activeFilters.length })
              : t("collections.filterButton")}
          </span>
        </button>
        <span className="text-xs font-medium text-slate-500" aria-live="polite">
          {t("collections.resultCount", { count: products.length })}
        </span>
      </div>

      {/* Mobile Collapsible Filter Panel */}
      {mobileFiltersOpen && (
        <div className="lg:hidden bg-white border border-slate-200 rounded-[24px] p-5 shadow-md flex flex-col gap-5">
          {filterFormBody}
          <Button type="button" size="sm" onClick={() => setMobileFiltersOpen(false)} className="w-full rounded-xl">
            {t("collections.closeFilters")}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
        {/* Desktop Search & Filter Sidebar */}
        <aside className="hidden lg:flex bg-white border border-slate-200 rounded-[24px] p-6 sticky top-24 shadow-sm flex-col gap-6">
          {filterFormBody}
        </aside>

        {/* Product Catalog Grid */}
        <div className="flex flex-col gap-6">
          {/* Removable Active Filter Chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" aria-live="polite">
              {activeFilters.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  aria-label={t("collections.removeFilter", { label: chip.label })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-brand-primary shadow-xs hover:border-brand-primary/40 hover:bg-slate-50 transition-colors"
                >
                  <span>{chip.label}</span>
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              ))}
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-slate-500 hover:text-brand-primary px-2 py-1 underline underline-offset-4"
              >
                {t("collections.reset")}
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="w-full text-center py-20 text-sm uppercase tracking-[0.2em] text-slate-400">
              {t("loadingCatalog")}
            </div>
          ) : null}

          {error ? (
            <SectionCard
              className="w-full border-red-200 bg-red-50/70"
              contentClassName="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm text-red-700">{error}</p>
              <Button type="button" variant="outline-light" className="self-start" onClick={loadFilteredCatalog}>
                <RefreshCw className="w-4 h-4" />
                {t("retry")}
              </Button>
            </SectionCard>
          ) : null}

          {!isLoading && !error && products.length === 0 ? (
            <div className="w-full text-center py-16 px-6 border border-dashed border-slate-200 bg-slate-50/50 rounded-[24px] flex flex-col items-center gap-4">
              <p className="text-sm text-slate-500 font-medium">
                {t("collections.noResults")}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {activeFilters.length > 0 && (
                  <Button type="button" size="sm" onClick={handleRemoveLastFilter} className="rounded-xl">
                    {t("collections.removeOneFilter")}
                  </Button>
                )}
                <Button type="button" variant="outline-light" size="sm" onClick={handleResetFilters} className="rounded-xl">
                  {t("collections.resetAllFilters")}
                </Button>
              </div>
            </div>
          ) : null}

          {!isLoading && !error && products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {products.map((item) => {
                const name = isZh ? item.nameZh : item.nameEn;
                const materialLabel = isZh ? item.materialZh : item.materialEn;
                const isReturnedCard = highlightedProductId === item.id;
                return (
                  <article
                    key={item.id}
                    data-product-id={item.id}
                    className={cn(
                      "group cursor-pointer flex flex-col rounded-[30px] transition-all",
                      isReturnedCard && "ring-2 ring-brand-cyan ring-offset-4"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleProductClick(item.id)}
                      className="text-left rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 w-full"
                    >
                      <div className="bg-white border border-slate-100 rounded-[28px] w-full aspect-[4/3] flex items-center justify-center p-8 overflow-hidden relative transition-all duration-700 ease-in-out hover:shadow-[0_20px_40px_-20px_rgba(11,32,70,0.1)] hover:border-slate-200">
                        <div className="absolute inset-0 bg-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <img
                          src={item.imageUrl}
                          alt={name}
                          className="w-4/5 h-auto object-contain transform group-hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply relative z-10"
                          loading="lazy"
                        />
                        <div className="absolute left-5 top-5 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400 backdrop-blur-sm">
                          {materialLabel}
                        </div>
                        {!isProductOrderable(item) ? (
                          <div className="absolute right-5 top-5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] uppercase tracking-[0.15em] font-semibold text-amber-700">
                            {item.salesStatus === "PAUSED" ? t("product.paused") : t("product.outOfStock")}
                          </div>
                        ) : isProductLowStock(item) ? (
                          <div className="absolute right-5 top-5 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1 text-[10px] font-semibold text-brand-primary">
                            {typeof item.stockQuantity === "number"
                              ? t("product.lowStock", { count: item.stockQuantity })
                              : t("product.lowStockPublic")}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-6 px-1.5 pb-1 flex flex-col gap-2">
                        <div className="flex justify-between items-baseline">
                          <h2 className="text-xl font-display font-medium tracking-wide text-brand-primary">{name}</h2>
                          <span className="text-base text-slate-500 font-medium">{formatPrice(item.basePrice)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-[10px] uppercase font-semibold tracking-widest text-slate-400">
                            {t("collections.prescriptionReadyLabel")}
                          </p>
                          <span className="inline-flex items-center gap-2 text-xs text-brand-primary font-medium">
                            {t("collections.viewDetails")}
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </span>
                        </div>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
