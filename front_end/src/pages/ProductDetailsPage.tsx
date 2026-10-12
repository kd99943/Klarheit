import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Eye, ShieldCheck, ShoppingCart, Settings, Ruler, Box, Plus } from "lucide-react";
import { fetchProductById, type Product } from "../services/api";
import { Button } from "../components/ui/Button";
import { SectionCard } from "../components/ui/SectionCard";
import { formatPrice } from "../lib/utils";
import { useAuth } from "../auth/AuthProvider";
import { useCart, cartItemFromProduct } from "../hooks/useCart";
import { track } from "../services/analytics";

export function ProductDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("collections");
  const { requireAuth } = useAuth();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProduct() {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchProductById(Number(id));
        setProduct(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load product details.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadProduct();
    if (id) {
      track("product_details_viewed", { product_id: id });
    }
  }, [id]);

  const isZh = i18n.language === "zh";

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
          <p className="text-sm text-red-700 mb-6">{error || "Product not found"}</p>
          <Link to="/collections">
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
  };

  const shapeText = shapeLabelMap[product.shape.toUpperCase()] || product.shape;

  // Save product selection and navigate
  function handleARTryOn() {
    if (product) {
      sessionStorage.setItem("savedFinishId", product.name);
      navigate("/virtual-studio");
    }
  }

  function handleConfigure() {
    if (product) {
      sessionStorage.setItem("savedFinishId", product.name);
      navigate("/config-lab", { state: { finishId: product.name } });
    }
  }

  function handleDirectBuy() {
    if (product) {
      if (requireAuth({ path: "/checkout", state: { product } }, t("signInMessage"))) {
        navigate("/checkout", { state: { product } });
      }
    }
  }

  function handleAddToCart() {
    if (!product) return;
    addItem(cartItemFromProduct(product));
    track("cart_item_added", {
      product_id: String(product.id),
      product_name: name,
      lens_count: 0,
    });
    navigate("/cart");
  }

  return (
    <div className="w-full bg-surface-offwhite px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
        {/* Back Navigation */}
        <Link
          to="/collections"
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 hover:text-brand-primary transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t("product.backToCatalogNav")}
        </Link>

        {/* Product Details Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch mt-2">
          {/* Left Column: Image and Specs Card */}
          <div className="md:col-span-7 flex flex-col gap-6">
            <div className="bg-white border border-slate-200/60 rounded-[32px] p-8 sm:p-12 flex items-center justify-center aspect-[4/3] relative overflow-hidden shadow-sm">
              <div className="absolute inset-0 bg-slate-50/20"></div>
              <img
                src={product.imageUrl}
                alt={name}
                className="w-11/12 h-auto object-contain mix-blend-multiply relative z-10 drop-shadow-lg"
                loading="lazy"
              />
              <div className="absolute right-6 top-6 bg-slate-100/80 border border-slate-200/50 backdrop-blur-sm rounded-2xl px-4 py-2 flex items-center gap-2 text-xs font-medium text-slate-600">
                <Box className="w-3.5 h-3.5" />
                {shapeText}
              </div>
            </div>

            {/* Spec details card */}
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
                    {product.shape === "ROUND"
                      ? t("product.faceFitRound")
                      : t("product.faceFitOther")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Information & Actions */}
          <div className="md:col-span-5 flex flex-col justify-between gap-8 bg-white border border-slate-200/60 rounded-[32px] p-8 shadow-sm">
            <div className="flex flex-col gap-6">
              <div>
                <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate-400">
                  {t("product.premiumCollection")}
                </span>
                <h1 className="text-3xl sm:text-4xl font-display font-medium text-brand-primary tracking-tight mt-1">
                  {name}
                </h1>
                <p className="text-2xl font-semibold text-brand-primary mt-3">{formatPrice(product.basePrice)}</p>
              </div>

              <div className="border-t border-slate-100 pt-6 flex flex-col gap-4">
                <p className="text-sm text-slate-500 leading-relaxed font-light">
                  {t("product.description", { name })}
                </p>

                <div className="flex items-center gap-2 text-xs text-brand-cyan font-medium bg-slate-50 rounded-xl p-3 border border-slate-100 mt-2">
                  <ShieldCheck className="w-4 h-4 text-brand-cyan shrink-0" />
                  <span>
                    {t("product.qualityGuarantee")}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="flex flex-col gap-3 pt-6 border-t border-slate-100">
              <button
                onClick={handleARTryOn}
                className="w-full bg-brand-primary text-white border border-transparent rounded-2xl py-4 flex items-center justify-center gap-2 hover:bg-brand-primary/95 transition-all text-sm font-semibold shadow-sm hover:scale-[1.01]"
              >
                <Eye className="w-4 h-4" />
                {t("product.arTryOn")}
              </button>

              <button
                onClick={handleConfigure}
                className="w-full bg-white text-brand-primary border border-slate-200 rounded-2xl py-4 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all text-sm font-semibold"
              >
                <Settings className="w-4 h-4" />
                {t("product.configLab")}
              </button>

              <button
                onClick={handleAddToCart}
                className="w-full bg-white text-slate-700 border border-slate-200 rounded-2xl py-4 flex items-center justify-center gap-2 hover:bg-slate-50 hover:text-brand-primary transition-all text-sm font-semibold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                {t("product.addToCart", "加入购物车")}
              </button>

              <button
                onClick={handleDirectBuy}
                className="w-full bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100 hover:text-brand-primary rounded-2xl py-3 flex items-center justify-center gap-2 transition-all text-xs font-semibold"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                {t("product.buyNow")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
