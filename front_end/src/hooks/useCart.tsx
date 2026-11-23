import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "../services/api";
import { track } from "../services/analytics";
import {
  ACTIVE_ACCOUNT_OWNER_KEY,
  CART_PRIVATE_STORAGE_KEY,
  CART_STORAGE_KEY,
  CHECKOUT_IDEMPOTENCY_KEY,
  CHECKOUT_STATE_KEY,
  ORDER_CART_MAP_KEY,
  PRIVATE_DRAFT_TTL_MS,
  TRYON_SNAPSHOT_KEY,
  getStoredAccountOwner,
} from "../lib/privacy";

export interface CartItem {
  id: string;
  productId: number;
  productName: string;
  productImageUrl: string;
  basePrice: number;
  finishId?: string;
  sizeSpec?: string;
  skuId?: number;
  prescription?: {
    sphOd: number;
    sphOs: number;
    cylOd: number;
    cylOs: number;
    axisOd: number;
    axisOs: number;
    pd: number;
  };
  lensOptionTypes: string[];
  /** Extra lens price already summed for display */
  lensPrice: number;
  tryOnSnapshot?: string | null;
  wearerName?: string;
  savePrescriptionToProfile?: boolean;
  addedAt: number;
}

interface CartPrivateFields {
  prescription?: CartItem["prescription"];
  tryOnSnapshot?: string | null;
  wearerName?: string;
  savePrescriptionToProfile?: boolean;
}

interface CartPrivateBundle {
  ownerKey: string | null;
  expiresAt: number;
  byItemId: Record<string, CartPrivateFields>;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "id" | "addedAt">) => CartItem;
  removeItem: (id: string) => void;
  restoreItem: (item: CartItem, index?: number) => void;
  updateItem: (id: string, patch: Partial<CartItem>) => void;
  linkOrderToCartItem: (orderNumber: string, cartItemId: string) => void;
  completeOrderCartCleanup: (orderNumber?: string, explicitCartItemId?: string) => void;
  clearPrivateData: () => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function stripPrivateFields(item: CartItem): Omit<
  CartItem,
  "prescription" | "tryOnSnapshot" | "wearerName" | "savePrescriptionToProfile"
> {
  const {
    prescription: _rx,
    tryOnSnapshot: _snap,
    wearerName: _wearer,
    savePrescriptionToProfile: _saveRx,
    ...publicFields
  } = item;
  return publicFields;
}

function loadPrivateBundle(): Record<string, CartPrivateFields> {
  try {
    const raw = sessionStorage.getItem(CART_PRIVATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<CartPrivateBundle>;
    if (!parsed || typeof parsed !== "object" || !parsed.byItemId) {
      sessionStorage.removeItem(CART_PRIVATE_STORAGE_KEY);
      return {};
    }
    if (typeof parsed.expiresAt === "number" && Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(CART_PRIVATE_STORAGE_KEY);
      return {};
    }
    const activeOwner = getStoredAccountOwner();
    if (parsed.ownerKey && activeOwner && parsed.ownerKey !== activeOwner) {
      sessionStorage.removeItem(CART_PRIVATE_STORAGE_KEY);
      return {};
    }
    return parsed.byItemId;
  } catch {
    return {};
  }
}

function loadCart(): CartItem[] {
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY) ?? localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const privateById = loadPrivateBundle();
    return parsed.map((entry: CartItem) => {
      const priv = entry?.id ? privateById[entry.id] : undefined;
      if (!priv) return entry;
      return {
        ...entry,
        prescription: priv.prescription ?? entry.prescription,
        tryOnSnapshot: priv.tryOnSnapshot !== undefined ? priv.tryOnSnapshot : entry.tryOnSnapshot,
        wearerName: priv.wearerName ?? entry.wearerName,
        savePrescriptionToProfile:
          priv.savePrescriptionToProfile !== undefined
            ? priv.savePrescriptionToProfile
            : entry.savePrescriptionToProfile,
      };
    });
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  try {
    // P0-09: NEVER write prescriptions, wearer names, or biometric try-on snapshots into shared localStorage.
    const publicItems = items.map(stripPrivateFields);
    const serializedPublic = JSON.stringify(publicItems);
    localStorage.setItem(CART_STORAGE_KEY, serializedPublic);
    sessionStorage.setItem(CART_STORAGE_KEY, serializedPublic);

    const byItemId: Record<string, CartPrivateFields> = {};
    let hasPrivate = false;
    for (const item of items) {
      if (
        item.prescription !== undefined ||
        item.tryOnSnapshot ||
        item.wearerName !== undefined ||
        item.savePrescriptionToProfile !== undefined
      ) {
        hasPrivate = true;
        byItemId[item.id] = {
          prescription: item.prescription,
          tryOnSnapshot: item.tryOnSnapshot ?? null,
          wearerName: item.wearerName,
          savePrescriptionToProfile: item.savePrescriptionToProfile,
        };
      }
    }
    if (hasPrivate) {
      const bundle: CartPrivateBundle = {
        ownerKey: getStoredAccountOwner(),
        expiresAt: Date.now() + PRIVATE_DRAFT_TTL_MS,
        byItemId,
      };
      sessionStorage.setItem(CART_PRIVATE_STORAGE_KEY, JSON.stringify(bundle));
    } else {
      sessionStorage.removeItem(CART_PRIVATE_STORAGE_KEY);
    }
  } catch {
    // quota / private mode — session only fallback
  }
}

