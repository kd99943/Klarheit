import { useCallback, useEffect, useState } from "react";
import { fetchLensOptions, type LensOption } from "../services/api";

export function useLensOptions() {
  const [options, setOptions] = useState<LensOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLensOptions();
      if (!signal?.aborted) {
        setOptions(data);
      }
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load lens options.");
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

  return { options, isLoading, error };
}
