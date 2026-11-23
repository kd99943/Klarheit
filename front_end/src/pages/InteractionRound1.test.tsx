import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import i18n from "../i18n";
import { CartProvider } from "../hooks/useCart";
import { fetchProductById, fetchProductsFiltered, type Product } from "../services/api";
import { persistProductSelection, readSavedFinishForProduct } from "../lib/selection";
import { ProductDetailsPage } from "./ProductDetailsPage";
import { CollectionsPage } from "./CollectionsPage";

vi.mock("../services/analytics", () => ({ track: vi.fn() }));
vi.mock("../ar/FrameShowcase", () => ({
  FrameShowcase: ({ frame }: { frame: { productName: string; id: string } }) => (
    <div data-testid="frame-showcase">{`${frame.productName}:${frame.id}`}</div>
  ),
}));
vi.mock("../services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/api")>()),
  fetchProductById: vi.fn(),
  fetchProductsFiltered: vi.fn(),
}));

const PRODUCT_A: Product = {
  id: 1,
  name: "AERO X1",
  nameEn: "AERO X1",
  nameZh: "AERO X1",
  material: "Grade 5 Titanium",
  materialEn: "Grade 5 Titanium",
  materialZh: "5级钛金属",
  basePrice: 850,
  imageUrl: "/images/aero_x1.png",
  shape: "ROUND",
  specsSize: "54-17-140",
  detailImages: "/images/aero_side.png",
  stockQuantity: 20,
  salesStatus: "AVAILABLE",
  arConfigs: [
    { id: "titanium", finishLabelKey: "color.titanium", frameColor: "#9aa1aa", lensColor: "#dce8f2", lensLabel: "Neutral Clear" },
    { id: "rose-gold", finishLabelKey: "color.roseGold", frameColor: "#c4a090", lensColor: "#f0e6dc", lensLabel: "Warm HEV" },
  ] as Product["arConfigs"],
};

const PRODUCT_B: Product = {
  ...PRODUCT_A,
  id: 2,
  name: "ORBIT T-4",
  nameEn: "ORBIT T-4",
  nameZh: "ORBIT T-4",
  basePrice: 920,
  arConfigs: [
    { id: "titanium", finishLabelKey: "color.titanium", frameColor: "#b7b8b4", lensColor: "#eef3f6", lensLabel: "Neutral Clear" },
    { id: "matte-black", finishLabelKey: "color.matteBlack", frameColor: "#141416", lensColor: "#e8f4f6", lensLabel: "Onyx AR" },
  ] as Product["arConfigs"],
};

describe("Round 1 interactions: ProductDetails, in-place cart undo & Collections recovery", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    await i18n.changeLanguage("en");
  });

  afterEach(cleanup);

  test("switching color updates visual feedback, marks schematic photo, switches to 3D preview, and never leaks across products", async () => {
    vi.mocked(fetchProductById).mockResolvedValue(PRODUCT_A);

    render(
      <MemoryRouter initialEntries={["/product/1"]}>
        <CartProvider>
          <Routes>
            <Route path="/product/:id" element={<ProductDetailsPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "AERO X1" })).toBeInTheDocument();
    // Multi-angle photo tabs rendered from detailImages
    expect(screen.getByRole("button", { name: "Front" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Side" })).toBeInTheDocument();

    // Switch to Rose Gold (non-default photo finish)
    fireEvent.click(screen.getByRole("button", { name: "Rose Gold" }));
    expect(screen.getByText("Style Illustration")).toBeInTheDocument();
    expect(screen.getByText(/No dedicated photo for Rose Gold yet/i)).toBeInTheDocument();

    // Open 3D preview for Rose Gold
    fireEvent.click(screen.getByRole("button", { name: /View Rose Gold 3D Preview/i }));
    expect(await screen.findByTestId("frame-showcase")).toHaveTextContent("AERO X1:rose-gold");

    // Verify Product A's finish does NOT contaminate Product B
    persistProductSelection(PRODUCT_B.id, "matte-black");
    expect(readSavedFinishForProduct(PRODUCT_A.id)).toBe("rose-gold");
    expect(readSavedFinishForProduct(PRODUCT_B.id)).toBe("matte-black");
  });

  test("invalid finish query shows alert and requires user to pick a valid finish before adding to cart", async () => {
    vi.mocked(fetchProductById).mockResolvedValue(PRODUCT_A);

    render(
      <MemoryRouter initialEntries={["/product/1?finish=deleted-gold"]}>
        <CartProvider>
          <Routes>
            <Route path="/product/:id" element={<ProductDetailsPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/no longer available|currently unavailable/i);
    expect(screen.getByRole("button", { name: /Add Frame to Cart/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Titanium" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Frame to Cart/i })).toBeEnabled();
  });

  test("add to cart stays on ProductDetailsPage, guards rapid double-taps, and Undo removes only the newly added item", async () => {
    vi.mocked(fetchProductById).mockResolvedValue(PRODUCT_A);
    localStorage.setItem(
      "klarheit_cart_v1",
      JSON.stringify([
        {
          id: "existing-item-1",
          productId: 2,
          productName: "ORBIT T-4",
          productImageUrl: "/images/orbit.png",
          basePrice: 920,
          lensOptionTypes: ["STANDARD_156"],
          lensPrice: 0,
          addedAt: 1000,
        },
      ])
    );

    render(
      <MemoryRouter initialEntries={["/product/1"]}>
        <CartProvider>
          <Routes>
            <Route path="/product/:id" element={<ProductDetailsPage />} />
            <Route path="/cart" element={<div>Cart Page</div>} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );

    const addBtn = await screen.findByRole("button", { name: /Add Frame to Cart/i });
    fireEvent.click(addBtn);
    fireEvent.click(addBtn); // Rapid double-tap should dedupe

    expect(screen.queryByText("Cart Page")).not.toBeInTheDocument();
    expect(screen.getByText(/Added AERO X1 · Titanium/i)).toBeInTheDocument();
    expect(screen.getByText("Lenses pending")).toBeInTheDocument();

    const storedAfterAdd = JSON.parse(localStorage.getItem("klarheit_cart_v1") || "[]");
    expect(storedAfterAdd).toHaveLength(2);

    // Undo removes strictly the newly added item, keeping existing-item-1
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Removed from cart")).toBeInTheDocument();

    const storedAfterUndo = JSON.parse(localStorage.getItem("klarheit_cart_v1") || "[]");
    expect(storedAfterUndo).toHaveLength(1);
    expect(storedAfterUndo[0].id).toBe("existing-item-1");
  });

  test("CollectionsPage restores filters from URL, shows removable chips, and offers Remove one filter when empty", async () => {
    vi.mocked(fetchProductsFiltered).mockResolvedValueOnce([]).mockResolvedValue([PRODUCT_A]);

    render(
      <MemoryRouter initialEntries={["/collections?shape=ROUND&material=Grade+5+Titanium"]}>
        <CartProvider>
          <Routes>
            <Route path="/collections" element={<CollectionsPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: /Filters \(2\)/i })).toBeInTheDocument();
    expect(await screen.findByText(/No matching frames found/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove one filter" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Filters \(1\)/i })).toBeInTheDocument();
    });
    expect(await screen.findByRole("heading", { name: "AERO X1" })).toBeInTheDocument();
  });
});
