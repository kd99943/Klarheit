import { useNavigate } from "react-router-dom";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useProducts } from "../hooks/useProducts";
import { type Product } from "../services/api";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function CollectionsPage() {
  const navigate = useNavigate();
  const { requireAuth } = useAuth();
  const { products, isLoading, error, retry } = useProducts();

  function handleProductSelect(product: Product) {
    if (requireAuth(
      { path: "/checkout", state: { product } },
      "Sign in or create your account to continue with this frame."
    )) {
      navigate("/checkout", { state: { product } });
    }
  }

  return (
    <div className="flex flex-col w-full px-5 sm:px-8 lg:px-12 max-w-[1440px] mx-auto py-12 sm:py-16 gap-12">
      <PageIntro
        eyebrow="Optical Catalog"
        title="The Inaugural Collection"
        description="Each silhouette is tuned for lightweight endurance, precise balance, and prescription-ready lens geometry. Select a frame to move directly into checkout."
        actions={
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Available Builds</p>
            <p className="mt-2 text-2xl font-display font-medium text-brand-primary">{products.length || "--"}</p>
          </div>
        }
      />

      {isLoading ? (
        <div className="max-w-5xl mx-auto w-full text-center py-20 text-sm uppercase tracking-[0.2em] text-slate-400">
          Loading catalog...
        </div>
      ) : null}

      {error ? (
        <SectionCard className="max-w-5xl mx-auto w-full border-red-200 bg-red-50/70" contentClassName="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <Button type="button" variant="outline-light" className="self-start" onClick={retry}>
            <RefreshCw className="w-4 h-4" />
            Retry
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
                  <span className="text-base text-slate-500">{currencyFormatter.format(item.basePrice)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] uppercase font-semibold tracking-widest text-slate-400">Prescription-ready chassis</p>
                  <span className="inline-flex items-center gap-2 text-xs text-brand-primary">
                    Select
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </button>
          </article>
        ))}
        </div>
        <SectionCard
          title="Selection Notes"
          eyebrow="Before Checkout"
          description="Current checkout accepts a frame choice and applies the standard lens package. Use Config Lab first if you want to review prescription values before payment."
          className="xl:sticky xl:top-28"
        >
          <div className="space-y-4 text-sm text-slate-600">
            <div className="rounded-2xl bg-surface-muted px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Included</p>
              <p className="mt-2">High-index custom lenses, AR coating, and HEV filter are bundled at checkout.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Mobile Flow</p>
              <p className="mt-2">Cards stay tap-sized and the selection CTA remains visible without hover-dependent cues.</p>
            </div>
          </div>
        </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
