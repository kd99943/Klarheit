import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import i18n from "../i18n";
import { CartProvider } from "../hooks/useCart";
import { useAuth } from "../auth/AuthProvider";
import {
  adminDownloadReconciliationCsv,
  adminFetchAfterSalesTickets,
  adminFetchAuditLogs,
  adminFetchCheckoutSetting,
  adminFetchOrders,
  adminFetchProductSkus,
  adminFetchProducts,
  adminFetchStats,
  adminFetchUsers,
  confirmOrderQuote,
  fetchOrderAfterSalesTickets,
  fetchOrderDetail,
  fetchProductById,
  type OrderDetailResponse,
  type Product,
} from "../services/api";
import { ProductDetailsPage } from "./ProductDetailsPage";
import { OrderDetailPage } from "./OrderDetailPage";
import { AdminDashboard } from "./AdminDashboard";

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("../services/analytics", () => ({
  track: vi.fn(),
  normalizeRoutePath: (p: string) => p,
}));
vi.mock("../ar/FrameShowcase", () => ({
  FrameShowcase: () => <div data-testid="frame-showcase" />,
}));
vi.mock("../services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/api")>()),
  fetchProductById: vi.fn(),
  fetchOrderDetail: vi.fn(),
  fetchOrderAfterSalesTickets: vi.fn(),
  confirmOrderQuote: vi.fn(),
  adminFetchOrders: vi.fn(),
  adminFetchStats: vi.fn(),
  adminFetchCheckoutSetting: vi.fn(),
  adminFetchProducts: vi.fn(),
  adminFetchProductSkus: vi.fn(),
  adminFetchAfterSalesTickets: vi.fn(),
  adminFetchUsers: vi.fn(),
  adminFetchAuditLogs: vi.fn(),
  adminDownloadReconciliationCsv: vi.fn(),
}));

const SKU_PRODUCT: Product = {
  id: 5,
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
  stockQuantity: 4,
  salesStatus: "AVAILABLE",
  arConfigs: [
    { id: "titanium", finishLabelKey: "color.titanium", frameColor: "#9aa1aa", lensColor: "#dce8f2", lensLabel: "Neutral Clear" },
    { id: "matte-black", finishLabelKey: "color.matteBlack", frameColor: "#141416", lensColor: "#e8f4f6", lensLabel: "Onyx AR" },
  ] as Product["arConfigs"],
  skus: [
    {
      id: 101,
      productId: 5,
      finishId: "titanium",
      sizeSpec: "54-17-140",
      supplierName: "Klarheit Lab",
      onHandQty: 1,
      reservedQty: 1,
      availableQty: 0,
      salesStatus: "AVAILABLE",
      restockEta: "2026-12-01",
      unitCost: 260,
    },
    {
      id: 102,
      productId: 5,
      finishId: "matte-black",
      sizeSpec: "54-17-140",
      supplierName: "Klarheit Lab",
      onHandQty: 4,
      reservedQty: 0,
      availableQty: 4,
      salesStatus: "AVAILABLE",
      restockEta: null,
      unitCost: 260,
    },
  ],
};

const BASE_ORDER: OrderDetailResponse = {
  orderNumber: "KL-OPS-001",
  status: "QUOTE_READY",
  totalAmount: 1065,
  discountAmount: 0,
  appliedCouponCode: null,
  createdAt: "2026-11-22T09:00:00Z",
  paidAt: null,
  customerFirstName: "Lin",
  customerLastName: "Wei",
  customerEmail: "lin@example.com",
  customerPhone: "13800138000",
  shippingAddress: "Shanghai Pudong 88",
  paymentChannel: "ALIPAY",
  gatewayTransactionId: null,
  finishId: "matte-black",
  productName: "AERO X1",
  productImageUrl: "/images/aero_x1.png",
  lensOptions: [{ type: "HIGH_INDEX_174", label: "1.74 High-Index", additionalPrice: 215 }],
  prescription: { sphOd: -9.0, sphOs: -8.5, cylOd: -1.0, cylOs: -0.5, axisOd: 90, axisOs: 90, pd: 63 },
  carrier: null,
  trackingNumber: null,
  fulfillmentStatus: "PENDING_REVIEW",
  initialPromisedDeliveryDate: "2026-12-06",
  estimatedDeliveryDate: "2026-12-10",
  deliveryDelayReason: "High-index custom lab edging (+4 days)",
  requiresPrepayReview: true,
  prepayReviewReason: "High power Rx requires optician confirmation before payment.",
  quoteRevisedAmount: 1180,
  quoteNote: "Custom 1.74 aspheric lens confirmed.",
  opticianVerifiedBy: "optician@klarheit.com",
  opticianVerifiedAt: "2026-11-22T10:00:00Z",
  qcStatus: "PASSED",
  qcNote: "Optical axis & power verified.",
};

