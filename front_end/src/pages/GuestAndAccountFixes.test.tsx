import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import i18n, { resolveInitialLocale, syncDocumentLang } from "../i18n";
import { AuthProvider } from "../auth/AuthProvider";
import { CartProvider, useCart } from "../hooks/useCart";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { CollectionsPage } from "./CollectionsPage";
import { ProductDetailsPage } from "./ProductDetailsPage";
import { MyAccountPage } from "./MyAccountPage";
import { MyOrdersPage } from "./MyOrdersPage";
import { ACTIVE_ACCOUNT_OWNER_KEY, CART_STORAGE_KEY } from "../lib/privacy";
import * as api from "../services/api";
import type { Product } from "../services/api";

vi.mock("../services/analytics", () => ({
  track: vi.fn(),
  setUserContext: vi.fn(),
  normalizeRoutePath: (p: string) => p,
}));

vi.mock("../ar/FrameShowcase", () => ({
  FrameShowcase: () => <div data-testid="frame-showcase" />,
}));

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location-probe">{`${loc.pathname}${loc.search}`}</div>;
}

function CartCountProbe() {
  const { count, items } = useCart();
  return (
    <div data-testid="cart-count-probe">
      {count}:{items.map((i) => i.productName).join(",")}
    </div>
  );
}