function loadOrderCartMap(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(ORDER_CART_MAP_KEY) ?? localStorage.getItem(ORDER_CART_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveOrderCartMap(map: Record<string, string>) {
  try {
    const serialized = JSON.stringify(map);
    sessionStorage.setItem(ORDER_CART_MAP_KEY, serialized);
  } catch {
    /* ignore */
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart());

  useEffect(() => {
    saveCart(items);
  }, [items]);

  // P0-09: Isolate cart & sensitive drafts whenever a user signs out, session expires (401),
  // switches accounts, or another browser tab signs out / switches accounts.
  useEffect(() => {
    function handleWipe() {
      setItems([]);
    }
    function handleOwnerSynced() {
      setItems((prev) => [...prev]);
    }
    function handleCrossTabStorage(event: StorageEvent) {
      if (event.key === ACTIVE_ACCOUNT_OWNER_KEY && event.oldValue !== event.newValue) {
        try {
          sessionStorage.removeItem(CART_PRIVATE_STORAGE_KEY);
          sessionStorage.removeItem(CHECKOUT_STATE_KEY);
          sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_KEY);
          sessionStorage.removeItem(TRYON_SNAPSHOT_KEY);
          sessionStorage.removeItem(CART_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setItems([]);
      }
      if (event.key === "klarheit_auth_token" && event.oldValue && !event.newValue) {
        try {
          sessionStorage.removeItem(CART_PRIVATE_STORAGE_KEY);
          sessionStorage.removeItem(CHECKOUT_STATE_KEY);
          sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_KEY);
          sessionStorage.removeItem(TRYON_SNAPSHOT_KEY);
        } catch {
          /* ignore */
        }
        setItems([]);
      }
    }

    window.addEventListener("klarheit:logout", handleWipe);
    window.addEventListener("klarheit:session-expired", handleWipe);
    window.addEventListener("klarheit:account-switched", handleWipe);
    window.addEventListener("klarheit:account-owner-synced", handleOwnerSynced);
    window.addEventListener("storage", handleCrossTabStorage);
    return () => {
      window.removeEventListener("klarheit:logout", handleWipe);
      window.removeEventListener("klarheit:session-expired", handleWipe);
      window.removeEventListener("klarheit:account-switched", handleWipe);
      window.removeEventListener("klarheit:account-owner-synced", handleOwnerSynced);
      window.removeEventListener("storage", handleCrossTabStorage);
    };
  }, []);

  const lastAddRef = useRef<{ signature: string; item: CartItem; at: number } | null>(null);

  const addItem = useCallback((item: Omit<CartItem, "id" | "addedAt">): CartItem => {
    const now = Date.now();
    const signature = JSON.stringify({
      productId: item.productId,
      skuId: item.skuId ?? null,
      finishId: item.finishId ?? null,
      sizeSpec: item.sizeSpec ?? null,
      lensOptionTypes: [...item.lensOptionTypes].sort(),
      hasRx: Boolean(item.prescription),
    });

    // Guard against accidental rapid double-taps within 600ms
    if (
      lastAddRef.current &&
      lastAddRef.current.signature === signature &&
      now - lastAddRef.current.at < 600
    ) {
      return lastAddRef.current.item;
    }

    const id = `${item.productId}-${item.finishId ?? "default"}-${now}-${Math.random().toString(36).slice(2, 6)}`;
    const created: CartItem = { ...item, id, addedAt: now };
    lastAddRef.current = { signature, item: created, at: now };

    setItems((prev) => [...prev, created]);
    track("cart_item_added", {
      product_id: String(item.productId),
      product_name: item.productName,
      lens_count: item.lensOptionTypes.length,
    });
    return created;
  }, []);

  const removeItem = useCallback((id: string) => {
    if (lastAddRef.current?.item.id === id) {
      lastAddRef.current = null;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    track("cart_item_removed", { item_id: id });
  }, []);

  const restoreItem = useCallback((item: CartItem, index?: number) => {
    setItems((prev) => {
      if (prev.some((existing) => existing.id === item.id)) return prev;
      const next = [...prev];
      const safeIndex =
        typeof index === "number" && index >= 0 && index <= next.length ? index : next.length;
      next.splice(safeIndex, 0, item);
      return next;
    });
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<CartItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const linkOrderToCartItem = useCallback((orderNumber: string, cartItemId: string) => {
    if (!orderNumber || !cartItemId) return;
    const current = loadOrderCartMap();
    current[orderNumber] = cartItemId;
    saveOrderCartMap(current);
    try {
      const savedCheckout = sessionStorage.getItem("klarheit_checkout_state");
      if (savedCheckout) {
        const parsed = JSON.parse(savedCheckout) as Record<string, unknown>;
        if (parsed && parsed.cartItemId === cartItemId) {
          parsed.orderNumber = orderNumber;
          sessionStorage.setItem("klarheit_checkout_state", JSON.stringify(parsed));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const completeOrderCartCleanup = useCallback((orderNumber?: string, explicitCartItemId?: string) => {
    const map = loadOrderCartMap();
    const mappedId = orderNumber ? map[orderNumber] : undefined;
    const targetCartItemId = explicitCartItemId || mappedId;

    // Only remove a cart item that is explicitly bound to this order or explicitly provided.
    // Never fall back to an unbound checkout draft when viewing historical orders.
    if (!targetCartItemId) {
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== targetCartItemId));

    if (orderNumber && map[orderNumber]) {
      delete map[orderNumber];
      saveOrderCartMap(map);
    }

    try {
      const savedCheckout = sessionStorage.getItem("klarheit_checkout_state");
      if (savedCheckout) {
        const parsed = JSON.parse(savedCheckout) as { cartItemId?: string; orderNumber?: string };
        const draftOrderMatches = Boolean(orderNumber && parsed?.orderNumber && parsed.orderNumber === orderNumber);
        const draftItemMatches = Boolean(
          parsed?.cartItemId &&
          parsed.cartItemId === targetCartItemId &&
          (!parsed.orderNumber || !orderNumber || parsed.orderNumber === orderNumber)
        );
        if (draftOrderMatches || draftItemMatches) {
          sessionStorage.removeItem("klarheit_checkout_state");
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const clearPrivateData = useCallback(() => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        prescription: undefined,
        tryOnSnapshot: null,
        wearerName: undefined,
        savePrescriptionToProfile: undefined,
      }))
    );
    try {
      sessionStorage.removeItem(CART_PRIVATE_STORAGE_KEY);
      sessionStorage.removeItem(TRYON_SNAPSHOT_KEY);
      sessionStorage.removeItem(CHECKOUT_STATE_KEY);
      sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_KEY);
      localStorage.removeItem(TRYON_SNAPSHOT_KEY);
      localStorage.removeItem(CHECKOUT_STATE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    try {
      sessionStorage.removeItem(CART_PRIVATE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    track("cart_cleared", {});
  }, []);

  const value = useMemo(() => {
    const count = items.length;
    const subtotal = items.reduce((sum, i) => sum + i.basePrice + i.lensPrice, 0);
    return {
      items,
      count,
      subtotal,
      addItem,
      removeItem,
      restoreItem,
      updateItem,
      linkOrderToCartItem,
      completeOrderCartCleanup,
      clearPrivateData,
      clear,
    };
  }, [items, addItem, removeItem, restoreItem, updateItem, linkOrderToCartItem, completeOrderCartCleanup, clearPrivateData, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function cartItemFromProduct(product: Product, extras?: Partial<CartItem>): Omit<CartItem, "id" | "addedAt"> {
  return {
    productId: product.id,
    productName: product.name,
    productImageUrl: product.imageUrl,
    basePrice: product.basePrice,
    lensOptionTypes: extras?.lensOptionTypes ?? [],
    lensPrice: extras?.lensPrice ?? 0,
    finishId: extras?.finishId,
    sizeSpec: extras?.sizeSpec ?? product.specsSize,
    skuId: extras?.skuId,
    prescription: extras?.prescription,
    tryOnSnapshot: extras?.tryOnSnapshot ?? null,
    wearerName: extras?.wearerName,
    savePrescriptionToProfile: extras?.savePrescriptionToProfile,
  };
}
