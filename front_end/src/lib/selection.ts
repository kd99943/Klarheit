import type { Product, ProductSku } from "../services/api";

const SELECTED_SELECTION_KEY = "klarheit_selected_selection";
const FINISH_BY_PRODUCT_KEY = "klarheit_finish_by_product_v1";
const LEGACY_FINISH_KEY = "savedFinishId";
const CATALOG_NAV_STATE_KEY = "klarheit_catalog_nav_state_v1";

export interface StoredSelection {
  productId: number;
  finishId: string | null;
  sizeSpec?: string | null;
  skuId?: number | null;
  updatedAt?: number;
}

export interface CatalogNavState {
  returnUrl: string;
  productId: number;
  scrollY: number;
}

/**
 * Resolve availability cleanly for both public API responses (inStock/lowStock only)
 * and admin/mocked responses (exact availableQty/stockQuantity).
 */
export function isSkuOrderable(sku?: ProductSku | null): boolean {
  if (!sku) return true;
  if (sku.salesStatus && sku.salesStatus !== "AVAILABLE") return false;
  if (typeof sku.inStock === "boolean") return sku.inStock;
  if (typeof sku.availableQty === "number") return sku.availableQty > 0;
  return true;
}

export function isSkuLowStock(sku?: ProductSku | null): boolean {
  if (!sku || !isSkuOrderable(sku)) return false;
  if (typeof sku.lowStock === "boolean") return sku.lowStock;
  if (typeof sku.availableQty === "number") return sku.availableQty > 0 && sku.availableQty <= 5;
  return false;
}

export function isProductOrderable(product?: Product | null): boolean {
  if (!product) return false;
  if (product.salesStatus && product.salesStatus !== "AVAILABLE") return false;
  if (product.skus && product.skus.length > 0) {
    return product.skus.some((sku) => isSkuOrderable(sku));
  }
  if (typeof product.inStock === "boolean") return product.inStock;
  if (typeof product.stockQuantity === "number") return product.stockQuantity > 0;
  return true;
}

export function isProductLowStock(product?: Product | null): boolean {
  if (!product || !isProductOrderable(product)) return false;
  if (typeof product.lowStock === "boolean") return product.lowStock;
  if (typeof product.stockQuantity === "number") return product.stockQuantity > 0 && product.stockQuantity <= 5;
  return false;
}

export function getDistinctSizeSpecsForProduct(product?: Product | null, finishId?: string | null): string[] {
  if (!product) return [];
  const skus = product.skus ?? [];
  const finishFiltered = finishId
    ? skus.filter((s) => s.finishId.toLowerCase() === finishId.toLowerCase())
    : skus;
  const source = finishFiltered.length > 0 ? finishFiltered : skus;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of source) {
    const trimmed = s.sizeSpec?.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  if (out.length === 0 && product.specsSize?.trim()) {
    out.push(product.specsSize.trim());
  }
  return out;
}

/**
 * Exact SKU match by explicit skuId OR strict (finishId, sizeSpec) pair.
 * Never silently falls back to a different finish or different size.
 */
export function resolveSkuForSelection(
  product?: Product | null,
  options?: { skuId?: number | null; finishId?: string | null; sizeSpec?: string | null }
): ProductSku | undefined {
  if (!product?.skus || product.skus.length === 0) return undefined;
  if (options?.skuId != null) {
    const byId = product.skus.find((s) => s.id === options.skuId);
    if (byId) return byId;
  }
  const finish = options?.finishId?.trim().toLowerCase();
  const size = options?.sizeSpec?.trim().toLowerCase();
  if (finish && size) {
    return product.skus.find(
      (s) => s.finishId.toLowerCase() === finish && s.sizeSpec.toLowerCase() === size
    );
  }
  if (finish) {
    const matchingFinish = product.skus.filter((s) => s.finishId.toLowerCase() === finish);
    if (matchingFinish.length === 1) return matchingFinish[0];
    if (product.specsSize) {
      const defaultSizeMatch = matchingFinish.find(
        (s) => s.sizeSpec.toLowerCase() === product.specsSize.trim().toLowerCase()
      );
      if (defaultSizeMatch) return defaultSizeMatch;
    }
    return matchingFinish[0];
  }
  return product.skus.length === 1 ? product.skus[0] : undefined;
}

/**
 * Canonical default finish resolution shared across ProductDetailsPage,
 * ARVirtualStudio, and frameCatalog so every view agrees on the initial swatch.
 */
export function getDefaultFinishId(product: Product): string | undefined {
  const finishes = product.arConfigs ?? [];
  if (finishes.length === 0) return undefined;
  return finishes.find((f) => f.id === "titanium")?.id ?? finishes[0].id;
}

