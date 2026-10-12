import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "../services/api";
import { track } from "../services/analytics";

export interface CartItem {
  id: string;
  productId: number;
  productName: string;
  productImageUrl: string;
  basePrice: number;
  finishId?: string;
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
  addedAt: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "id" | "addedAt">) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<CartItem>) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "klarheit_cart_v1";

function loadCart(): CartItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  try {
    // Persist across sessions for returning shoppers
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota / private mode — session only fallback
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart());

  useEffect(() => {
    saveCart(items);
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, "id" | "addedAt">) => {
    const id = `${item.productId}-${item.finishId ?? "default"}-${Date.now()}`;
    setItems((prev) => [...prev, { ...item, id, addedAt: Date.now() }]);
    track("cart_item_added", {
      product_id: String(item.productId),
      product_name: item.productName,
      lens_count: item.lensOptionTypes.length,
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    track("cart_item_removed", { item_id: id });
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<CartItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    track("cart_cleared", {});
  }, []);

  const value = useMemo(() => {
    const count = items.length;
    const subtotal = items.reduce((sum, i) => sum + i.basePrice + i.lensPrice, 0);
    return { items, count, subtotal, addItem, removeItem, updateItem, clear };
  }, [items, addItem, removeItem, updateItem, clear]);

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
    prescription: extras?.prescription,
    tryOnSnapshot: extras?.tryOnSnapshot ?? null,
  };
}