describe("Guest experience & My Orders split regression tests", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    await i18n.changeLanguage("zh");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("bootstrap /auth/me 401 does NOT clear a fresh guest cart, while expired authenticated session DOES wipe cart", async () => {
    const guestCart = [
      {
        id: "guest-item-1",
        productId: 6,
        productName: "MONOLITH 02",
        productImageUrl: "/images/monolith_02.png",
        basePrice: 620,
        lensOptionTypes: [],
        lensPrice: 0,
        addedAt: Date.now(),
      },
    ];
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(guestCart));

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    );

    const { unmount } = render(
      <MemoryRouter initialEntries={["/cart"]}>
        <AuthProvider>
          <CartProvider>
            <CartCountProbe />
          </CartProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    // Wait a tick for effects to settle
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByTestId("cart-count-probe")).toHaveTextContent("1:MONOLITH 02");
    unmount();

    // Now simulate an expired previously-signed-in account (owner key present)
    localStorage.setItem(ACTIVE_ACCOUNT_OWNER_KEY, "user@example.com");
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(guestCart));
    render(
      <MemoryRouter initialEntries={["/cart"]}>
        <AuthProvider>
          <CartProvider>
            <CartCountProbe />
          </CartProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("cart-count-probe")).toHaveTextContent("0:");
    });
  });

  test("ProductDetailsPage distinguishes all-finishes-sold-out from partial-stock", async () => {
    const allSoldOutProduct: Product = {
      id: 5,
      name: "AERO X1",
      nameEn: "AERO X1",
      nameZh: "AERO X1",
      material: "Grade 5 Titanium",
      materialEn: "Grade 5 Titanium",
      materialZh: "5级钛金属",
      basePrice: 850,
      imageUrl: "/images/aero_x1.png",
      shape: "RECTANGLE",
      specsSize: "54-17-140",
      detailImages: null,
      inStock: false,
      salesStatus: "AVAILABLE",
      arConfigs: [
        { id: "titanium", finishLabelKey: "color.titanium", frameColor: "#9aa1aa", lensColor: "#dce8f2", lensLabel: "Clear" },
        { id: "rose-gold", finishLabelKey: "color.roseGold", frameColor: "#c4a090", lensColor: "#f0e6dc", lensLabel: "HEV" },
      ] as Product["arConfigs"],
      skus: [
        { id: 1, productId: 5, finishId: "titanium", sizeSpec: "54-17-140", inStock: false, salesStatus: "PAUSED", restockEta: null },
        { id: 2, productId: 5, finishId: "rose-gold", sizeSpec: "54-17-140", inStock: false, salesStatus: "PAUSED", restockEta: null },
      ],
    };

    const fetchByIdSpy = vi.spyOn(api, "fetchProductById").mockResolvedValue(allSoldOutProduct);

    const { unmount } = render(
      <MemoryRouter initialEntries={["/product/5"]}>
        <CartProvider>
          <Routes>
            <Route path="/product/:id" element={<ProductDetailsPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("该款所有配色暂时缺货");
    expect(alert).not.toHaveTextContent("其他色款仍可正常选购");
    expect(alert.querySelector('a[href="/collections"]')).not.toBeNull();
    unmount();

    // Now partial stock: titanium out of stock, rose-gold available
    fetchByIdSpy.mockResolvedValue({
      ...allSoldOutProduct,
      inStock: true,
      skus: [
        { id: 1, productId: 5, finishId: "titanium", sizeSpec: "54-17-140", inStock: false, salesStatus: "OUT_OF_STOCK", restockEta: null },
        { id: 2, productId: 5, finishId: "rose-gold", sizeSpec: "54-17-140", inStock: true, salesStatus: "AVAILABLE", restockEta: null },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/product/5"]}>
        <CartProvider>
          <Routes>
            <Route path="/product/:id" element={<ProductDetailsPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );

    const partialAlert = await screen.findByRole("alert");
    expect(partialAlert).toHaveTextContent("其他色款仍可正常选购");
  });

  test("CollectionsPage validates inverted min/max price and pauses query until fixed", async () => {
    const mockFetch = vi.spyOn(api, "fetchProductsFiltered").mockResolvedValue([
      {
        id: 1,
        name: "SOLARIS A1",
        nameEn: "SOLARIS A1",
        nameZh: "SOLARIS A1 香槟金飞行员",
        material: "Grade 5 Titanium",
        materialEn: "Grade 5 Titanium",
        materialZh: "5级钛金属",
        basePrice: 890,
        imageUrl: "/images/solaris_a1.jpg",
        shape: "AVIATOR",
        specsSize: "56-16-145",
        detailImages: null,
        inStock: true,
        salesStatus: "AVAILABLE",
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/collections"]}>
        <CollectionsPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "SOLARIS A1 香槟金飞行员" });
    const initialCalls = mockFetch.mock.calls.length;

    const minInput = screen.getByPlaceholderText("最低");
    const maxInput = screen.getByPlaceholderText("最高");
    fireEvent.change(minInput, { target: { value: "900" } });
    fireEvent.change(maxInput, { target: { value: "600" } });

    expect(screen.getByRole("alert")).toHaveTextContent("最低价不能高于最高价");
    await new Promise((r) => setTimeout(r, 300));
    expect(mockFetch.mock.calls.length).toBe(initialCalls);

    // Fix max to 950 -> alert clears and query resumes
    fireEvent.change(maxInput, { target: { value: "950" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  test("Footer policy modal focuses close button, traps Tab, closes on Escape, and restores trigger focus", async () => {
    render(<Footer />);
    const triggerBtn = screen.getByRole("button", { name: "客服与服务规则" });
    triggerBtn.focus();
    fireEvent.click(triggerBtn);

    const dialog = screen.getByRole("dialog");
    const closeBtn = screen.getByRole("button", { name: "关闭" });
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab wraps inside dialog instead of escaping to background buttons
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Escape closes modal and restores focus to trigger button
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.activeElement).toBe(triggerBtn);
    });
  });

  test("Navbar unmounts mobile menu when closed and restores focus to menu button on Escape", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    );

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <CartProvider>
            <Navbar />
          </CartProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(document.getElementById("mobile-navigation")).toBeNull();

    const menuBtn = screen.getByTitle("菜单");
    fireEvent.click(menuBtn);
    expect(document.getElementById("mobile-navigation")).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.getElementById("mobile-navigation")).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(menuBtn);
    });
  });

  test("MyAccountPage redirects legacy payment return params to /my-orders and MyOrdersPage shows return banner", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue({
      id: 1,
      email: "user@example.com",
      firstName: "Lin",
      lastName: "Wei",
      phone: null,
      phoneVerified: false,
      role: "USER",
    });
    vi.spyOn(api, "fetchMyOrders").mockResolvedValue([
      {
        orderNumber: "ORD-2026-001",
        status: "PAID",
        totalAmount: 890,
        productName: "SOLARIS A1",
        lensOptionTypes: ["AR_ONYX"],
        createdAt: "2026-11-23T08:00:00Z",
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/my-account?out_trade_no=ORD-2026-001"]}>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/my-account" element={<MyAccountPage />} />
              <Route path="/my-orders" element={<MyOrdersPage />} />
            </Routes>
            <LocationProbe />
          </CartProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("location-probe")).toHaveTextContent("/my-orders?out_trade_no=ORD-2026-001");
    });
    expect(await screen.findByText(/已从支付通道返回：订单 ORD-2026-001/)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "SOLARIS A1" })).toBeInTheDocument();
  });

  test("i18n syncs document.documentElement.lang and resolves saved preference over browser locale", async () => {
    await i18n.changeLanguage("en");
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("klarheit-locale")).toBe("en");
    expect(resolveInitialLocale()).toBe("en");

    await i18n.changeLanguage("zh");
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(localStorage.getItem("klarheit-locale")).toBe("zh");
    expect(resolveInitialLocale()).toBe("zh");

    syncDocumentLang("en");
    expect(document.documentElement.lang).toBe("en");
  });
});
