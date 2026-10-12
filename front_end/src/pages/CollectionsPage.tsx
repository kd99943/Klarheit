import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { fetchProductsFiltered, type Product, type ProductFilterParams } from "../services/api";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { formatPrice } from "../lib/utils";
import { track } from "../services/analytics";

export function CollectionsPage() {
  const { t, i18n } = useTranslation("collections");
  const navigate = useNavigate();

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [material, setMaterial] = useState("");
  const [shape, setShape] = useState("");
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState("default");

  // Catalog State
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        track("product_search_used", { query: search.trim(), result_count: data.length });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load filtered catalog.");
    } finally {
      setIsLoading(false);
    }
  }, [search, material, shape, minPrice, maxPrice, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadFilteredCatalog();
    }, 300); // Debounce typing search
    return () => clearTimeout(timer);
  }, [loadFilteredCatalog]);

  const isZh = i18n.language === "zh";

  useEffect(() => {
    track("collections_viewed", {});
  }, []);

  function handleProductClick(productId: number) {
    const product = products.find((p) => p.id === productId);
    if (product) {
      track("product_card_clicked", {
        product_id: String(productId),
        product_name: isZh ? product.nameZh : product.nameEn,
      });
    }
    navigate(`/product/${productId}`);
  }

  function handleResetFilters() {
    setSearch("");
    setMaterial("");
    setShape("");
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setSortBy("default");
  }

  return (
    <div className="flex flex-col w-full px-5 sm:px-8 lg:px-12 max-w-[1440px] mx-auto py-12 sm:py-16 gap-12">
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

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
        {/* Search & Filter Sidebar */}
        <aside className="bg-white border border-slate-200 rounded-[24px] p-6 sticky top-24 shadow-sm flex flex-col gap-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="font-display font-medium text-brand-primary tracking-wide flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-slate-400" />
              {t("collections.advancedFilters")}
            </h3>
            <button
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
                value={minPrice ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setMinPrice(value ? Number(value) : undefined);
                  track("product_filter_applied", { filter_type: "minPrice", filter_value: value });
                }}
                placeholder={t("collections.priceMin")}
                className="w-1/2 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
              />
              <input
                type="number"
                value={maxPrice ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setMaxPrice(value ? Number(value) : undefined);
                  track("product_filter_applied", { filter_type: "maxPrice", filter_value: value });
                }}
                placeholder={t("collections.priceMax")}
                className="w-1/2 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
              />
            </div>
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
        </aside>

        {/* Product Catalog Grid */}
        <div className="flex flex-col gap-6">
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
            <div className="w-full text-center py-20 border border-dashed border-slate-200 bg-slate-50/50 rounded-[24px]">
              <p className="text-sm text-slate-400 font-medium">
                {t("collections.noResults")}
              </p>
              <button
                onClick={handleResetFilters}
                className="mt-4 text-xs font-semibold text-brand-primary hover:underline"
              >
                {t("collections.resetAllFilters")}
              </button>
            </div>
          ) : null}

          {!isLoading && !error && products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {products.map((item) => {
                const name = isZh ? item.nameZh : item.nameEn;
                const materialLabel = isZh ? item.materialZh : item.materialEn;
                return (
                  <article key={item.id} className="group cursor-pointer flex flex-col">
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
                      </div>
                      <div className="mt-6 flex flex-col gap-2">
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
