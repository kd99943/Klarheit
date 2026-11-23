import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import i18n from "../i18n";
import { CartProvider, useCart } from "../hooks/useCart";
import { useAuth } from "../auth/AuthProvider";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import {
  ApiError,
  checkoutOrder,
  confirmOrderQuote,
  estimateOrderDelivery,
  fetchAddresses,
  fetchCheckoutSystemStatus,
  fetchOrderAfterSalesTickets,
  fetchOrderDetail,
  fetchProductById,
  fetchProducts,
  type OrderDetailResponse,
  type Product,
} from "../services/api";
import { ProductDetailsPage } from "./ProductDetailsPage";
import { ARVirtualStudio } from "./ARVirtualStudio";
import { ConfigLab } from "./ConfigLab";
import { Checkout } from "./Checkout";
import { OrderDetailPage } from "./OrderDetailPage";
import { CHECKOUT_IDEMPOTENCY_KEY, CHECKOUT_STATE_KEY } from "../lib/privacy";

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("../services/analytics", () => ({
  track: vi.fn(),
  normalizeRoutePath: (p: string) => p,
}));
vi.mock("../ar/useCameraStream", () => ({
  useCameraStream: () => ({
    status: "unsupported",
    stream: null,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));
vi.mock("../ar/useFaceLandmarks", () => ({
  useFaceLandmarks: () => ({ status: "initializing", landmarks: null }),
}));
vi.mock("../ar/ARTryOnCanvas", () => ({
  ARTryOnCanvas: () => <div data-testid="ar-try-on-canvas" />,
}));
vi.mock("../ar/FrameShowcase", () => ({
  FrameShowcase: ({ frame }: { frame: { productName: string; id: string } }) => (
    <div data-testid="frame-showcase">{`${frame.productName}:${frame.id}`}</div>
  ),
}));
vi.mock("../components/ar/FaceCalibrationGuide", () => ({
  FaceCalibrationGuide: () => <div data-testid="face-calibration-guide" />,
}));

const MULTI_SIZE_PUBLIC_PRODUCT: Product = {
  id: 10,
  name: "MONOLITH 02",
  nameEn: "MONOLITH 02",
  nameZh: "MONOLITH 02",
  material: "Japanese Acetate",
  materialEn: "Japanese Acetate",
  materialZh: "日本板材",
  basePrice: 890,
  imageUrl: "/images/monolith.png",
  shape: "SQUARE",
  specsSize: "50-18-140",
  detailImages: null,
  // Public API omits exact stockQuantity and availableQty (P0-10)
  inStock: true,
  lowStock: true,
  salesStatus: "AVAILABLE",
  arConfigs: [
    { id: "matte-black", finishLabelKey: "color.matteBlack", frameColor: "#141416", lensColor: "#e8f4f6", lensLabel: "Onyx AR" },
  ] as Product["arConfigs"],
  skus: [
    {
      id: 201,
      productId: 10,
      finishId: "matte-black",
      sizeSpec: "50-18-140",
      inStock: false,
      lowStock: false,
      salesStatus: "OUT_OF_STOCK",
      restockEta: "2026-12-15",
    },
    {
      id: 202,
      productId: 10,
      finishId: "matte-black",
      sizeSpec: "54-18-145",
      inStock: true,
      lowStock: true,
      salesStatus: "AVAILABLE",
      restockEta: null,
    },
  ],
};

const STUDIO_PRODUCTS: Product[] = [
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
    specsSize: "52-18-145",
    detailImages: null,
    inStock: true,
    salesStatus: "AVAILABLE",
    arConfigs: [
      { id: "titanium", finishLabelKey: "color.titanium", frameColor: "#9aa1aa", lensColor: "#dce8f2", lensLabel: "Neutral Clear" },
    ] as Product["arConfigs"],
    skus: [
      { id: 11, productId: 1, finishId: "titanium", sizeSpec: "52-18-145", inStock: true, salesStatus: "AVAILABLE", restockEta: null },
    ],
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
    inStock: true,
    salesStatus: "AVAILABLE",
    arConfigs: [
      { id: "matte-black", finishLabelKey: "color.matteBlack", frameColor: "#141416", lensColor: "#e8f4f6", lensLabel: "Onyx AR" },
    ] as Product["arConfigs"],
    skus: [
      { id: 22, productId: 2, finishId: "matte-black", sizeSpec: "48-21-140", inStock: true, salesStatus: "AVAILABLE", restockEta: null },
    ],
  },
];

let mockedCatalogProducts: Product[] = STUDIO_PRODUCTS;

vi.mock("../hooks/useProducts", () => ({
  useProducts: () => ({
    products: mockedCatalogProducts,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("../hooks/useLensOptions", () => ({
  useLensOptions: () => ({
    options: [
      { id: 1, type: "STANDARD_156", category: "LENS", label: "1.56 Standard", description: "Included", indexValue: 1.56, additionalPrice: 0 },
      { id: 2, type: "THIN_161", category: "LENS", label: "1.61 Thin", description: "Thinner", indexValue: 1.61, additionalPrice: 100 },
    ],
    isLoading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("../services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/api")>()),
  fetchProducts: vi.fn(),
  fetchProductById: vi.fn(),
  fetchArConfigs: vi.fn().mockResolvedValue([]),
  fetchAddresses: vi.fn().mockResolvedValue([]),
  fetchCheckoutSystemStatus: vi.fn().mockResolvedValue({ checkoutEnabled: true, pauseReason: "" }),
  estimateOrderDelivery: vi.fn(),
  checkoutOrder: vi.fn(),
  fetchOrderDetail: vi.fn(),
  fetchOrderAfterSalesTickets: vi.fn().mockResolvedValue([]),
  confirmOrderQuote: vi.fn(),
}));

function CartProbe() {
  const { items } = useCart();
  return (
    <div data-testid="cart-probe">
      {JSON.stringify(items.map((i) => ({ productId: i.productId, productName: i.productName, finishId: i.finishId, sizeSpec: i.sizeSpec, skuId: i.skuId })))}
    </div>
  );
}

describe("Production Readiness Audit — Frontend P0 Verification Suite", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockedCatalogProducts = STUDIO_PRODUCTS;
    await i18n.changeLanguage("en");
    vi.mocked(fetchProducts).mockResolvedValue(STUDIO_PRODUCTS);
    vi.mocked(fetchAddresses).mockResolvedValue([]);
    vi.mocked(fetchCheckoutSystemStatus).mockResolvedValue({ checkoutEnabled: true, pauseReason: "" });
    vi.mocked(estimateOrderDelivery).mockResolvedValue({
      deliverable: true,
      manualReviewRequired: false,
      shippingFee: 0,
      minDays: 10,
      maxDays: 14,
      estimatedDeliveryDate: "2026-12-06",
      resolvedProvince: "上海",
      resolvedCity: "上海",
      reason: "Standard Mainland China delivery (上海), free shipping.",
    });
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAuthReady: true,
      user: { id: 1, firstName: "Lin", lastName: "Wei", email: "usera@example.com", phone: "13800138000", phoneVerified: true, role: "USER" },
      requireAuth: vi.fn().mockReturnValue(true),
      openAuthModal: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(cleanup);

  test("P0-01 & P0-10: ProductDetailsPage supports multi-size SKU selection on public API projection (no availableQty) and propagates exact skuId + sizeSpec to cart", async () => {
    vi.mocked(fetchProductById).mockResolvedValue(MULTI_SIZE_PUBLIC_PRODUCT);

    render(
      <MemoryRouter initialEntries={["/product/10"]}>
        <CartProvider>
          <Routes>
            <Route path="/product/:id" element={<ProductDetailsPage />} />
          </Routes>
          <CartProbe />
        </CartProvider>
      </MemoryRouter>
    );

    // Default size 50-18-140 is out of stock -> Add to Cart disabled
    const addBtn = await screen.findByRole("button", { name: /Add Frame to Cart/i });
    expect(addBtn).toBeDisabled();

    // Switch to in-stock size 54-18-145 -> low-stock public notice renders (without exact qty), CTA enabled
    fireEvent.click(screen.getByRole("button", { name: /54-18-145/i }));
    expect(screen.getByText(/Limited stock remaining/i)).toBeInTheDocument();
    expect(addBtn).toBeEnabled();

    fireEvent.click(addBtn);
    expect(screen.getByTestId("cart-probe")).toHaveTextContent('"skuId":202');
    expect(screen.getByTestId("cart-probe")).toHaveTextContent('"sizeSpec":"54-18-145"');
  });

  test("Section 4 AR Compare: activating Slot B and clicking Add Current Frame to Cart adds Slot B (NOT Slot A) and disables ordering when Slot B is paused", async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/virtual-studio", state: { productId: 1, finishId: "titanium" } }]}>
        <CartProvider>
          <ARVirtualStudio />
          <CartProbe />
        </CartProvider>
      </MemoryRouter>
    );

    // Enter Compare Two mode (camera is unsupported -> model/compare view active)
    fireEvent.click(await screen.findByRole("button", { name: /Compare Two/i }));
    // Activate Slot B (ORBIT T-4)
    fireEvent.click(screen.getByRole("button", { name: /View B · ORBIT T-4/i }));
    // Add Current Frame to Cart -> must add ORBIT T-4 (productId 2, skuId 22), NOT AERO X1
    fireEvent.click(screen.getByRole("button", { name: /Add Current Frame to Cart \(ORBIT T-4\)/i }));

    expect(screen.getByTestId("cart-probe")).toHaveTextContent('"productId":2');
    expect(screen.getByTestId("cart-probe")).toHaveTextContent('"productName":"ORBIT T-4"');
    expect(screen.getByTestId("cart-probe")).toHaveTextContent('"skuId":22');
    expect(screen.getByText(/Added ORBIT T-4/i)).toBeInTheDocument();

    // Now test paused Slot B -> CTAs must be disabled while preview remains accessible
    cleanup();
    mockedCatalogProducts = [
      STUDIO_PRODUCTS[0],
      { ...STUDIO_PRODUCTS[1], salesStatus: "PAUSED", inStock: false },
    ];
    render(
      <MemoryRouter initialEntries={[{ pathname: "/virtual-studio", state: { productId: 1, finishId: "titanium" } }]}>
        <CartProvider>
          <ARVirtualStudio />
        </CartProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /Compare Two/i }));
    fireEvent.click(screen.getByRole("button", { name: /View B · ORBIT T-4/i }));
    expect(screen.getByRole("button", { name: /Add Current Frame to Cart \(ORBIT T-4\)/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Configure Current Frame \(ORBIT T-4\)/i })).toBeDisabled();
  });

  test("Section 4 ConfigLab: archived/unavailable frame NEVER silently substitutes another frame, preserves Rx draft, and requires explicit replacement", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/config-lab",
            state: {
              productId: 999,
              finishId: "gold",
              prescription: { sphOd: -4.25, sphOs: -4.0, cylOd: 0, cylOs: 0, axisOd: 0, axisOs: 0, pd: 64 },
            },
          },
        ]}
      >
        <CartProvider>
          <ConfigLab />
        </CartProvider>
      </MemoryRouter>
    );

    // Must warn and NOT silently auto-select AERO X1
    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable or discontinued/i);
    expect(screen.getAllByText(/No replacement frame chosen yet/i).length).toBeGreaterThanOrEqual(1);
    // Entered prescription draft is preserved
    expect(screen.getByDisplayValue("-4.25")).toBeInTheDocument();
    expect(screen.getByDisplayValue("64")).toBeInTheDocument();

    // Advance to Step 3 -> Proceed button MUST be disabled until user explicitly picks a replacement frame
    fireEvent.click(screen.getAllByRole("button", { name: /Next Step/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /Next Step/i })[0]);
    expect(screen.getAllByRole("button", { name: /Confirm & Proceed to Checkout/i })[0]).toBeDisabled();

    // Explicitly choose replacement ORBIT T-4
    const select = screen.getByLabelText(/Choose an available replacement frame/i);
    fireEvent.change(select, { target: { value: "2" } });
    expect(screen.getAllByRole("button", { name: /Confirm & Proceed to Checkout/i })[0]).toBeEnabled();
  });

  test("Section 4 & P0-01 Checkout: persists idempotencyKey across reload after lost response, rotates key on spec change, and sends exact skuId + sizeSpec", async () => {
    const checkoutDraft = {
      product: MULTI_SIZE_PUBLIC_PRODUCT,
      finishId: "matte-black",
      sizeSpec: "54-18-145",
      skuId: 202,
      lensOptionTypes: ["STANDARD_156"],
      prescription: { sphOd: -2.0, sphOs: -2.0, cylOd: 0, cylOs: 0, axisOd: 0, axisOs: 0, pd: 63 },
      accountEmail: "usera@example.com",
    };

    // Simulate network drop on first submit (response lost)
    vi.mocked(checkoutOrder).mockRejectedValueOnce(new ApiError("Network timeout", { status: 0 }));

    const { unmount } = render(
      <MemoryRouter initialEntries={[{ pathname: "/checkout", state: checkoutDraft }]}>
        <CartProvider>
          <Checkout />
        </CartProvider>
      </MemoryRouter>
    );

    fireEvent.change(document.querySelector('input[name="shippingAddress"]')!, {
      target: { value: "上海市 浦东新区 世纪大道 88 号" },
    });
    fireEvent.click(screen.getByRole("button", { name: /PROCEED TO PAY/i }));

    await waitFor(() => expect(checkoutOrder).toHaveBeenCalledTimes(1));
    const firstCallPayload = vi.mocked(checkoutOrder).mock.calls[0][0];
    expect(firstCallPayload.skuId).toBe(202);
    expect(firstCallPayload.finishId).toBe("matte-black");
    expect(firstCallPayload.sizeSpec).toBe("54-18-145");
    const firstKey = firstCallPayload.idempotencyKey;
    expect(firstKey).toBeTruthy();
    expect(sessionStorage.getItem(CHECKOUT_IDEMPOTENCY_KEY)).toContain(firstKey);

    // Simulate page reload (unmount + fresh mount restoring persisted draft) & retry
    unmount();
    vi.mocked(checkoutOrder).mockRejectedValueOnce(new ApiError("Still retrying", { status: 0 }));

    render(
      <MemoryRouter initialEntries={[{ pathname: "/checkout" }]}>
        <CartProvider>
          <Checkout />
        </CartProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /PROCEED TO PAY/i }));
    await waitFor(() => expect(checkoutOrder).toHaveBeenCalledTimes(2));
    const retryPayload = vi.mocked(checkoutOrder).mock.calls[1][0];
    expect(retryPayload.idempotencyKey).toBe(firstKey);

    // Now change shipping address -> must rotate to a NEW idempotencyKey
    vi.mocked(checkoutOrder).mockResolvedValueOnce({
      orderNumber: "KL-NEW-001",
      status: "AWAITING_REVIEW",
      totalAmount: 890,
      productName: "MONOLITH 02",
      lensOptionTypes: ["STANDARD_156"],
    });
    fireEvent.change(document.querySelector('input[name="shippingAddress"]')!, {
      target: { value: "浙江省 杭州市 西湖区 文三路 99 号" },
    });
    fireEvent.click(screen.getByRole("button", { name: /PROCEED TO PAY/i }));
    await waitFor(() => expect(checkoutOrder).toHaveBeenCalledTimes(3));
    const changedIntentPayload = vi.mocked(checkoutOrder).mock.calls[2][0];
    expect(changedIntentPayload.idempotencyKey).not.toBe(firstKey);
  });

  test("P0-05 Checkout: blocks out-of-region destination and reflects remote shipping fee in total", async () => {
    vi.mocked(estimateOrderDelivery).mockResolvedValueOnce({
      deliverable: false,
      manualReviewRequired: false,
      shippingFee: 0,
      minDays: 0,
      maxDays: 0,
      estimatedDeliveryDate: null,
      resolvedProvince: "香港",
      resolvedCity: "香港",
      reason: "Mainland China only; HK/MO/TW unsupported.",
    });

    const draft = {
      product: STUDIO_PRODUCTS[0],
      finishId: "titanium",
      sizeSpec: "52-18-145",
      skuId: 11,
      lensOptionTypes: ["STANDARD_156"],
      prescription: { sphOd: -2.0, sphOs: -2.0, cylOd: 0, cylOs: 0, axisOd: 0, axisOs: 0, pd: 63 },
      accountEmail: "usera@example.com",
    };

    render(
      <MemoryRouter initialEntries={[{ pathname: "/checkout", state: draft }]}>
        <CartProvider>
          <Checkout />
        </CartProvider>
      </MemoryRouter>
    );

    fireEvent.change(document.querySelector('input[name="province"]')!, { target: { value: "香港" } });

    expect(await screen.findByText(/HK\/MO\/TW unsupported/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PROCEED TO PAY/i })).toBeDisabled();
  });

  test("P0-03 & P0-06 OrderDetailPage: handles quote version 409 conflict with auto-reload & displays FAILED/PENDING refunds honestly (never as confirmed)", async () => {
    const v1Order: OrderDetailResponse = {
      orderNumber: "KL-QUOTE-409",
      status: "QUOTE_READY",
      totalAmount: 1065,
      discountAmount: 0,
      appliedCouponCode: null,
      createdAt: "2026-11-22T09:00:00Z",
      paidAt: null,
      customerFirstName: "Lin",
      customerLastName: "Wei",
      customerEmail: "usera@example.com",
      shippingAddress: "Shanghai Pudong 88",
      paymentChannel: "ALIPAY",
      gatewayTransactionId: null,
      finishId: "matte-black",
      productName: "AERO X1",
      productImageUrl: "/images/aero_x1.png",
      lensOptions: [{ type: "HIGH_INDEX_174", label: "1.74 High-Index", additionalPrice: 215 }],
      prescription: { sphOd: -9.0, sphOs: -8.5, cylOd: 0, cylOs: 0, axisOd: 0, axisOs: 0, pd: 63 },
      carrier: null,
      trackingNumber: null,
      quoteVersion: 1,
      quoteRevisedAmount: 1080,
      quoteNote: "Initial v1 quote",
      refundTransactions: [
        {
          refundRequestId: "RF-FAIL-01",
          requestedAmount: 200,
          status: "FAILED",
          failureMessage: "Gateway timeout",
        },
      ],
    };
    const v2Order: OrderDetailResponse = {
      ...v1Order,
      quoteVersion: 2,
      quoteRevisedAmount: 1180,
      quoteChangeSummary: "Upgraded to 1.74 custom lens (+¥100)",
      quoteNote: "Revised v2 quote",
    };

    vi.mocked(fetchOrderDetail).mockResolvedValueOnce(v1Order).mockResolvedValueOnce(v2Order);
    vi.mocked(confirmOrderQuote)
      .mockRejectedValueOnce(new ApiError("Quote version outdated", { status: 409 }))
      .mockResolvedValueOnce({
        orderNumber: "KL-QUOTE-409",
        status: "PENDING_PAYMENT",
        totalAmount: 1180,
        productName: "AERO X1",
        lensOptionTypes: ["HIGH_INDEX_174"],
      });

    render(
      <MemoryRouter initialEntries={["/order/KL-QUOTE-409"]}>
        <CartProvider>
          <Routes>
            <Route path="/order/:orderNumber" element={<OrderDetailPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Quote v1/i)).toBeInTheDocument();
    // P0-06: Failed refund must show honest failed badge, NOT confirmed
    expect(screen.getByText(/Channel Refund Failed/i)).toBeInTheDocument();
    expect(screen.queryByText(/Refund Confirmed/i)).not.toBeInTheDocument();

    // First confirm sends quoteVersion: 1 -> gets 409 -> reloads v2 with change summary banner
    fireEvent.click(screen.getByRole("button", { name: /Confirm Plan & Pay/i }));
    expect(confirmOrderQuote).toHaveBeenCalledWith("KL-QUOTE-409", "ALIPAY", 1);

    expect(await screen.findByText(/Quote v2/i)).toBeInTheDocument();
    expect(screen.getByText(/optician updated your quote/i)).toBeInTheDocument();
    expect(screen.getByText(/Upgraded to 1\.74 custom lens/i)).toBeInTheDocument();

    // Second confirm sends quoteVersion: 2
    fireEvent.click(screen.getByRole("button", { name: /Confirm Plan & Pay/i }));
    await waitFor(() => {
      expect(confirmOrderQuote).toHaveBeenLastCalledWith("KL-QUOTE-409", "ALIPAY", 2);
    });
  });

  test("P0-09 Shared Device Isolation: Account B opening /checkout NEVER sees Account A's persisted prescription or draft", () => {
    // Account A leaves a sensitive checkout draft in sessionStorage
    sessionStorage.setItem(
      CHECKOUT_STATE_KEY,
      JSON.stringify({
        product: STUDIO_PRODUCTS[0],
        finishId: "titanium",
        lensOptionTypes: ["STANDARD_156"],
        prescription: { sphOd: -6.5, sphOs: -6.25, cylOd: 0, cylOs: 0, axisOd: 0, axisOs: 0, pd: 67 },
        wearerName: "Account A Patient",
        accountEmail: "usera@example.com",
      })
    );

    // Account B signs in on the same shared browser
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAuthReady: true,
      user: { id: 2, firstName: "Bob", lastName: "Chen", email: "userb@example.com", phone: null, phoneVerified: false, role: "USER" },
      requireAuth: vi.fn().mockReturnValue(true),
      openAuthModal: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/checkout"]}>
        <CartProvider>
          <Checkout />
        </CartProvider>
      </MemoryRouter>
    );

    expect(screen.queryByDisplayValue("-6.5")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("67")).not.toBeInTheDocument();
    expect(screen.queryByText("AERO X1")).not.toBeInTheDocument();
    expect(sessionStorage.getItem(CHECKOUT_STATE_KEY)).toBeNull();
  });

  test("P0-10 Functional RBAC: OPTICIAN role can access staff-protected console route while regular USER is denied", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAuthReady: true,
      user: { id: 3, firstName: "Opt", lastName: "Staff", email: "opt@klarheit.com", phone: null, phoneVerified: true, role: "OPTICIAN" },
      requireAuth: vi.fn().mockReturnValue(true),
      openAuthModal: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    const { unmount } = render(
      <MemoryRouter initialEntries={["/admin"]}>
        <ProtectedRoute message="Sign in" adminOnly={true}>
          <div>Staff Console Unlocked</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByText("Staff Console Unlocked")).toBeInTheDocument();
    unmount();

    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAuthReady: true,
      user: { id: 4, firstName: "Reg", lastName: "User", email: "cust@example.com", phone: null, phoneVerified: true, role: "USER" },
      requireAuth: vi.fn().mockReturnValue(true),
      openAuthModal: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <ProtectedRoute message="Sign in" adminOnly={true}>
          <div>Staff Console Unlocked</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText("Staff Console Unlocked")).not.toBeInTheDocument();
  });
});
