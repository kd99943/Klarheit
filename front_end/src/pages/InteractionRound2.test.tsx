import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import i18n from "../i18n";
import { CartProvider } from "../hooks/useCart";
import { useAuth } from "../auth/AuthProvider";
import {
  fetchOrderAfterSalesTickets,
  fetchOrderDetail,
  refreshOrderPaymentStatus,
  type OrderDetailResponse,
  type Product,
} from "../services/api";
import { FrameCompare } from "../ar/FrameCompare";
import { ConfigLab } from "./ConfigLab";
import { CartPage } from "./CartPage";
import { Checkout } from "./Checkout";
import { OrderConfirmationPage } from "./OrderConfirmationPage";
import { OrderDetailPage } from "./OrderDetailPage";

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("../services/analytics", () => ({ track: vi.fn() }));
vi.mock("../ar/FrameShowcase", () => ({
  FrameShowcase: ({ frame }: { frame: { productName: string; id: string } }) => (
    <div data-testid="frame-showcase">{`${frame.productName}:${frame.id}`}</div>
  ),
}));
const { MOCK_CONFIG_PRODUCTS, MOCK_LENS_OPTIONS, MOCK_LENS_RELOAD } = vi.hoisted(() => ({
  MOCK_CONFIG_PRODUCTS: [
    {
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
      detailImages: null,
      stockQuantity: 10,
      salesStatus: "AVAILABLE",
      arConfigs: [
        { id: "titanium", finishLabelKey: "color.titanium", frameColor: "#9aa1aa", lensColor: "#dce8f2", lensLabel: "Neutral Clear" },
      ],
    },
  ],
  MOCK_LENS_OPTIONS: [
    { id: 1, type: "STANDARD_156", category: "LENS", label: "1.56 Standard", description: "Included", indexValue: 1.56, additionalPrice: 0 },
    { id: 2, type: "THIN_161", category: "LENS", label: "1.61 Thin", description: "Thinner", indexValue: 1.61, additionalPrice: 100 },
    { id: 3, type: "AR_ONYX", category: "COATING", label: "Onyx AR", description: "Anti-reflective", indexValue: 0, additionalPrice: 60 },
  ],
  MOCK_LENS_RELOAD: vi.fn(),
}));

vi.mock("../hooks/useProducts", () => ({
  useProducts: () => ({
    products: MOCK_CONFIG_PRODUCTS,
    isLoading: false,
    error: null,
  }),
}));
vi.mock("../hooks/useLensOptions", () => ({
  useLensOptions: () => ({
    options: MOCK_LENS_OPTIONS,
    isLoading: false,
    error: null,
    reload: MOCK_LENS_RELOAD,
  }),
}));
vi.mock("../services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/api")>()),
  fetchOrderDetail: vi.fn(),
  refreshOrderPaymentStatus: vi.fn(),
  fetchOrderAfterSalesTickets: vi.fn(),
  fetchAddresses: vi.fn().mockResolvedValue([]),
  fetchCheckoutSystemStatus: vi.fn().mockResolvedValue({ checkoutEnabled: true, pauseReason: "" }),
}));

const COMPARE_PRODUCTS: Product[] = [
  {
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
    detailImages: null,
    arConfigs: [
      { id: "titanium", finishLabelKey: "color.titanium", frameColor: "#9aa1aa", lensColor: "#dce8f2", lensLabel: "Clear" },
    ] as Product["arConfigs"],
  },
  {
    id: 2,
    name: "ORBIT T-4",
    nameEn: "ORBIT T-4",
    nameZh: "ORBIT T-4",
    material: "Surgical Steel",
    materialEn: "Surgical Steel",
    materialZh: "外科手术钢",
    basePrice: 920,
    imageUrl: "/images/orbit_t4.png",
    shape: "ROUND",
    specsSize: "48-21-140",
    detailImages: null,
    arConfigs: [
      { id: "matte-black", finishLabelKey: "color.matteBlack", frameColor: "#141416", lensColor: "#e8f4f6", lensLabel: "Onyx" },
    ] as Product["arConfigs"],
  },
];

