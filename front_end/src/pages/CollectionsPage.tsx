import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useProducts } from "../hooks/useProducts";
import { type Product } from "../services/api";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { formatPrice } from "../lib/utils";

export function CollectionsPage() {
  const { t } = useTranslation("collections");
  const navigate = useNavigate();
  const { requireAuth } = useAuth();
  const { products, isLoading, error, retry } = useProducts();

  function handleProductSelect(product: Product) {
    if (requireAuth(
      { path: "/checkout", state: { product } },
      t("signInMessage")
    )) {
      navigate("/checkout", { state: { product } });
    }
  }

  return (
    <div className="flex flex-col w-full px-5 sm:px-8 lg:px-12 max-w-[1440px] mx-auto py-12 sm:py-16 gap-12">
      <PageIntro
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("availableBuilds")}</p>
            <p className="mt-2 text-2xl font-display font-medium text-brand-primary">{products.length || "--"}</p>
          </div>
        }
      />

      {isLoading ? (
        <div className="max-w-5xl mx-auto w-full text-center py-20 text-sm uppercase tracking-[0.2em] text-slate-400">
          {t("loadingCatalog")}
        </div>
      ) : null}

      {error ? (
        <SectionCard className="max-w-5xl mx-auto w-full border-red-200 bg-red-50/70" contentClassName="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <Button type="button" variant="outline-light" className="self-start" onClick={retry}>
            <RefreshCw className="w-4 h-4" />
            {t("retry")}
          </Button>
        </SectionCard>
      ) : null}

      {!isLoading && !error ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl">
        {products.map((item) => (
          <article key={item.id} className="group cursor-pointer flex flex-col">
            <button
              type="button"
              onClick={() => handleProductSelect(item)}
              className="text-left rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            >
              <div className="bg-white border border-slate-100 rounded-[28px] w-full aspect-[4/3] flex items-center justify-center p-8 overflow-hidden relative transition-all duration-700 ease-in-out hover:shadow-[0_20px_40px_-20px_rgba(11,32,70,0.1)] hover:border-slate-200">
                <div className="absolute inset-0 bg-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <img 
                  src={item.imageUrl} 
                  alt={item.name} 
                  className="w-4/5 h-auto object-contain transform group-hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply relative z-10"
                />
                <div className="absolute left-5 top-5 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400 backdrop-blur-sm">
                  {item.material}
                </div>
              </div>
              <div className="mt-8 flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <h2 className="text-xl font-display font-medium tracking-wide text-brand-primary">{item.name}</h2>
                  <span className="text-base text-slate-500">{formatPrice(item.basePrice)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] uppercase font-semibold tracking-widest text-slate-400">{t("prescriptionReady")}</p>
                  <span className="inline-flex items-center gap-2 text-xs text-brand-primary">
                    {t("select")}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </button>
          </article>
        ))}
        </div>
        <SectionCard
          title={t("selectionNotes.title")}
          eyebrow={t("selectionNotes.eyebrow")}
          description={t("selectionNotes.description")}
          className="xl:sticky xl:top-28"
        >
          <div className="space-y-4 text-sm text-slate-600">
            <div className="rounded-2xl bg-surface-muted px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("selectionNotes.included.label")}</p>
              <p className="mt-2">{t("selectionNotes.included.description")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("selectionNotes.mobileFlow.label")}</p>
              <p className="mt-2">{t("selectionNotes.mobileFlow.description")}</p>
            </div>
          </div>
        </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
