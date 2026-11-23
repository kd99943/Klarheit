import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAuth } from "../auth/AuthProvider";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { Navbar } from "../components/layout/Navbar";
import { CartProvider } from "../hooks/useCart";
import { checkoutOrder, fetchAddresses, fetchCheckoutSystemStatus } from "../services/api";
import i18n from "../i18n";
import { Checkout } from "./Checkout";
import { CartPage } from "./CartPage";

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("../services/analytics", () => ({ track: vi.fn() }));
vi.mock("../services/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../services/api")>(),
  fetchAddresses: vi.fn().mockResolvedValue([]),
  fetchCheckoutSystemStatus: vi.fn().mockResolvedValue({ checkoutEnabled: true, pauseReason: "" }),
  checkoutOrder: vi.fn(),
}));
vi.mock("../hooks/useProducts", () => ({
  useProducts: () => ({
    products: [{ id: 1, name: "Catalog frame", nameEn: "Catalog frame", basePrice: 850 }],
    isLoading: false,
    error: null,
  }),
}));
vi.mock("../hooks/useLensOptions", () => ({
  useLensOptions: () => ({ options: [], isLoading: false, error: null }),
}));

const requireAuth = vi.fn().mockReturnValue(false);
const draft = {
  product: { id: 2, name: "Selected frame", nameEn: "Selected frame", basePrice: 900 },
  prescription: { sphOd: -2, sphOs: -1, cylOd: 0, cylOs: 0, axisOd: 0, axisOs: 0, pd: 63 },
  lensOptionTypes: ["AR_ONYX"],
  cartItemId: "cart-item-2",
};

function setAuth(authenticated: boolean, ready = true) {
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated: authenticated,
    isAuthReady: ready,
    user: authenticated ? { firstName: "Test", lastName: "User", email: "test@example.com" } : null,
    requireAuth,
    openAuthModal: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

function renderCheckout(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/checkout", state }]}>
      <CartProvider>
        <ProtectedRoute message="Please sign in to checkout">
          <Checkout />
        </ProtectedRoute>
      </CartProvider>
    </MemoryRouter>,
  );
}