/**
 * Validate a requested finishId strictly against this product's available finishes.
 * Never lets an invalid or stale finish silently pass through without notice.
 */
export function resolveFinishForProduct(
  product: Product,
  requestedFinishId?: string | null
): { finishId: string | undefined; wasInvalid: boolean } {
  const finishes = product.arConfigs ?? [];
  if (finishes.length === 0) {
    return { finishId: undefined, wasInvalid: false };
  }
  const trimmed = requestedFinishId?.trim();
  if (!trimmed) {
    return { finishId: getDefaultFinishId(product), wasInvalid: false };
  }
  const exact = finishes.find((f) => f.id === trimmed);
  if (exact) {
    return { finishId: exact.id, wasInvalid: false };
  }
  return { finishId: getDefaultFinishId(product), wasInvalid: true };
}

/**
 * Persist exact (productId, finishId) binding so two products sharing a finish id
 * (e.g. both having "titanium" or "matte-black") never cross-contaminate.
 */
export function persistProductSelection(
  productId: number,
  finishId?: string | null,
  sizeSpec?: string | null,
  skuId?: number | null
): void {
  try {
    const normalizedFinish = finishId?.trim() || null;
    const payload: StoredSelection = {
      productId,
      finishId: normalizedFinish,
      sizeSpec: sizeSpec?.trim() || null,
      skuId: skuId ?? null,
      updatedAt: Date.now(),
    };
    sessionStorage.setItem(SELECTED_SELECTION_KEY, JSON.stringify(payload));

    const mapRaw = sessionStorage.getItem(FINISH_BY_PRODUCT_KEY);
    const map: Record<string, string> = mapRaw ? (JSON.parse(mapRaw) as Record<string, string>) : {};
    if (normalizedFinish) {
      map[String(productId)] = normalizedFinish;
      sessionStorage.setItem(LEGACY_FINISH_KEY, normalizedFinish);
    } else {
      delete map[String(productId)];
      sessionStorage.removeItem(LEGACY_FINISH_KEY);
    }
    sessionStorage.setItem(FINISH_BY_PRODUCT_KEY, JSON.stringify(map));
  } catch {
    // Ignore private-mode storage restrictions
  }
}

/**
 * Read the last saved finish strictly scoped to `productId`.
 */
export function readSavedFinishForProduct(productId: number): string | null {
  try {
    const mapRaw = sessionStorage.getItem(FINISH_BY_PRODUCT_KEY);
    if (mapRaw) {
      const map = JSON.parse(mapRaw) as Record<string, string>;
      if (typeof map[String(productId)] === "string" && map[String(productId)].trim()) {
        return map[String(productId)];
      }
    }
    const selRaw = sessionStorage.getItem(SELECTED_SELECTION_KEY);
    if (selRaw) {
      const parsed = JSON.parse(selRaw) as StoredSelection;
      if (parsed && Number(parsed.productId) === productId && parsed.finishId) {
        return parsed.finishId;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function readLastProductSelection(): StoredSelection | null {
  try {
    const selRaw = sessionStorage.getItem(SELECTED_SELECTION_KEY);
    if (!selRaw) return null;
    const parsed = JSON.parse(selRaw) as StoredSelection;
    if (parsed && typeof parsed.productId === "number") {
      return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function saveCatalogNavState(state: CatalogNavState): void {
  try {
    sessionStorage.setItem(CATALOG_NAV_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function readCatalogNavState(): CatalogNavState | null {
  try {
    const raw = sessionStorage.getItem(CATALOG_NAV_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogNavState;
    if (parsed && typeof parsed.returnUrl === "string") {
      return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function clearCatalogNavState(): void {
  try {
    sessionStorage.removeItem(CATALOG_NAV_STATE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Parse product image gallery from primary imageUrl + comma-separated detailImages.
 */
export function getProductPhotoGallery(product: Product): string[] {
  const urls: string[] = [];
  const pushUnique = (raw?: string | null) => {
    const trimmed = raw?.trim();
    if (trimmed && !urls.includes(trimmed)) {
      urls.push(trimmed);
    }
  };
  pushUnique(product.imageUrl);
  if (product.detailImages) {
    for (const part of product.detailImages.split(",")) {
      pushUnique(part);
    }
  }
  return urls;
}

let freshCheckoutHandoff = false;

/**
 * Mark an intentional in-app SPA navigation into /checkout (from Cart or ConfigLab)
 * so Checkout can distinguish a fresh handoff from a browser reload (F5) that restores a draft.
 */
export function markFreshCheckoutHandoff(): void {
  freshCheckoutHandoff = true;
}

export function peekFreshCheckoutHandoff(): boolean {
  return freshCheckoutHandoff;
}

export function clearFreshCheckoutHandoff(): void {
  freshCheckoutHandoff = false;
}
