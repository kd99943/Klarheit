import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { fetchProducts, type Product } from "../services/api";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function CollectionsPage() {
  const navigate = useNavigate();
  const { requireAuth } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadProducts() {
      try {
        const catalog = await fetchProducts();
        if (!isCancelled) {
          setProducts(catalog);
          setError(null);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load the catalog.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isCancelled = true;
    };
  }, []);

  function handleProductSelect(product: Product) {
    if (requireAuth(
      { path: "/checkout", state: { product } },
      "Sign in or create your account to continue with this frame."
    )) {
      navigate("/checkout", { state: { product } });
    }
  }

  return (
    <div className="flex flex-col w-full px-8 lg:px-12 max-w-[1440px] mx-auto py-16">
      <div className="w-full flex flex-col justify-center items-center border-b border-slate-200 pb-10 mb-16">
        <h1 className="text-4xl md:text-5xl font-display font-light text-brand-primary tracking-tight uppercase text-center">
          THE INAUGURAL COLLECTION
        </h1>
      </div>

      {isLoading ? (
        <div className="max-w-5xl mx-auto w-full text-center py-20 text-sm uppercase tracking-[0.2em] text-slate-400">
          Loading catalog...
        </div>
      ) : null}

      {error ? (
        <div className="max-w-5xl mx-auto w-full border border-red-200 bg-red-50 text-red-700 px-6 py-4 rounded-lg text-sm">
          {error}
        </div>
      ) : null}

      {!isLoading && !error ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-20 max-w-5xl mx-auto">
        {products.map((item) => (
          <article key={item.id} className="group cursor-pointer flex flex-col">
            <button
              type="button"
              onClick={() => handleProductSelect(item)}
              className="contents text-left"
            >
              <div className="bg-white border border-slate-100 rounded-lg w-full aspect-[4/3] flex items-center justify-center p-8 overflow-hidden relative transition-all duration-700 ease-in-out hover:shadow-[0_20px_40px_-20px_rgba(11,32,70,0.1)] hover:border-slate-200">
                <div className="absolute inset-0 bg-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <img 
                  src={item.imageUrl} 
                  alt={item.name} 
                  className="w-4/5 h-auto object-contain transform group-hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply relative z-10"
                />
              </div>
              <div className="mt-8 flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <h2 className="text-xl font-display font-medium tracking-wide text-brand-primary">{item.name}</h2>
                  <span className="text-base text-slate-500">{currencyFormatter.format(item.basePrice)}</span>
                </div>
                <p className="text-[10px] uppercase font-semibold tracking-widest text-slate-400">{item.material}</p>
              </div>
            </button>
          </article>
        ))}
        </div>
      ) : null}
    </div>
  );
}