describe("checkout access and selection", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    await i18n.changeLanguage("en");
    setAuth(false);
  });
  afterEach(cleanup);

  test("guests must sign in before seeing checkout, preserving their selected item", () => {
    renderCheckout(draft);
    expect(requireAuth).toHaveBeenCalledWith({ path: "/checkout", state: draft }, "Please sign in to checkout");
    expect(screen.queryByRole("button", { name: i18n.t("manifest.authorizePayment", { ns: "checkout" }) })).not.toBeInTheDocument();
    expect(checkoutOrder).not.toHaveBeenCalled();
  });

  test("the sign-in prompt can be reopened after dismissing it", () => {
    renderCheckout(draft);
    requireAuth.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(requireAuth).toHaveBeenCalledWith({ path: "/checkout", state: draft }, "Please sign in to checkout");
  });

  test("session restoration does not reveal checkout or open a premature login prompt", () => {
    setAuth(false, false);
    renderCheckout(draft);
    expect(requireAuth).not.toHaveBeenCalled();
    expect(screen.queryByText("Selected frame")).not.toBeInTheDocument();
    expect(checkoutOrder).not.toHaveBeenCalled();
  });

  test("opening checkout without a selection never invents an order from the catalog", () => {
    setAuth(true);
    renderCheckout();
    expect(screen.queryByText("Catalog frame")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: i18n.t("manifest.authorizePayment", { ns: "checkout" }) })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: i18n.t("manifest.collectionLink", { ns: "checkout" }) })).toHaveAttribute("href", "/collections");
    expect(checkoutOrder).not.toHaveBeenCalled();
  });

  test("signed-in customers can continue with their explicit selection", () => {
    setAuth(true);
    renderCheckout(draft);
    expect(screen.getByText("Selected frame")).toBeInTheDocument();
    expect(screen.getByDisplayValue("63")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: i18n.t("manifest.authorizePayment", { ns: "checkout" }) })).toBeEnabled();
    expect(checkoutOrder).not.toHaveBeenCalled();
  });

  test("refreshing checkout restores the selected item", () => {
    setAuth(true);
    sessionStorage.setItem("klarheit_checkout_state", JSON.stringify(draft));
    renderCheckout();
    expect(screen.getByText("Selected frame")).toBeInTheDocument();
    expect(screen.queryByText("Catalog frame")).not.toBeInTheDocument();
  });

  test("the navigation identifies the cart count as shopping cart items", () => {
    localStorage.setItem("klarheit_cart_v1", JSON.stringify([{ id: "cart-item-2", basePrice: 900, lensPrice: 60 }]));
    render(<MemoryRouter><CartProvider><Navbar /></CartProvider></MemoryRouter>);
    expect(screen.getByRole("button", { name: /Cart.*1/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Checkout.*1/ })).not.toBeInTheDocument();
  });

  test("a guest checking out a cart item is prompted to log in with their configuration preserved", () => {
    localStorage.setItem("klarheit_cart_v1", JSON.stringify([{
      id: draft.cartItemId,
      productId: draft.product.id,
      productName: draft.product.name,
      basePrice: 900,
      lensPrice: 60,
      prescription: draft.prescription,
      lensOptionTypes: draft.lensOptionTypes,
    }]));
    render(<MemoryRouter initialEntries={["/cart"]}><CartProvider><CartPage /></CartProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Checkout selected" }));
    expect(requireAuth).toHaveBeenCalledWith({
      path: "/checkout",
      state: expect.objectContaining({
        cartItemId: draft.cartItemId,
        product: expect.objectContaining({ id: draft.product.id }),
        prescription: draft.prescription,
        lensOptionTypes: draft.lensOptionTypes,
      }),
    });
    expect(checkoutOrder).not.toHaveBeenCalled();
  });

  test("checkout kill switch displays pause banner and disables submission", async () => {
    setAuth(true);
    vi.mocked(fetchCheckoutSystemStatus).mockResolvedValueOnce({
      checkoutEnabled: false,
      pauseReason: "Maintenance window",
    });
    renderCheckout(draft);
    await waitFor(() => {
      expect(screen.getByText("Maintenance window")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: i18n.t("manifest.authorizePayment", { ns: "checkout" }) })).toBeDisabled();
  });

  test("late async saved addresses do not overwrite user-typed shipping address", async () => {
    setAuth(true);
    let resolveAddrs: (v: unknown[]) => void = () => {};
    vi.mocked(fetchAddresses).mockImplementationOnce(
      () => new Promise((res) => { resolveAddrs = res as (v: unknown[]) => void; }) as ReturnType<typeof fetchAddresses>,
    );
    renderCheckout(draft);

    const addressInput = document.querySelector('input[name="shippingAddress"]') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: "Shanghai Pudong Custom St 88" } });

    resolveAddrs([
      {
        id: 1,
        recipientName: "Default User",
        phoneNumber: "13900001111",
        province: "Guangdong",
        city: "Shenzhen",
        district: "Nanshan",
        detailAddress: "Old Default Rd 1",
        isDefault: true,
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText(/Default User/)).toBeInTheDocument();
    });
    expect(addressInput.value).toBe("Shanghai Pudong Custom St 88");
  });

  test("navbar My Account and My Orders buttons navigate to distinct destinations", () => {
    setAuth(true);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <CartProvider>
          <Navbar />
          <Routes>
            <Route path="/" element={<div>Home</div>} />
            <Route path="/my-account" element={<div>Account Overview Destination</div>} />
            <Route path="/my-orders" element={<div>Orders List Destination</div>} />
            <Route path="/checkout" element={<div>Checkout Destination</div>} />
          </Routes>
        </CartProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle("Open account"));
    fireEvent.click(screen.getByRole("button", { name: /My Orders/i }));
    expect(screen.getByText("Orders List Destination")).toBeInTheDocument();
    expect(screen.queryByText("Account Overview Destination")).not.toBeInTheDocument();
    expect(screen.queryByText("Checkout Destination")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Open account"));
    fireEvent.click(screen.getByRole("button", { name: /My Account/i }));
    expect(screen.getByText("Account Overview Destination")).toBeInTheDocument();
    expect(screen.queryByText("Orders List Destination")).not.toBeInTheDocument();
  });
});