const BASE_ORDER_DETAIL: OrderDetailResponse = {
  orderNumber: "KL-20261122-0088",
  status: "PAID",
  totalAmount: 950,
  discountAmount: 0,
  appliedCouponCode: null,
  createdAt: "2026-11-22T09:00:00Z",
  paidAt: "2026-11-22T09:05:00Z",
  customerFirstName: "Lin",
  customerLastName: "Wei",
  customerEmail: "lin@example.com",
  customerPhone: "13800138000",
  shippingAddress: "Shanghai Pudong 88",
  paymentChannel: "ALIPAY",
  gatewayTransactionId: "ALI-998877",
  finishId: "titanium",
  productName: "AERO X1",
  productImageUrl: "/images/aero_x1.png",
  lensOptions: [{ type: "THIN_161", label: "1.61 Thin", additionalPrice: 100 }],
  prescription: { sphOd: -3.5, sphOs: -3.25, cylOd: 0, cylOs: 0, axisOd: 0, axisOs: 0, pd: 63 },
  carrier: null,
  trackingNumber: null,
  fulfillmentStatus: "PENDING_REVIEW",
};

describe("Round 2 interactions: Compare, ConfigLab, Cart Undo, Confirmation Unknown & OrderDetail Hero", () => {
  const requireAuth = vi.fn().mockReturnValue(true);

  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    await i18n.changeLanguage("en");
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAuthReady: true,
      user: { id: 1, firstName: "Lin", lastName: "Wei", email: "lin@example.com", phone: "13800138000", phoneVerified: true, role: "USER" },
      requireAuth,
      openAuthModal: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(cleanup);

  test("FrameCompare displays user-selected A/B specs and prices and toggles active view cleanly", () => {
    const onActiveSlotChange = vi.fn();
    const onConfigureActive = vi.fn();

    render(
      <FrameCompare
        products={COMPARE_PRODUCTS}
        slotA={{ productId: 1, finishId: "titanium" }}
        slotB={{ productId: 2, finishId: "matte-black" }}
        activeSlot="A"
        previewMedia="3d"
        onActiveSlotChange={onActiveSlotChange}
        onSlotAChange={vi.fn()}
        onSlotBChange={vi.fn()}
        onConfigureActive={onConfigureActive}
      />
    );

    expect(screen.getByTestId("frame-showcase")).toHaveTextContent("AERO X1:titanium");
    expect(screen.getByText("54-17-140")).toBeInTheDocument();
    expect(screen.getByText("48-21-140")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /View B · ORBIT T-4/i }));
    expect(onActiveSlotChange).toHaveBeenCalledWith("B");

    fireEvent.click(screen.getByRole("button", { name: /Configure Current Frame/i }));
    expect(onConfigureActive).toHaveBeenCalledTimes(1);
  });

  test("ConfigLab groups Rx by eye, highlights field sample on click, hides mobile bar on input focus, and reports lens price delta", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/config-lab", state: { productId: 1, finishId: "titanium" } }]}>
        <CartProvider>
          <ConfigLab />
        </CartProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Right Eye (OD)")).toBeInTheDocument();
    expect(screen.getByText("Left Eye (OS)")).toBeInTheDocument();
    expect(screen.getByTestId("config-mobile-bar")).toBeInTheDocument();

    // Open field sample highlight
    const sampleButtons = screen.getAllByRole("button", { name: "See example" });
    fireEvent.click(sampleButtons[0]);
    expect(screen.getByText("OD SPH -2.50")).toBeInTheDocument();

    // Fill Rx values (focusing input hides mobile sticky bar so virtual keyboard isn't obstructed)
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="number"]');
    fireEvent.focus(inputs[0]);
    expect(screen.queryByTestId("config-mobile-bar")).not.toBeInTheDocument();

    const values = ["-3.5", "0", "0", "-3.25", "0", "0", "63"];
    values.forEach((v, idx) => fireEvent.change(inputs[idx], { target: { value: v } }));
    fireEvent.blur(inputs[0]);
    expect(screen.getByTestId("config-mobile-bar")).toBeInTheDocument();

    // Advance to Step 2 and toggle 1.61 Thin (+¥100)
    fireEvent.click(screen.getAllByRole("button", { name: /Next Step/i })[0]);
    fireEvent.click(screen.getByRole("radio", { name: /1\.61/i }));
    expect(screen.getByText(/Updated \(\+.*100\.00\)/i)).toBeInTheDocument();
  });

  test("CartPage supports explicit radio selection, preserves wearer/save settings, and offers delete Undo", () => {
    localStorage.setItem(
      "klarheit_cart_v1",
      JSON.stringify([
        {
          id: "item-1",
          productId: 1,
          productName: "AERO X1",
          productImageUrl: "/images/aero_x1.png",
          basePrice: 850,
          finishId: "titanium",
          lensOptionTypes: ["STANDARD_156"],
          lensPrice: 0,
          wearerName: "Alex",
          savePrescriptionToProfile: true,
          addedAt: 1000,
        },
        {
          id: "item-2",
          productId: 2,
          productName: "ORBIT T-4",
          productImageUrl: "/images/orbit_t4.png",
          basePrice: 920,
          finishId: "matte-black",
          lensOptionTypes: [],
          lensPrice: 0,
          addedAt: 2000,
        },
      ])
    );

    render(
      <MemoryRouter initialEntries={["/cart"]}>
        <CartProvider>
          <CartPage />
        </CartProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Wearer: Alex")).toBeInTheDocument();
    expect(screen.getByText("Save Rx to profile")).toBeInTheDocument();
    const radios = screen.getAllByRole("radio", { name: "Checkout this pair" });
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");

    // Delete item-2 and undo
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    fireEvent.click(removeButtons[1]);
    expect(screen.getByText("Removed ORBIT T-4")).toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: "Checkout this pair" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getAllByRole("radio", { name: "Checkout this pair" })).toHaveLength(2);
  });

  test("OrderConfirmationPage shows honest unknown status (never ¥0) on lookup failure and recovers on retry", async () => {
    vi.mocked(fetchOrderDetail).mockRejectedValueOnce(new Error("Network timeout"));
    vi.mocked(refreshOrderPaymentStatus).mockResolvedValueOnce(BASE_ORDER_DETAIL);

    render(
      <MemoryRouter initialEntries={["/order-confirmation?out_trade_no=KL-20261122-0088"]}>
        <CartProvider>
          <Routes>
            <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Unable to Confirm Order Status/i)).toBeInTheDocument();
    expect(screen.getByText("KL-20261122-0088")).toBeInTheDocument();
    expect(screen.queryByText(/0\.00/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry Query" }));
    expect(await screen.findByText("Payment Confirmed")).toBeInTheDocument();
    expect(screen.getByText(/950\.00/)).toBeInTheDocument();
  });

  test("OrderDetailPage displays NEEDS_INFO hero action and still renders order cleanly when after-sales API fails", async () => {
    vi.mocked(fetchOrderDetail).mockResolvedValue({
      ...BASE_ORDER_DETAIL,
      fulfillmentStatus: "NEEDS_INFO",
    });
    vi.mocked(fetchOrderAfterSalesTickets)
      .mockRejectedValueOnce(new Error("Ticket service 503"))
      .mockResolvedValueOnce([]);

    render(
      <MemoryRouter initialEntries={["/order/KL-20261122-0088"]}>
        <CartProvider>
          <Routes>
            <Route path="/order/:orderNumber" element={<OrderDetailPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );

    // Order loads + NEEDS_INFO hero action appears
    expect(await screen.findByText("Additional Prescription Info Needed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Supplement Prescription Info" }));

    const categorySelect = screen.getByRole("combobox") as HTMLSelectElement;
    expect(categorySelect.value).toBe("PRESCRIPTION_SUPPLEMENT");

    // Independent ticket failure banner + working retry
    expect(await screen.findByText(/Temporarily unable to load after-sales records/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(screen.getByText("No after-sales requests for this order.")).toBeInTheDocument();
    });
  });

  test("OrderDetailPage displays Copy Tracking Number and carrier tracking link for SHIPPED orders", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    vi.mocked(fetchOrderDetail).mockResolvedValue({
      ...BASE_ORDER_DETAIL,
      status: "SHIPPED",
      fulfillmentStatus: "SHIPPED",
      carrier: "顺丰速运",
      trackingNumber: "SF1234567890",
    });
    vi.mocked(fetchOrderAfterSalesTickets).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/order/KL-20261122-0088"]}>
        <CartProvider>
          <Routes>
            <Route path="/order/:orderNumber" element={<OrderDetailPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Order Shipped · Tracking Ready/i)).toBeInTheDocument();
    const copyButtons = screen.getAllByRole("button", { name: "Copy Tracking Number" });
    fireEvent.click(copyButtons[0]);
    expect(writeText).toHaveBeenCalledWith("SF1234567890");
    expect(await screen.findAllByText("Tracking Copied")).toBeTruthy();

    const trackLinks = screen.getAllByRole("link", { name: "Track Shipment" });
    expect(trackLinks[0]).toHaveAttribute("href", expect.stringContaining("sf-express.com"));
  });

  test("Checkout shows account-scoped draft restore banner, clickable pending checklist, save-Rx toggle, and price-change confirmation", async () => {
    sessionStorage.setItem(
      "klarheit_checkout_state",
      JSON.stringify({
        product: MOCK_CONFIG_PRODUCTS[0],
        finishId: "titanium",
        lensOptionTypes: ["THIN_161"],
        prescription: { sphOd: -3.5, sphOs: -3.25, cylOd: 0, cylOs: 0, axisOd: 0, axisOs: 0, pd: 63 },
        quotedTotal: 890,
        wearerName: "Alex",
        savePrescriptionToProfile: true,
        accountEmail: "lin@example.com",
      })
    );

    render(
      <MemoryRouter initialEntries={["/checkout"]}>
        <CartProvider>
          <Checkout />
        </CartProvider>
      </MemoryRouter>
    );

    // Explicit draft restore notice
    expect(await screen.findByText(/Restored from your draft: frame, finish, lens options, and prescription/i)).toBeInTheDocument();

    // Actionable pending-item checklist replaces opaque numeric score
    expect(screen.getByRole("button", { name: "Add shipping address" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm updated total" })).toBeInTheDocument();

    // Explicit Save Rx to profile toggle is checked from draft
    const saveRxCheckbox = screen.getByRole("checkbox", {
      name: /Save this confirmed prescription to my profile/i,
    }) as HTMLInputElement;
    expect(saveRxCheckbox.checked).toBe(true);

    // Complete shipping address & confirm updated price -> checklist transitions to ready
    const addressInput = document.querySelector<HTMLInputElement>('input[name="shippingAddress"]');
    expect(addressInput).not.toBeNull();
    fireEvent.change(addressInput!, { target: { value: "Shanghai Pudong 88" } });

    const confirmPriceCheckbox = screen.getByRole("checkbox", {
      name: /I have reviewed and confirmed the updated total/i,
    });
    fireEvent.click(confirmPriceCheckbox);

    expect(screen.getByText("All required fields ready to submit")).toBeInTheDocument();

    // Verify edited shipping address is persisted to sessionStorage draft for reload recovery
    const savedRaw = sessionStorage.getItem("klarheit_checkout_state");
    expect(savedRaw).not.toBeNull();
    const saved = JSON.parse(savedRaw!);
    expect(saved.draftCustomer?.shippingAddress).toBe("Shanghai Pudong 88");
    expect(saved.draftUpdatedOnCheckout).toBe(true);

    // Simulate browser F5 reload where routeState is preserved alongside sessionStorage draft
    cleanup();
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/checkout",
            state: {
              product: MOCK_CONFIG_PRODUCTS[0],
              finishId: "titanium",
              lensOptionTypes: ["THIN_161"],
              prescription: { sphOd: -3.5, sphOs: -3.25, cylOd: 0, cylOs: 0, axisOd: 0, axisOs: 0, pd: 63 },
            },
          },
        ]}
      >
        <CartProvider>
          <Checkout />
        </CartProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Restored from your draft/i)).toBeInTheDocument();
    const reloadedAddress = document.querySelector<HTMLInputElement>('input[name="shippingAddress"]');
    expect(reloadedAddress?.value).toBe("Shanghai Pudong 88");
  });
});
