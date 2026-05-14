import { useCallback, useEffect, useState } from "react";
import { fetchProducts, type Product } from "../services/api";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const catalog = await fetchProducts();
      if (!signal?.aborted) {
        setProducts(catalog);
      }
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load the catalog.");
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  return { products, isLoading, error, retry };
}
