export const ACTIVE_ACCOUNT_OWNER_KEY = "klarheit_active_account_owner_v1";
export const CART_STORAGE_KEY = "klarheit_cart_v1";
export const CART_PRIVATE_STORAGE_KEY = "klarheit_cart_private_v1";
export const ORDER_CART_MAP_KEY = "klarheit_order_cart_map_v1";
export const CHECKOUT_STATE_KEY = "klarheit_checkout_state";
export const CHECKOUT_IDEMPOTENCY_KEY = "klarheit_checkout_idempotency_v1";
export const TRYON_SNAPSHOT_KEY = "klarheit_tryon_snapshot";
export const PRIVATE_DRAFT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface TaggedTryOnSnapshot {
  dataUrl: string;
  productId?: number | null;
  productName?: string | null;
  finishId?: string | null;
  ownerKey?: string | null;
  capturedAt: number;
  expiresAt: number;
}

const ALL_SENSITIVE_KEYS = [
  CART_PRIVATE_STORAGE_KEY,
  ORDER_CART_MAP_KEY,
  CHECKOUT_STATE_KEY,
  CHECKOUT_IDEMPOTENCY_KEY,
  TRYON_SNAPSHOT_KEY,
  "savedFinishId",
  "klarheit_selected_selection",
  "klarheit_finish_by_product_v1",
  "klarheit_catalog_nav_state_v1",
  "klarheit_last_order_number",
];

export function normalizeOwnerKey(user?: { id?: number | null; email?: string | null } | null): string | null {
  const email = user?.email?.trim().toLowerCase();
  if (email) return email;
  if (user?.id !== undefined && user?.id !== null) return String(user.id);
  return null;
}

export function getStoredAccountOwner(): string | null {
  try {
    return (
      localStorage.getItem(ACTIVE_ACCOUNT_OWNER_KEY) ??
      sessionStorage.getItem(ACTIVE_ACCOUNT_OWNER_KEY) ??
      null
    );
  } catch {
    return null;
  }
}

export function setStoredAccountOwner(ownerKey: string | null): void {
  try {
    if (!ownerKey) {
      localStorage.removeItem(ACTIVE_ACCOUNT_OWNER_KEY);
      sessionStorage.removeItem(ACTIVE_ACCOUNT_OWNER_KEY);
    } else {
      localStorage.setItem(ACTIVE_ACCOUNT_OWNER_KEY, ownerKey);
      sessionStorage.setItem(ACTIVE_ACCOUNT_OWNER_KEY, ownerKey);
    }
  } catch {
    /* ignore storage restrictions */
  }
}

export function purgeAllSensitiveBrowserData(options?: {
  clearCart?: boolean;
  dispatchEventName?: string;
}): void {
  const clearCart = options?.clearCart !== false;
  try {
    for (const key of ALL_SENSITIVE_KEYS) {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    }
    if (clearCart) {
      sessionStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(CART_STORAGE_KEY);
    }
    if (options?.dispatchEventName && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(options.dispatchEventName));
    }
  } catch {
    /* ignore storage errors */
  }
}

export function syncAccountIdentityOrPurge(nextOwnerKey: string | null): boolean {
  const prevOwner = getStoredAccountOwner();
  let switched = false;
  if (prevOwner && nextOwnerKey && prevOwner !== nextOwnerKey) {
    purgeAllSensitiveBrowserData({
      clearCart: true,
      dispatchEventName: "klarheit:account-switched",
    });
    switched = true;
  }
  setStoredAccountOwner(nextOwnerKey);
  if (nextOwnerKey && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("klarheit:account-owner-synced", { detail: { ownerKey: nextOwnerKey } })
    );
  }
  return switched;
}

export function writeTaggedTryOnSnapshot(payload: {
  dataUrl: string;
  productId?: number | null;
  productName?: string | null;
  finishId?: string | null;
  ownerKey?: string | null;
}): void {
  try {
    const now = Date.now();
    const record: TaggedTryOnSnapshot = {
      dataUrl: payload.dataUrl,
      productId: payload.productId ?? null,
      productName: payload.productName ?? null,
      finishId: payload.finishId ?? null,
      ownerKey: payload.ownerKey ?? getStoredAccountOwner(),
      capturedAt: now,
      expiresAt: now + PRIVATE_DRAFT_TTL_MS,
    };
    sessionStorage.setItem(TRYON_SNAPSHOT_KEY, JSON.stringify(record));
    // Never persist biometric face snapshots into shared localStorage
    localStorage.removeItem(TRYON_SNAPSHOT_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export function readTaggedTryOnSnapshot(expectedOwnerKey?: string | null): TaggedTryOnSnapshot | null {
  try {
    const raw = sessionStorage.getItem(TRYON_SNAPSHOT_KEY);
    if (!raw) return null;
    if (raw.startsWith("data:")) {
      return {
        dataUrl: raw,
        productId: null,
        productName: null,
        finishId: null,
        ownerKey: null,
        capturedAt: Date.now(),
        expiresAt: Date.now() + PRIVATE_DRAFT_TTL_MS,
      };
    }
    const parsed = JSON.parse(raw) as Partial<TaggedTryOnSnapshot>;
    if (!parsed || typeof parsed.dataUrl !== "string" || !parsed.dataUrl) {
      sessionStorage.removeItem(TRYON_SNAPSHOT_KEY);
      return null;
    }
    if (typeof parsed.expiresAt === "number" && Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(TRYON_SNAPSHOT_KEY);
      return null;
    }
    const activeOwner = expectedOwnerKey ?? getStoredAccountOwner();
    if (parsed.ownerKey && activeOwner && parsed.ownerKey !== activeOwner) {
      sessionStorage.removeItem(TRYON_SNAPSHOT_KEY);
      return null;
    }
    return {
      dataUrl: parsed.dataUrl,
      productId: parsed.productId ?? null,
      productName: parsed.productName ?? null,
      finishId: parsed.finishId ?? null,
      ownerKey: parsed.ownerKey ?? null,
      capturedAt: parsed.capturedAt ?? Date.now(),
      expiresAt: parsed.expiresAt ?? Date.now() + PRIVATE_DRAFT_TTL_MS,
    };
  } catch {
    return null;
  }
}