describe("Business Operations Plan UI: SKU stock, pre-pay quote review, after-sales traceability & reconciliation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    await i18n.changeLanguage("en");
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAuthReady: true,
      user: { id: 1, firstName: "Lin", lastName: "Wei", email: "lin@example.com", phone: "13800138000", phoneVerified: true, role: "ADMIN" },
      requireAuth: vi.fn().mockReturnValue(true),
      openAuthModal: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(cleanup);

  test("ProductDetailsPage marks sold-out finish SKU with restock ETA while allowing available finish to order", async () => {
    vi.mocked(fetchProductById).mockResolvedValue(SKU_PRODUCT);

    render(
      <MemoryRouter initialEntries={["/product/5"]}>
        <CartProvider>
          <Routes>
            <Route path="/product/:id" element={<ProductDetailsPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );

    // Default finish titanium is sold out with restock ETA -> gallery badge & primary CTA reflect sold-out state
    expect(await screen.findByText(/Est\. restock: 2026-12-01/i)).toBeInTheDocument();
    expect(screen.getByText("Sold Out")).toBeInTheDocument();
    expect(screen.getByText("Out of Stock")).toBeInTheDocument();
    const configureBtn = screen.getByRole("button", { name: "Select Lenses & Prescription" });
    expect(configureBtn).toBeDisabled();

    // Switching to Matte Black (4 in stock) updates gallery badge and re-enables ordering
    fireEvent.click(screen.getByRole("button", { name: /Matte Black/i }));
    expect(screen.getByText("4 in stock for this finish")).toBeInTheDocument();
    expect(screen.getByText("Only 4 left")).toBeInTheDocument();
    expect(configureBtn).not.toBeDisabled();
  });

  test("OrderDetailPage displays QUOTE_READY action, initial promised vs delayed date, QC status, and full after-sales traceability", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAuthReady: true,
      user: { id: 1, firstName: "Lin", lastName: "Wei", email: "lin@example.com", phone: "13800138000", phoneVerified: true, role: "USER" },
      requireAuth: vi.fn().mockReturnValue(true),
      openAuthModal: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(fetchOrderDetail).mockResolvedValue(BASE_ORDER);
    vi.mocked(confirmOrderQuote).mockResolvedValue({
      orderNumber: "KL-OPS-001",
      status: "PENDING_PAYMENT",
      totalAmount: 1180,
      productName: "AERO X1",
      lensOptionTypes: ["HIGH_INDEX_174"],
    });
    vi.mocked(fetchOrderAfterSalesTickets).mockResolvedValue([
      {
        ticketNumber: "AS-OPS-99",
        orderNumber: "KL-OPS-001",
        category: "DAMAGED",
        reason: "Temple scratch",
        contactInfo: "13800138000",
        status: "RESOLVED",
        assignee: "ops@klarheit.com",
        resolutionNote: "Remade & partially refunded",
        nextContactAt: null,
        createdAt: "2026-11-22T11:00:00Z",
        updatedAt: "2026-11-22T12:00:00Z",
        returnCarrier: "SF Express",
        returnTrackingNumber: "SF-RET-123",
        returnQcResult: "RESTOCKABLE",
        returnRestocked: true,
        remakeOrderNumber: "KL-REMAKE-1",
        remakeCarrier: "SF Express",
        remakeTrackingNumber: "SF-NEW-456",
        refundAmount: 120,
        refundTransactionId: "ALI-RF-001",
        financeVerifiedBy: "finance@klarheit.com",
        financeVerifiedAt: "2026-11-22T12:30:00Z",
        rootCause: "SHIPPING_DAMAGE",
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/order/KL-OPS-001"]}>
        <CartProvider>
          <Routes>
            <Route path="/order/:orderNumber" element={<OrderDetailPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Confirmed Optical Plan & Timeline Ready")).toBeInTheDocument();
    expect(screen.getByText("Amount Due")).toBeInTheDocument();
    expect(screen.getByText("Optician Verified · Awaiting Payment")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Cancel Order" })).toHaveLength(1);
    expect(screen.getByText(/Custom 1\.74 aspheric lens confirmed/i)).toBeInTheDocument();
    expect(screen.getByText("2026-12-06")).toBeInTheDocument();
    expect(screen.getAllByText("2026-12-10").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/High-index custom lab edging/i)).toBeInTheDocument();
    expect(screen.getByText(/QC Passed/i)).toBeInTheDocument();

    // After-sales linked return, QC restock, remake, refund & finance sign-off
    expect(await screen.findByText(/SF-RET-123/)).toBeInTheDocument();
    expect(screen.getByText("Restocked")).toBeInTheDocument();
    expect(screen.getByText(/SF-NEW-456/)).toBeInTheDocument();
    expect(screen.getByText("Finance Verified")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm Plan & Pay" }));
    expect(confirmOrderQuote).toHaveBeenCalledWith("KL-OPS-001", "ALIPAY");
  });

  test("AdminDashboard displays on-time SLA, net contribution breakdown, CSV export, and SKU modal", async () => {
    vi.mocked(adminFetchCheckoutSetting).mockResolvedValue({ checkoutEnabled: true, pauseReason: "" });
    vi.mocked(adminFetchOrders).mockResolvedValue({ content: [], totalPages: 1, totalElements: 0, number: 0, size: 20 });
    vi.mocked(adminFetchStats).mockResolvedValue({
      totalOrders: 4,
      totalUsers: 10,
      totalSales: 3800,
      totalRefunded: 200,
      netRevenue: 3600,
      totalVariableCost: 1400,
      netContribution: 2200,
      averageOrderValue: 950,
      awaitingPrepayReviewCount: 1,
      onTimeDeliveryMetrics: {
        dueCount: 2,
        onTimeDeliveredCount: 2,
        delayedCount: 0,
        onTimeRatePct: 100,
        cancelledCount: 0,
        needsInfoCount: 0,
        rescheduledCount: 1,
      },
      contributionByProduct: [
        { key: "AERO X1", orderCount: 4, grossRevenue: 3800, refundedAmount: 200, variableCost: 1400, netContribution: 2200, ticketCount: 1 },
      ],
      contributionBySource: [
        { key: "XIAOHONGSHU", orderCount: 4, grossRevenue: 3800, refundedAmount: 200, variableCost: 1400, netContribution: 2200, ticketCount: 1 },
      ],
      afterSalesByRootCause: { SHIPPING_DAMAGE: 1 },
    });
    vi.mocked(adminFetchProducts).mockResolvedValue([SKU_PRODUCT]);
    vi.mocked(adminFetchProductSkus).mockResolvedValue(SKU_PRODUCT.skus!);
    vi.mocked(adminFetchAfterSalesTickets).mockResolvedValue({ content: [], totalPages: 1, totalElements: 0, number: 0, size: 20 });
    vi.mocked(adminFetchUsers).mockResolvedValue({ content: [], totalPages: 1, totalElements: 0, number: 0, size: 20 });
    vi.mocked(adminFetchAuditLogs).mockResolvedValue({ content: [], totalPages: 1, totalElements: 0, number: 0, size: 30 });
    vi.mocked(adminDownloadReconciliationCsv).mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminDashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Daily Reconciliation & Weekly Review")).toBeInTheDocument();
    expect(screen.getByText("AERO X1")).toBeInTheDocument();
    expect(screen.getByText("Xiaohongshu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export Reconciliation CSV" }));
    expect(adminDownloadReconciliationCsv).toHaveBeenCalledTimes(1);

    // Switch to Product Catalog tab & open SKU Stock modal
    fireEvent.click(screen.getByRole("button", { name: "Product Catalog" }));
    const skuBtn = await screen.findByRole("button", { name: "SKU Stock" });
    fireEvent.click(skuBtn);
    expect(await screen.findByText(/SKU Inventory · AERO X1/i)).toBeInTheDocument();
    expect(screen.getByText("2026-12-01")).toBeInTheDocument();
  });
});
