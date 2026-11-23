import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import i18n from "../i18n";
import { useAuth } from "../auth/AuthProvider";
import {
  adminFetchAfterSalesTickets,
  adminFetchAlerts,
  adminFetchCheckoutSetting,
  adminFetchNotifications,
  adminFetchOrders,
  adminFetchStats,
  adminResendNotification,
  adminRestockAfterSalesTicket,
  adminUpdateAfterSalesTicket,
  estimateOrderDelivery,
  fetchCheckoutSystemStatus,
  fetchAddresses,
} from "../services/api";
import { AdminDashboard } from "./AdminDashboard";
import { Checkout } from "./Checkout";
import { AuthDrawer } from "../components/auth/AuthDrawer";
import { Footer } from "../components/layout/Footer";
import { CartProvider } from "../hooks/useCart";

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("../services/analytics", () => ({
  track: vi.fn(),
  normalizeRoutePath: (p: string) => p,
}));
vi.mock("../hooks/useProducts", () => ({
  useProducts: () => ({
    products: [
      {
        id: 1,
        name: "AERO X1",
        nameEn: "AERO X1",
        nameZh: "AERO X1",
        material: "Titanium",
        materialEn: "Titanium",
        materialZh: "钛金属",
        basePrice: 850,
        imageUrl: "/images/aero_x1.png",
        shape: "ROUND",
        specsSize: "52-18-145",
        detailImages: null,
        salesStatus: "AVAILABLE",
        inStock: true,
        arConfigs: [],
      },
    ],
    isLoading: false,
    error: null,
  }),
}));
vi.mock("../hooks/useLensOptions", () => ({
  useLensOptions: () => ({
    options: [
      { id: 1, type: "STANDARD_156", label: "1.56 Standard", additionalPrice: 0 },
    ],
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock("../services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/api")>()),
  adminFetchOrders: vi.fn(),
  adminFetchStats: vi.fn(),
  adminFetchCheckoutSetting: vi.fn(),
  adminFetchAlerts: vi.fn(),
  adminFetchNotifications: vi.fn(),
  adminResendNotification: vi.fn(),
  adminFetchAfterSalesTickets: vi.fn(),
  adminUpdateAfterSalesTicket: vi.fn(),
  adminRestockAfterSalesTicket: vi.fn(),
  fetchAddresses: vi.fn(),
  fetchCheckoutSystemStatus: vi.fn(),
  estimateOrderDelivery: vi.fn(),
}));

describe("Production Readiness P0 UI Completion & P1 Verification", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    cleanup();
  });

  test("P0-10: WAREHOUSE staff loads AdminDashboard without calling stats/kill-switch and hides unauthorized tabs", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAuthReady: true,
      user: {
        id: 2,
        firstName: "Wang",
        lastName: "Bo",
        email: "warehouse@klarheit.com",
        phone: null,
        phoneVerified: false,
        role: "WAREHOUSE",
      },
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(adminFetchOrders).mockResolvedValue({
      content: [],
      totalPages: 1,
      totalElements: 0,
      number: 0,
      size: 20,
    });
    vi.mocked(adminFetchAlerts).mockResolvedValue({
      generatedAt: "2026-11-23T10:00:00",
      businessTimeZone: "Asia/Shanghai",
      totalActionable: 0,
      alerts: [],
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminDashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText("WAREHOUSE")).toBeInTheDocument();
    expect(adminFetchOrders).toHaveBeenCalledTimes(1);
    expect(adminFetchStats).not.toHaveBeenCalled();
    expect(adminFetchCheckoutSetting).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Product Catalog" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "After-Sales Tickets" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "User Directory" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Audit Logs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Email Outbox" })).not.toBeInTheDocument();
  });

  test("Sec 6 P1: Operational Alerts jump to Email Outbox and resend failed email idempotently", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAuthReady: true,
      user: {
        id: 3,
        firstName: "Chen",
        lastName: "Mei",
        email: "cs@klarheit.com",
        phone: null,
        phoneVerified: false,
        role: "CUSTOMER_SERVICE",
      },
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(adminFetchOrders).mockResolvedValue({
      content: [],
      totalPages: 1,
      totalElements: 0,
      number: 0,
      size: 20,
    });
    vi.mocked(adminFetchAlerts).mockResolvedValue({
      generatedAt: "2026-11-23T10:00:00",
      businessTimeZone: "Asia/Shanghai",
      totalActionable: 2,
      alerts: [
        { key: "FAILED_EMAILS", severity: "WARNING", count: 2, ownerRole: "CUSTOMER_SERVICE" },
      ],
    });
    vi.mocked(adminFetchNotifications).mockResolvedValue({
      content: [
        {
          id: 99,
          eventKey: "ORDER_CONFIRMATION:KL-99",
          eventType: "ORDER_CONFIRMATION",
          orderNumber: "KL-99",
          recipientEmail: "buyer@example.com",
          subject: "Order Confirmed — KL-99",
          status: "FAILED",
          attemptCount: 1,
          lastError: "SMTP 503",
          lastAttemptedAt: "2026-11-23T09:50:00",
          sentAt: null,
          resentBy: null,
          createdAt: "2026-11-23T09:50:00",
        },
      ],
      totalPages: 1,
      totalElements: 1,
      number: 0,
      size: 20,
    });
    vi.mocked(adminResendNotification).mockResolvedValue({
      id: 99,
      eventKey: "ORDER_CONFIRMATION:KL-99",
      eventType: "ORDER_CONFIRMATION",
      orderNumber: "KL-99",
      recipientEmail: "buyer@example.com",
      subject: "Order Confirmed — KL-99",
      status: "SENT",
      attemptCount: 2,
      lastError: null,
      lastAttemptedAt: "2026-11-23T10:01:00",
      sentAt: "2026-11-23T10:01:00",
      resentBy: "cs@klarheit.com",
      createdAt: "2026-11-23T09:50:00",
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminDashboard />
      </MemoryRouter>
    );

    const alertBtn = await screen.findByRole("button", { name: /Failed notification emails/i });
    fireEvent.click(alertBtn);

    const resendBtn = await screen.findByRole("button", { name: "Resend" });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(adminResendNotification).toHaveBeenCalledWith(99);
    });
    expect(await screen.findByText(/Email notification #99 resent successfully/i)).toBeInTheDocument();
  });

  test("P0-07: WAREHOUSE operator marks physical return receipt, disposition, and restocks returned item", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAuthReady: true,
      user: {
        id: 2,
        firstName: "Wang",
        lastName: "Bo",
        email: "warehouse@klarheit.com",
        phone: null,
        phoneVerified: false,
        role: "WAREHOUSE",
      },
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(adminFetchOrders).mockResolvedValue({
      content: [],
      totalPages: 1,
      totalElements: 0,
      number: 0,
      size: 20,
    });
    vi.mocked(adminFetchAlerts).mockResolvedValue({
      generatedAt: "2026-11-23T10:00:00",
      businessTimeZone: "Asia/Shanghai",
      totalActionable: 0,
      alerts: [],
    });
    vi.mocked(adminFetchAfterSalesTickets).mockResolvedValue({
      content: [
        {
          ticketNumber: "AS-RET-1",
          orderNumber: "KL-RET-1",
          category: "RETURN",
          reason: "Unopened frame return",
          contactInfo: "13800138000",
          status: "IN_PROGRESS",
          assignee: "warehouse@klarheit.com",
          resolutionNote: null,
          nextContactAt: null,
          createdAt: "2026-11-22T10:00:00",
          updatedAt: "2026-11-22T10:00:00",
          returnReceivedAt: null,
          returnQcResult: "RESTOCKABLE",
          returnRestocked: false,
        },
      ],
      totalPages: 1,
      totalElements: 1,
      number: 0,
      size: 20,
    });
    vi.mocked(adminUpdateAfterSalesTicket).mockResolvedValue({
      ticketNumber: "AS-RET-1",
      orderNumber: "KL-RET-1",
      category: "RETURN",
      reason: "Unopened frame return",
      contactInfo: "13800138000",
      status: "IN_PROGRESS",
      assignee: "warehouse@klarheit.com",
      resolutionNote: null,
      nextContactAt: null,
      createdAt: "2026-11-22T10:00:00",
      updatedAt: "2026-11-23T10:00:00",
      returnReceivedAt: "2026-11-23T10:00:00",
      returnQcResult: "RESTOCKABLE",
      returnRestocked: false,
    });
    vi.mocked(adminRestockAfterSalesTicket).mockResolvedValue({
      ticketNumber: "AS-RET-1",
      orderNumber: "KL-RET-1",
      category: "RETURN",
      reason: "Unopened frame return",
      contactInfo: "13800138000",
      status: "IN_PROGRESS",
      assignee: "warehouse@klarheit.com",
      resolutionNote: null,
      nextContactAt: null,
      createdAt: "2026-11-22T10:00:00",
      updatedAt: "2026-11-23T10:00:00",
      returnReceivedAt: "2026-11-23T10:00:00",
      returnQcResult: "RESTOCKABLE",
      returnRestocked: true,
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminDashboard />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "After-Sales Tickets" }));
    fireEvent.click(await screen.findByRole("button", { name: "Handle" }));

    const restockBtn = await screen.findByRole("button", { name: "QC Restock (+1)" });
    expect(restockBtn).toBeDisabled();

    const receiptCheckbox = screen.getByLabelText("Confirm warehouse physically received returned package");
    fireEvent.click(receiptCheckbox);
    expect(restockBtn).not.toBeDisabled();

    fireEvent.click(restockBtn);
    await waitFor(() => {
      expect(adminUpdateAfterSalesTicket).toHaveBeenCalledWith(
        "AS-RET-1",
        expect.objectContaining({
          returnReceivedAt: expect.any(String),
          returnQcResult: "RESTOCKABLE",
          returnDisposition: "RESTOCK",
        })
      );
      expect(adminRestockAfterSalesTicket).toHaveBeenCalledWith("AS-RET-1");
    });
  });

  test("Sec 4 P1 #1: AuthDrawer exposes dialog semantics, closes on Escape, and restores focus to trigger", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      vi.mocked(useAuth).mockReturnValue({
        isAuthModalOpen: open,
        closeAuthModal: () => setOpen(false),
        authMode: "signin",
        setAuthMode: vi.fn(),
        login: vi.fn(),
        register: vi.fn(),
        authError: null,
        authMessage: null,
        isSubmittingAuth: false,
      } as unknown as ReturnType<typeof useAuth>);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Open Sign In
          </button>
          <AuthDrawer />
        </div>
      );
    }

    render(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "Open Sign In" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(trigger);
  });

  test("Sec 4 P1 #1 & #2: Checkout inputs have explicit label associations and pre-sales support hint", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAuthReady: true,
      user: {
        id: 10,
        firstName: "Lin",
        lastName: "Wei",
        email: "lin@example.com",
        phone: "13800138000",
        phoneVerified: true,
        role: "USER",
      },
      openAuthModal: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(fetchAddresses).mockResolvedValue([]);
    vi.mocked(fetchCheckoutSystemStatus).mockResolvedValue({ checkoutEnabled: true, pauseReason: "" });
    vi.mocked(estimateOrderDelivery).mockResolvedValue({
      deliverable: true,
      manualReviewRequired: false,
      shippingFee: 0,
      minDays: 10,
      maxDays: 14,
      estimatedDeliveryDate: "2026-12-06",
      resolvedProvince: "Shanghai",
      resolvedCity: "Shanghai",
      reason: "Standard mainland delivery",
    });

    const checkoutProduct = {
      id: 1,
      name: "AERO X1",
      nameEn: "AERO X1",
      nameZh: "AERO X1",
      material: "Titanium",
      materialEn: "Titanium",
      materialZh: "钛金属",
      basePrice: 850,
      imageUrl: "/images/aero_x1.png",
      shape: "ROUND",
      specsSize: "52-18-145",
      detailImages: null,
      salesStatus: "AVAILABLE",
      inStock: true,
      arConfigs: [],
    };

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/checkout", state: { product: checkoutProduct, lensOptionTypes: ["STANDARD_156"] } },
        ]}
      >
        <CartProvider>
          <Checkout />
        </CartProvider>
      </MemoryRouter>
    );

    expect(await screen.findByLabelText("First Name")).toHaveAttribute("name", "firstName");
    expect(screen.getByLabelText("Province / Municipality")).toHaveAttribute("name", "province");
    expect(screen.getByLabelText("City")).toHaveAttribute("name", "city");
    expect(screen.getByLabelText("Shipping Address")).toHaveAttribute("name", "shippingAddress");
    expect(screen.getByLabelText("Pupillary Distance (PD)")).toHaveAttribute("name", "pd");
    expect(screen.getByText(/support@klarheit\.com/i)).toBeInTheDocument();
  });

  test("Sec 4 P1 #2: Anonymous visitor can open Support & Service Rules and Privacy & Data Rights modals from Footer", async () => {
    render(<Footer />);

    fireEvent.click(screen.getByRole("button", { name: "Support & Service Rules" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Klarheit_Optics/i)).toBeInTheDocument();
    expect(screen.getByText(/Unopened frames may be returned within 7 days/i)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Privacy & Data Rights" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/privacy@klarheit\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/48 hours/i)).toBeInTheDocument();
  });
});
