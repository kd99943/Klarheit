import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  DollarSign,
  Download,
  Edit,
  Layers,
  LifeBuoy,
  Loader2,
  Mail,
  MapPin,
  Package,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  adminCancelOrder,
  adminConfirmPrepayQuote,
  adminCreateProduct,
  adminDeleteProduct,
  adminDeliverOrder,
  adminDownloadReconciliationCsv,
  adminFetchAfterSalesTickets,
  adminFetchAlerts,
  adminFetchAuditLogs,
  adminFetchCheckoutSetting,
  adminFetchNotifications,
  adminFetchOrderDetail,
  adminFetchOrders,
  adminFetchProductSkus,
  adminFetchProducts,
  adminFetchStats,
  adminFetchUsers,
  adminFinanceVerifyAfterSalesTicket,
  adminImportStocktake,
  adminManualConfirmRefundTransaction,
  adminRecordQcResult,
  adminRefundAfterSalesTicket,
  adminResendNotification,
  adminRestockAfterSalesTicket,
  adminRetryRefundTransaction,
  adminReviseOrderPrescription,
  adminShipOrder,
  adminStartProduction,
  adminUpdateAfterSalesTicket,
  adminUpdateCheckoutSetting,
  adminUpdateFulfillment,
  adminUpdateOrderAddress,
  adminUpdateOrderEconomics,
  adminUpdateProduct,
  adminUpdateTracking,
  adminUpdateUserRole,
  adminUpsertProductSku,
  adminVerifyOptician,
  fetchLensOptions,
  type AdminAlertsSummary,
  type AdminStats,
  type AfterSalesTicket,
  type AuditLogEntry,
  type CheckoutSystemStatus,
  type EmailNotificationRecord,
  type LensOption,
  type OrderDetailResponse,
  type OrderSummary,
  type Product,
  type ProductSku,
  type RefundTransactionRecord,
  type UserProfile,
} from "../services/api";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { formatPrice, formatDate } from "../lib/utils";

type OrderQueueFilter =
  | "ALL"
  | "AWAITING_REVIEW"
  | "QUOTE_READY"
  | "OVERDUE"
  | "PENDING_REVIEW"
  | "NEEDS_INFO"
  | "IN_PRODUCTION"
  | "QC_PASSED"
  | "REFUND_PENDING"
  | "SHIPPED"
  | "DELIVERED";

const STAFF_ROLE_OPTIONS = [
  "USER",
  "CUSTOMER_SERVICE",
  "OPTICIAN",
  "WAREHOUSE",
  "FINANCE",
  "ADMIN",
] as const;

const FULFILLMENT_EDIT_OPTIONS = [
  "PENDING_REVIEW",
  "NEEDS_INFO",
  "IN_PRODUCTION",
  "QC_PASSED",
  "EXCEPTION",
] as const;

const QC_STATUS_OPTIONS = ["PENDING", "PASSED", "FAILED"] as const;

const RETURN_QC_OPTIONS = ["PENDING", "RESTOCKABLE", "DEFECTIVE_SCRAP", "LENS_REMAKE_ONLY"] as const;

const RETURN_DISPOSITION_OPTIONS = [
  "PENDING_REVIEW",
  "RESTOCK",
  "SCRAP",
  "RETURN_TO_SUPPLIER",
  "KEEP_FOR_REMAKE",
] as const;

function normalizeDateTimeLocal(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return "";
  return trimmed.length === 16 ? `${trimmed}:00` : trimmed;
}

const ROOT_CAUSE_OPTIONS = [
  "OUT_OF_STOCK",
  "RX_INPUT_ERROR",
  "LAB_PROCESSING_ERROR",
  "SHIPPING_DAMAGE",
  "CUSTOMER_CHANGE",
  "OTHER",
] as const;

const TICKET_STATUS_OPTIONS = [
  "OPEN",
  "AWAITING_CUSTOMER",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

export function AdminDashboard() {
  const { t, i18n } = useTranslation("admin");
  const { t: tOrder } = useTranslation("order");
  const { user } = useAuth();
  const isZh = i18n.language === "zh";

  // P0-10: Role-scoped capability flags matching SecurityConfig RBAC matrix
  const staffRole = (user?.role || "USER").toUpperCase();
  const isAdmin = staffRole === "ADMIN";
  const canViewStats = isAdmin || staffRole === "FINANCE";
  const canToggleKillSwitch = isAdmin;
  const canQuoteOrOptician = isAdmin || staffRole === "OPTICIAN";
  const canWarehouse = isAdmin || staffRole === "WAREHOUSE";
  const canCustomerService = isAdmin || staffRole === "CUSTOMER_SERVICE";
  const canFinance = isAdmin || staffRole === "FINANCE";
  const canViewProducts = isAdmin || staffRole === "WAREHOUSE" || staffRole === "OPTICIAN" || staffRole === "FINANCE";
  const canEditProducts = isAdmin || staffRole === "WAREHOUSE";
  const canViewAfterSales =
    isAdmin || staffRole === "CUSTOMER_SERVICE" || staffRole === "WAREHOUSE" || staffRole === "FINANCE";
  const canViewNotifications = isAdmin || staffRole === "CUSTOMER_SERVICE";
  const canViewUsers = isAdmin;
  const canViewAuditLogs = isAdmin;

  // Tab State
  const [activeTab, setActiveTab] = useState<
    "orders" | "products" | "afterSales" | "notifications" | "users" | "auditLogs"
  >("orders");

  // Operational Alerts & Email Outbox State (Sec 6 P1)
  const [alertsSummary, setAlertsSummary] = useState<AdminAlertsSummary | null>(null);
  const [notifications, setNotifications] = useState<EmailNotificationRecord[]>([]);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const [notifStatusFilter, setNotifStatusFilter] = useState<"" | "FAILED" | "SENT">("");
  const [notifPage, setNotifPage] = useState(0);
  const [notifTotalPages, setNotifTotalPages] = useState(1);
  const [resendingNotifId, setResendingNotifId] = useState<number | null>(null);
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);

  // Checkout Kill Switch State
  const [checkoutSetting, setCheckoutSetting] = useState<CheckoutSystemStatus>({
    checkoutEnabled: true,
    pauseReason: "",
  });
  const [isTogglingCheckout, setIsTogglingCheckout] = useState(false);

  // Orders State
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [orderQueueFilter, setOrderQueueFilter] = useState<OrderQueueFilter>("ALL");

  // Pagination
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Ship / Tracking Correction Dialog State
  const [shippingOrderNum, setShippingOrderNum] = useState<string | null>(null);
  const [shipDialogMode, setShipDialogMode] = useState<"ship" | "updateTracking">("ship");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCorrectionNote, setTrackingCorrectionNote] = useState("");
  const [isSubmittingShip, setIsSubmittingShip] = useState(false);
  const [shipError, setShipError] = useState<string | null>(null);

  // Deliver Modal State (P0-05 optional actual carrier deliveredAt)
  const [deliverOrderNum, setDeliverOrderNum] = useState<string | null>(null);
  const [deliverAtVal, setDeliverAtVal] = useState("");
  const [isSubmittingDeliver, setIsSubmittingDeliver] = useState(false);
  const [deliverError, setDeliverError] = useState<string | null>(null);

  // Pre-Shipment Address Edit Modal State (P0-05)
  const [addressOrderNum, setAddressOrderNum] = useState<string | null>(null);
  const [addrProvinceVal, setAddrProvinceVal] = useState("");
  const [addrCityVal, setAddrCityVal] = useState("");
  const [addrDistrictVal, setAddrDistrictVal] = useState("");
  const [addrDetailVal, setAddrDetailVal] = useState("");
  const [addrFullVal, setAddrFullVal] = useState("");
  const [addrPhoneVal, setAddrPhoneVal] = useState("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Fulfillment Dialog State (including P0-04 Rx revision)
  const [fulfillmentOrderNum, setFulfillmentOrderNum] = useState<string | null>(null);
  const [fulfillmentStatusVal, setFulfillmentStatusVal] = useState("IN_PRODUCTION");
  const [fulfillmentNoteVal, setFulfillmentNoteVal] = useState("");
  const [estimatedDeliveryVal, setEstimatedDeliveryVal] = useState("");
  const [deliveryDelayReasonVal, setDeliveryDelayReasonVal] = useState("");
  const [opticianVerifiedVal, setOpticianVerifiedVal] = useState(false);
  const [qcStatusVal, setQcStatusVal] = useState("PENDING");
  const [qcNoteVal, setQcNoteVal] = useState("");
  const [orderSourceVal, setOrderSourceVal] = useState("");
  const [variableCostVal, setVariableCostVal] = useState("");
  const [showRxRevision, setShowRxRevision] = useState(false);
  const [rxSphOdVal, setRxSphOdVal] = useState("0");
  const [rxSphOsVal, setRxSphOsVal] = useState("0");
  const [rxCylOdVal, setRxCylOdVal] = useState("0");
  const [rxCylOsVal, setRxCylOsVal] = useState("0");
  const [rxAxisOdVal, setRxAxisOdVal] = useState("0");
  const [rxAxisOsVal, setRxAxisOsVal] = useState("0");
  const [rxPdVal, setRxPdVal] = useState("63");
  const [rxRevisionNoteVal, setRxRevisionNoteVal] = useState("");
  const [rxRevisionFeedback, setRxRevisionFeedback] = useState<string | null>(null);
  const [isSavingFulfillment, setIsSavingFulfillment] = useState(false);
  const [fulfillmentError, setFulfillmentError] = useState<string | null>(null);

  // Pre-Pay Quote Confirmation Dialog State (P0-03)
  const [quoteOrderNum, setQuoteOrderNum] = useState<string | null>(null);
  const [quoteOrderDetail, setQuoteOrderDetail] = useState<OrderDetailResponse | null>(null);
  const [availableLensOptions, setAvailableLensOptions] = useState<LensOption[]>([]);
  const [quoteLensTypesVal, setQuoteLensTypesVal] = useState<string[]>([]);
  const [quoteExpiresAtVal, setQuoteExpiresAtVal] = useState("");
  const [quoteRevisedAmountVal, setQuoteRevisedAmountVal] = useState("");
  const [quotePromisedDateVal, setQuotePromisedDateVal] = useState("");
  const [quoteTargetFinishVal, setQuoteTargetFinishVal] = useState("");
  const [quoteTargetSizeVal, setQuoteTargetSizeVal] = useState("");
  const [quoteChangeSummaryVal, setQuoteChangeSummaryVal] = useState("");
  const [quoteNoteVal, setQuoteNoteVal] = useState("");
  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Reconciliation Period & CSV Export State (P0-08)
  const [reconcileFrom, setReconcileFrom] = useState("");
  const [reconcileTo, setReconcileTo] = useState("");
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [roleFeedback, setRoleFeedback] = useState<string | null>(null);

  // SKU Inventory Modal State (P0-1)
  const [skuProduct, setSkuProduct] = useState<Product | null>(null);
  const [skuList, setSkuList] = useState<ProductSku[]>([]);
  const [isLoadingSkus, setIsLoadingSkus] = useState(false);
  const [skuFinishVal, setSkuFinishVal] = useState("titanium");
  const [skuSizeVal, setSkuSizeVal] = useState("52-18-145");
  const [skuSupplierVal, setSkuSupplierVal] = useState("");
  const [skuOnHandVal, setSkuOnHandVal] = useState<number>(10);
  const [skuStatusVal, setSkuStatusVal] = useState("AVAILABLE");
  const [skuRestockEtaVal, setSkuRestockEtaVal] = useState("");
  const [skuUnitCostVal, setSkuUnitCostVal] = useState("");
  const [isSavingSku, setIsSavingSku] = useState(false);
  const [skuError, setSkuError] = useState<string | null>(null);

  // Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Product Form State
  const [prodNameEn, setProdNameEn] = useState("");
  const [prodNameZh, setProdNameZh] = useState("");
  const [prodMaterialEn, setProdMaterialEn] = useState("");
  const [prodMaterialZh, setProdMaterialZh] = useState("");
  const [prodBasePrice, setProdBasePrice] = useState<number>(0);
  const [prodImageUrl, setProdImageUrl] = useState("");
  const [prodShape, setProdShape] = useState("ROUND");
  const [prodSpecsSize, setProdSpecsSize] = useState("52-18-145");
  const [prodDetailImages, setProdDetailImages] = useState("");
  const [prodStockQuantity, setProdStockQuantity] = useState<number>(50);
  const [prodSalesStatus, setProdSalesStatus] = useState<string>("AVAILABLE");
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);

  // After-Sales Tickets State (including P0-07 receipt, disposition, evidence & cost controls)
  const [tickets, setTickets] = useState<AfterSalesTicket[]>([]);
  const [isTicketsLoading, setIsTicketsLoading] = useState(false);
  const [ticketsPage, setTicketsPage] = useState(0);
  const [ticketsTotalPages, setTicketsTotalPages] = useState(1);
  const [editingTicket, setEditingTicket] = useState<AfterSalesTicket | null>(null);
  const [ticketStatusVal, setTicketStatusVal] = useState("IN_PROGRESS");
  const [ticketAssigneeVal, setTicketAssigneeVal] = useState("");
  const [ticketResolutionVal, setTicketResolutionVal] = useState("");
  const [ticketReturnCarrierVal, setTicketReturnCarrierVal] = useState("");
  const [ticketReturnTrackingVal, setTicketReturnTrackingVal] = useState("");
  const [ticketReturnReceivedChecked, setTicketReturnReceivedChecked] = useState(false);
  const [ticketReturnQcVal, setTicketReturnQcVal] = useState("PENDING");
  const [ticketReturnQcNoteVal, setTicketReturnQcNoteVal] = useState("");
  const [ticketReturnDispositionVal, setTicketReturnDispositionVal] = useState("PENDING_REVIEW");
  const [ticketReturnEvidenceVal, setTicketReturnEvidenceVal] = useState("");
  const [ticketRemakeOrderVal, setTicketRemakeOrderVal] = useState("");
  const [ticketRemakeCarrierVal, setTicketRemakeCarrierVal] = useState("");
  const [ticketRemakeTrackingVal, setTicketRemakeTrackingVal] = useState("");
  const [ticketRemakeCostVal, setTicketRemakeCostVal] = useState("");
  const [ticketReturnShippingCostVal, setTicketReturnShippingCostVal] = useState("");
  const [ticketRootCauseVal, setTicketRootCauseVal] = useState("");
  const [ticketRefundAmountVal, setTicketRefundAmountVal] = useState("");
  const [ticketRefundTxVal, setTicketRefundTxVal] = useState("");
  const [ticketActionMsg, setTicketActionMsg] = useState<string | null>(null);
  const [ticketActionErr, setTicketActionErr] = useState<string | null>(null);
  const [isSavingTicket, setIsSavingTicket] = useState(false);

  // Users State
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(0);
  const [usersTotalPages, setUsersTotalPages] = useState(1);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(0);
  const [auditTotalPages, setAuditTotalPages] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(orderSearch.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [orderSearch]);

  useEffect(() => {
    if (!canToggleKillSwitch) return;
    adminFetchCheckoutSetting()
      .then(setCheckoutSetting)
      .catch(() => {
        // ignore
      });
  }, [canToggleKillSwitch]);

  const refreshAlerts = useCallback(async () => {
    try {
      const data = await adminFetchAlerts();
      setAlertsSummary(data);
    } catch {
      // non-fatal alert banner refresh
    }
  }, []);

  useEffect(() => {
    void refreshAlerts();
  }, [refreshAlerts]);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters: { status?: string; fulfillmentStatus?: string; search?: string; overdueOnly?: boolean } = {};
      if (debouncedSearch) filters.search = debouncedSearch;
      if (orderQueueFilter === "AWAITING_REVIEW" || orderQueueFilter === "QUOTE_READY") {
        filters.status = orderQueueFilter;
      } else if (orderQueueFilter === "OVERDUE") {
        filters.overdueOnly = true;
      } else if (orderQueueFilter === "PENDING_REVIEW") {
        filters.status = "PAID";
        filters.fulfillmentStatus = "PENDING_REVIEW";
      } else if (
        orderQueueFilter === "NEEDS_INFO" ||
        orderQueueFilter === "IN_PRODUCTION" ||
        orderQueueFilter === "QC_PASSED"
      ) {
        filters.fulfillmentStatus = orderQueueFilter;
      } else if (
        orderQueueFilter === "REFUND_PENDING" ||
        orderQueueFilter === "SHIPPED" ||
        orderQueueFilter === "DELIVERED"
      ) {
        filters.status = orderQueueFilter;
      }

      if (canViewStats) {
        const [ordersData, statsData] = await Promise.all([
          adminFetchOrders(page, 20, filters),
          reconcileFrom || reconcileTo
            ? adminFetchStats(reconcileFrom || undefined, reconcileTo || undefined)
            : adminFetchStats(),
        ]);
        setOrders(ordersData.content);
        setTotalPages(Math.max(1, ordersData.totalPages));
        setStats(statsData);
      } else {
        const ordersData = await adminFetchOrders(page, 20, filters);
        setOrders(ordersData.content);
        setTotalPages(Math.max(1, ordersData.totalPages));
        setStats(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, orderQueueFilter, reconcileFrom, reconcileTo, canViewStats]);

  const refreshStats = useCallback(async () => {
    if (!canViewStats) return;
    try {
      const statsData =
        reconcileFrom || reconcileTo
          ? await adminFetchStats(reconcileFrom || undefined, reconcileTo || undefined)
          : await adminFetchStats();
      setStats(statsData);
    } catch {
      // non-fatal background stats refresh
    }
  }, [reconcileFrom, reconcileTo, canViewStats]);

  const loadProducts = useCallback(async () => {
    if (!canViewProducts) return;
    setIsProductsLoading(true);
    setError(null);
    try {
      const data = await adminFetchProducts();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products.");
    } finally {
      setIsProductsLoading(false);
    }
  }, [canViewProducts]);

  const loadTickets = useCallback(async () => {
    if (!canViewAfterSales) return;
    setIsTicketsLoading(true);
    setError(null);
    try {
      const data = await adminFetchAfterSalesTickets(undefined, ticketsPage, 20);
      setTickets(data.content);
      setTicketsTotalPages(Math.max(1, data.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load after-sales tickets.");
    } finally {
      setIsTicketsLoading(false);
    }
  }, [ticketsPage, canViewAfterSales]);

  const loadNotifications = useCallback(async () => {
    if (!canViewNotifications) return;
    setIsNotifLoading(true);
    setError(null);
    try {
      const data = await adminFetchNotifications(notifStatusFilter || undefined, notifPage, 20);
      setNotifications(data.content);
      setNotifTotalPages(Math.max(1, data.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email notifications.");
    } finally {
      setIsNotifLoading(false);
    }
  }, [notifStatusFilter, notifPage, canViewNotifications]);

  const loadUsers = useCallback(async () => {
    if (!canViewUsers) return;
    setIsUsersLoading(true);
    setError(null);
    try {
      const usersData = await adminFetchUsers(usersPage, 20);
      setUsersList(usersData.content);
      setUsersTotalPages(Math.max(1, usersData.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setIsUsersLoading(false);
    }
  }, [usersPage, canViewUsers]);

  const loadAuditLogs = useCallback(async () => {
    if (!canViewAuditLogs) return;
    setIsAuditLoading(true);
    setError(null);
    try {
      const data = await adminFetchAuditLogs(auditPage, 30);
      setAuditLogs(data.content);
      setAuditTotalPages(Math.max(1, data.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs.");
    } finally {
      setIsAuditLoading(false);
    }
  }, [auditPage, canViewAuditLogs]);

  useEffect(() => {
    if (activeTab === "orders") {
      void loadDashboardData();
    } else if (activeTab === "products") {
      void loadProducts();
    } else if (activeTab === "afterSales") {
      void loadTickets();
    } else if (activeTab === "notifications") {
      void loadNotifications();
    } else if (activeTab === "users") {
      void loadUsers();
    } else if (activeTab === "auditLogs") {
      void loadAuditLogs();
    }
  }, [activeTab, loadDashboardData, loadProducts, loadTickets, loadNotifications, loadUsers, loadAuditLogs]);

  function handleJumpToAlert(alertKey: string) {
    if (alertKey === "AWAITING_REVIEW") {
      setActiveTab("orders");
      setOrderQueueFilter("AWAITING_REVIEW");
      setPage(0);
    } else if (alertKey === "EXPIRED_HOLDS") {
      setActiveTab("orders");
      setOrderQueueFilter("OVERDUE");
      setPage(0);
    } else if (alertKey === "DELAYED_DELIVERY") {
      setActiveTab("orders");
      setOrderQueueFilter("SHIPPED");
      setPage(0);
    } else if (alertKey === "UNRESOLVED_REFUNDS") {
      setActiveTab("orders");
      setOrderQueueFilter("REFUND_PENDING");
      setPage(0);
    } else if (alertKey === "FAILED_EMAILS" && canViewNotifications) {
      setNotifStatusFilter("FAILED");
      setNotifPage(0);
      setActiveTab("notifications");
    } else if (alertKey === "OVERDUE_AFTER_SALES" && canViewAfterSales) {
      setActiveTab("afterSales");
    }
  }

  async function handleResendNotification(id: number) {
    if (resendingNotifId !== null) return;
    setResendingNotifId(id);
    setNotifFeedback(null);
    setError(null);
    try {
      const updated = await adminResendNotification(id);
      setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setNotifFeedback(t("notifResendSuccess", { id }));
      void refreshAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend notification.");
    } finally {
      setResendingNotifId(null);
    }
  }

  async function handleToggleCheckoutKillSwitch() {
    if (isTogglingCheckout) return;
    const nextEnabled = !checkoutSetting.checkoutEnabled;
    let reason = "";
    if (!nextEnabled) {
      const prompted = window.prompt(t("pauseReasonPrompt"), checkoutSetting.pauseReason || "");
      if (prompted === null) return;
      reason = prompted.trim();
    }
    setIsTogglingCheckout(true);
    try {
      const updated = await adminUpdateCheckoutSetting(nextEnabled, reason);
      setCheckoutSetting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update checkout setting.");
    } finally {
      setIsTogglingCheckout(false);
    }
  }

  async function handleCancel(orderNumber: string, isPaidOrder = false) {
    const confirmMessage = isPaidOrder
      ? t("refundCancelOrderConfirm", { orderNumber })
      : t("cancelOrderConfirm", { orderNumber });
    if (window.confirm(confirmMessage)) {
      try {
        await adminCancelOrder(orderNumber);
        void loadDashboardData();
        void refreshAlerts();
      } catch (err) {
        const fallbackMsg = t("cancelOrderPendingCheck");
        window.alert(err instanceof Error && err.message ? err.message : fallbackMsg);
        void loadDashboardData();
      }
    }
  }

  function handleOpenDeliverModal(orderNumber: string) {
    setDeliverOrderNum(orderNumber);
    setDeliverAtVal("");
    setDeliverError(null);
  }

  async function handleDeliverSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deliverOrderNum || isSubmittingDeliver) return;
    setIsSubmittingDeliver(true);
    setDeliverError(null);
    try {
      await adminDeliverOrder(
        deliverOrderNum,
        deliverAtVal.trim() ? normalizeDateTimeLocal(deliverAtVal) : undefined
      );
      setDeliverOrderNum(null);
      void loadDashboardData();
      void refreshAlerts();
    } catch (err) {
      setDeliverError(err instanceof Error ? err.message : "Failed to mark order delivered.");
    } finally {
      setIsSubmittingDeliver(false);
    }
  }

  function handleOpenAddressModal(orderNumber: string) {
    setAddressOrderNum(orderNumber);
    setAddrProvinceVal("");
    setAddrCityVal("");
    setAddrDistrictVal("");
    setAddrDetailVal("");
    setAddrFullVal("");
    setAddrPhoneVal("");
    setAddressError(null);
    void adminFetchOrderDetail(orderNumber)
      .then((detail) => {
        setAddrProvinceVal(detail.shippingProvince || "");
        setAddrCityVal(detail.shippingCity || "");
        setAddrDistrictVal(detail.shippingDistrict || "");
        setAddrDetailVal(detail.shippingDetailAddress || "");
        setAddrFullVal(detail.shippingAddress || "");
        setAddrPhoneVal(detail.customerPhone || "");
      })
      .catch(() => {
        /* non-fatal */
      });
  }

  async function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!addressOrderNum || isSavingAddress) return;
    const composed =
      addrFullVal.trim() ||
      [addrProvinceVal, addrCityVal, addrDistrictVal, addrDetailVal]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" ");
    if (!composed) return;
    setIsSavingAddress(true);
    setAddressError(null);
    try {
      await adminUpdateOrderAddress(addressOrderNum, composed, addrPhoneVal.trim() || undefined, {
        province: addrProvinceVal.trim() || undefined,
        city: addrCityVal.trim() || undefined,
        district: addrDistrictVal.trim() || undefined,
        detailAddress: addrDetailVal.trim() || undefined,
      });
      setAddressOrderNum(null);
      void loadDashboardData();
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : "Failed to update shipping address.");
    } finally {
      setIsSavingAddress(false);
    }
  }

  function handleOpenShip(orderNumber: string) {
    setShipDialogMode("ship");
    setShippingOrderNum(orderNumber);
    setCarrier(t("defaultCarrier"));
    setTrackingNumber("");
    setTrackingCorrectionNote("");
    setShipError(null);
  }

  function handleOpenUpdateTracking(orderNumber: string) {
    setShipDialogMode("updateTracking");
    setShippingOrderNum(orderNumber);
    setCarrier(t("defaultCarrier"));
    setTrackingNumber("");
    setTrackingCorrectionNote("");
    setShipError(null);
    void adminFetchOrderDetail(orderNumber)
      .then((detail) => {
        if (detail.carrier) setCarrier(detail.carrier);
        if (detail.trackingNumber) setTrackingNumber(detail.trackingNumber);
      })
      .catch(() => {
        /* non-fatal */
      });
  }

  async function handleShipSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shippingOrderNum) return;
    if (!carrier.trim() || !trackingNumber.trim()) {
      setShipError(t("shipErrorRequired"));
      return;
    }

    setIsSubmittingShip(true);
    setShipError(null);
    try {
      if (shipDialogMode === "updateTracking") {
        await adminUpdateTracking(shippingOrderNum, {
          carrier: carrier.trim(),
          trackingNumber: trackingNumber.trim(),
          note: trackingCorrectionNote.trim() || undefined,
        });
      } else {
        await adminShipOrder(shippingOrderNum, carrier.trim(), trackingNumber.trim());
      }
      setShippingOrderNum(null);
      void loadDashboardData();
    } catch (err) {
      setShipError(err instanceof Error ? err.message : "Failed to ship order.");
    } finally {
      setIsSubmittingShip(false);
    }
  }

  function handleOpenFulfillment(order: OrderSummary) {
    setFulfillmentOrderNum(order.orderNumber);
    setFulfillmentStatusVal(
      order.fulfillmentStatus && FULFILLMENT_EDIT_OPTIONS.includes(order.fulfillmentStatus as (typeof FULFILLMENT_EDIT_OPTIONS)[number])
        ? order.fulfillmentStatus
        : "IN_PRODUCTION"
    );
    setFulfillmentNoteVal("");
    setEstimatedDeliveryVal("");
    setDeliveryDelayReasonVal("");
    setOpticianVerifiedVal(false);
    setQcStatusVal("PENDING");
    setQcNoteVal("");
    setOrderSourceVal("");
    setVariableCostVal("");
    setShowRxRevision(false);
    setRxSphOdVal("0");
    setRxSphOsVal("0");
    setRxCylOdVal("0");
    setRxCylOsVal("0");
    setRxAxisOdVal("0");
    setRxAxisOsVal("0");
    setRxPdVal("63");
    setRxRevisionNoteVal("");
    setRxRevisionFeedback(null);
    setFulfillmentError(null);

    void adminFetchOrderDetail(order.orderNumber)
      .then((detail) => {
        setFulfillmentOrderNum((current) => {
          if (current !== order.orderNumber) return current;
          if (
            detail.fulfillmentStatus &&
            FULFILLMENT_EDIT_OPTIONS.includes(detail.fulfillmentStatus as (typeof FULFILLMENT_EDIT_OPTIONS)[number])
          ) {
            setFulfillmentStatusVal(detail.fulfillmentStatus);
          }
          setFulfillmentNoteVal(detail.fulfillmentNote || "");
          setEstimatedDeliveryVal(detail.estimatedDeliveryDate || "");
          setDeliveryDelayReasonVal(detail.deliveryDelayReason || "");
          setOpticianVerifiedVal(Boolean(detail.opticianVerifiedAt));
          setQcStatusVal(detail.qcStatus || "PENDING");
          setQcNoteVal(detail.qcNote || "");
          setOrderSourceVal(detail.orderSource || "");
          setVariableCostVal(detail.variableCostAmount != null ? String(detail.variableCostAmount) : "");
          if (detail.prescription) {
            setRxSphOdVal(String(detail.prescription.sphOd));
            setRxSphOsVal(String(detail.prescription.sphOs));
            setRxCylOdVal(String(detail.prescription.cylOd));
            setRxCylOsVal(String(detail.prescription.cylOs));
            setRxAxisOdVal(String(detail.prescription.axisOd));
            setRxAxisOsVal(String(detail.prescription.axisOs));
            setRxPdVal(String(detail.prescription.pd));
          }
          return current;
        });
      })
      .catch(() => {
        // Non-fatal; admin can still edit fields directly
      });
  }

  async function handleReviseRxSubmit() {
    if (!fulfillmentOrderNum || isSavingFulfillment) return;
    setIsSavingFulfillment(true);
    setFulfillmentError(null);
    setRxRevisionFeedback(null);
    try {
      const updated = await adminReviseOrderPrescription(
        fulfillmentOrderNum,
        {
          sphOd: Number(rxSphOdVal) || 0,
          sphOs: Number(rxSphOsVal) || 0,
          cylOd: Number(rxCylOdVal) || 0,
          cylOs: Number(rxCylOsVal) || 0,
          axisOd: Math.round(Number(rxAxisOdVal) || 0),
          axisOs: Math.round(Number(rxAxisOsVal) || 0),
          pd: Number(rxPdVal) || 63,
        },
        rxRevisionNoteVal.trim() || undefined
      );
      setOpticianVerifiedVal(false);
      if (updated.fulfillmentStatus) setFulfillmentStatusVal(updated.fulfillmentStatus);
      setRxRevisionFeedback(t("reviseRxSuccess", { version: updated.prescriptionVersion ?? 2 }));
      void loadDashboardData();
    } catch (err) {
      setFulfillmentError(err instanceof Error ? err.message : "Failed to revise order prescription.");
    } finally {
      setIsSavingFulfillment(false);
    }
  }

  async function handleFulfillmentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fulfillmentOrderNum) return;
    setIsSavingFulfillment(true);
    setFulfillmentError(null);
    try {
      await adminUpdateFulfillment(fulfillmentOrderNum, {
        fulfillmentStatus: fulfillmentStatusVal,
        fulfillmentNote: fulfillmentNoteVal.trim() || undefined,
        estimatedDeliveryDate: estimatedDeliveryVal || undefined,
        deliveryDelayReason: deliveryDelayReasonVal.trim() || undefined,
        opticianVerified: opticianVerifiedVal || undefined,
        qcStatus: qcStatusVal || undefined,
        qcNote: qcNoteVal.trim() || undefined,
      });
      if (canFinance && (orderSourceVal.trim() || variableCostVal.trim())) {
        await adminUpdateOrderEconomics(fulfillmentOrderNum, {
          orderSource: orderSourceVal.trim() || undefined,
          variableCostAmount: variableCostVal.trim() ? Number(variableCostVal) : undefined,
        });
      }
      setFulfillmentOrderNum(null);
      void loadDashboardData();
      void refreshAlerts();
    } catch (err) {
      setFulfillmentError(err instanceof Error ? err.message : "Failed to update fulfillment.");
    } finally {
      setIsSavingFulfillment(false);
    }
  }

  async function handleQuickStageAction(action: "verify" | "produce" | "qc_pass" | "qc_fail") {
    if (!fulfillmentOrderNum || isSavingFulfillment) return;
    setIsSavingFulfillment(true);
    setFulfillmentError(null);
    try {
      let updated: OrderDetailResponse;
      if (action === "verify") {
        updated = await adminVerifyOptician(fulfillmentOrderNum, fulfillmentNoteVal.trim() || undefined);
      } else if (action === "produce") {
        updated = await adminStartProduction(fulfillmentOrderNum, {
          estimatedDeliveryDate: estimatedDeliveryVal || undefined,
          note: fulfillmentNoteVal.trim() || undefined,
        });
      } else if (action === "qc_pass") {
        updated = await adminRecordQcResult(fulfillmentOrderNum, {
          qcStatus: "PASSED",
          qcNote: qcNoteVal.trim() || undefined,
        });
      } else {
        updated = await adminRecordQcResult(fulfillmentOrderNum, {
          qcStatus: "FAILED",
          qcNote: qcNoteVal.trim() || undefined,
        });
      }
      if (updated.fulfillmentStatus) setFulfillmentStatusVal(updated.fulfillmentStatus);
      setOpticianVerifiedVal(Boolean(updated.opticianVerifiedAt));
      if (updated.qcStatus) setQcStatusVal(updated.qcStatus);
      void loadDashboardData();
      void refreshAlerts();
    } catch (err) {
      setFulfillmentError(err instanceof Error ? err.message : "Stage transition failed.");
    } finally {
      setIsSavingFulfillment(false);
    }
  }

  function handleOpenQuoteModal(order: OrderSummary) {
    setQuoteOrderNum(order.orderNumber);
    setQuoteOrderDetail(null);
    setQuoteLensTypesVal([]);
    setQuoteExpiresAtVal("");
    setQuoteRevisedAmountVal(String(order.totalAmount));
    setQuotePromisedDateVal("");
    setQuoteTargetFinishVal("");
    setQuoteTargetSizeVal("");
    setQuoteChangeSummaryVal("");
    setQuoteNoteVal("");
    setQuoteError(null);
    void fetchLensOptions()
      .then(setAvailableLensOptions)
      .catch(() => {
        /* non-fatal */
      });
    void adminFetchOrderDetail(order.orderNumber)
      .then((detail) => {
        setQuoteOrderDetail(detail);
        setQuoteRevisedAmountVal(String(detail.quoteRevisedAmount ?? detail.totalAmount));
        if (detail.estimatedDeliveryDate) setQuotePromisedDateVal(detail.estimatedDeliveryDate);
        if (detail.finishId) setQuoteTargetFinishVal(detail.finishId);
        if (detail.sizeSpecSnapshot) setQuoteTargetSizeVal(detail.sizeSpecSnapshot);
        if (detail.quoteNote) setQuoteNoteVal(detail.quoteNote);
        if (detail.lensOptions) setQuoteLensTypesVal(detail.lensOptions.map((l) => l.type));
        if (detail.quoteExpiresAt) setQuoteExpiresAtVal(detail.quoteExpiresAt.slice(0, 16));
      })
      .catch(() => {
        /* non-fatal */
      });
  }

  async function handleQuoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quoteOrderNum) return;
    setIsSavingQuote(true);
    setQuoteError(null);
    try {
      await adminConfirmPrepayQuote(quoteOrderNum, {
        revisedTotalAmount: quoteRevisedAmountVal.trim() ? Number(quoteRevisedAmountVal) : undefined,
        estimatedDeliveryDate: quotePromisedDateVal || undefined,
        quoteNote: quoteNoteVal.trim() || undefined,
        targetFinishId: quoteTargetFinishVal.trim() || undefined,
        targetSizeSpec: quoteTargetSizeVal.trim() || undefined,
        revisedLensOptionTypes: quoteLensTypesVal.length > 0 ? quoteLensTypesVal : undefined,
        quoteExpiresAt: quoteExpiresAtVal.trim() ? normalizeDateTimeLocal(quoteExpiresAtVal) : undefined,
        changeSummary: quoteChangeSummaryVal.trim() || undefined,
      });
      setQuoteOrderNum(null);
      setQuoteOrderDetail(null);
      void loadDashboardData();
      void refreshAlerts();
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : "Failed to confirm pre-payment quote.");
    } finally {
      setIsSavingQuote(false);
    }
  }

  async function handleExportReconciliation() {
    if (isExportingCsv) return;
    setIsExportingCsv(true);
    try {
      await adminDownloadReconciliationCsv(reconcileFrom || undefined, reconcileTo || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export reconciliation CSV.");
    } finally {
      setIsExportingCsv(false);
    }
  }

  async function handleOpenSkuModal(prod: Product) {
    setSkuProduct(prod);
    setSkuFinishVal(prod.arConfigs?.[0]?.id || "titanium");
    setSkuSizeVal(prod.specsSize || "52-18-145");
    setSkuSupplierVal("");
    setSkuOnHandVal(10);
    setSkuStatusVal("AVAILABLE");
    setSkuRestockEtaVal("");
    setSkuUnitCostVal("");
    setSkuError(null);
    setIsLoadingSkus(true);
    try {
      const list = await adminFetchProductSkus(prod.id);
      setSkuList(list);
    } catch (err) {
      setSkuError(err instanceof Error ? err.message : "Failed to load SKUs.");
      setSkuList([]);
    } finally {
      setIsLoadingSkus(false);
    }
  }

  async function handleSaveSku(e: React.FormEvent) {
    e.preventDefault();
    if (!skuProduct) return;
    setIsSavingSku(true);
    setSkuError(null);
    try {
      await adminUpsertProductSku(skuProduct.id, {
        finishId: skuFinishVal.trim(),
        sizeSpec: skuSizeVal.trim(),
        supplierName: skuSupplierVal.trim() || undefined,
        onHandQty: Math.max(0, Number(skuOnHandVal) || 0),
        salesStatus: skuStatusVal,
        restockEta: skuRestockEtaVal || null,
        unitCost: skuUnitCostVal.trim() ? Number(skuUnitCostVal) : null,
      });
      const updatedList = await adminFetchProductSkus(skuProduct.id);
      setSkuList(updatedList);
      void loadProducts();
    } catch (err) {
      setSkuError(err instanceof Error ? err.message : "Failed to save SKU.");
    } finally {
      setIsSavingSku(false);
    }
  }

  async function handleVerifyStocktakeSku() {
    if (!skuProduct || isSavingSku) return;
    setIsSavingSku(true);
    setSkuError(null);
    try {
      await adminImportStocktake([
        {
          productId: skuProduct.id,
          finishId: skuFinishVal.trim(),
          sizeSpec: skuSizeVal.trim(),
          countedOnHandQty: Math.max(0, Number(skuOnHandVal) || 0),
          supplierName: skuSupplierVal.trim() || undefined,
          unitCost: skuUnitCostVal.trim() ? Number(skuUnitCostVal) : null,
          salesStatus: skuStatusVal,
          restockEta: skuRestockEtaVal || null,
        },
      ]);
      const updatedList = await adminFetchProductSkus(skuProduct.id);
      setSkuList(updatedList);
      void loadProducts();
    } catch (err) {
      setSkuError(err instanceof Error ? err.message : "Failed to record physical stocktake.");
    } finally {
      setIsSavingSku(false);
    }
  }

  // Product Actions
  function handleOpenCreateProduct() {
    setEditingProduct(null);
    setProdNameEn("");
    setProdNameZh("");
    setProdMaterialEn("");
    setProdMaterialZh("");
    setProdBasePrice(0);
    setProdImageUrl("");
    setProdShape("ROUND");
    setProdSpecsSize("52-18-145");
    setProdDetailImages("");
    setProdStockQuantity(50);
    setProdSalesStatus("AVAILABLE");
    setProdError(null);
    setIsProductModalOpen(true);
  }

  function handleOpenEditProduct(p: Product) {
    setEditingProduct(p);
    setProdNameEn(p.nameEn);
    setProdNameZh(p.nameZh);
    setProdMaterialEn(p.materialEn);
    setProdMaterialZh(p.materialZh);
    setProdBasePrice(p.basePrice);
    setProdImageUrl(p.imageUrl);
    setProdShape(p.shape || "ROUND");
    setProdSpecsSize(p.specsSize || "52-18-145");
    setProdDetailImages(p.detailImages || "");
    setProdStockQuantity(p.stockQuantity ?? 50);
    setProdSalesStatus(p.salesStatus || "AVAILABLE");
    setProdError(null);
    setIsProductModalOpen(true);
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!prodNameEn.trim() || !prodNameZh.trim() || !prodMaterialEn.trim() || !prodMaterialZh.trim() || !prodImageUrl.trim()) {
      setProdError(t("productErrorRequiredFields"));
      return;
    }
    if (prodBasePrice <= 0) {
      setProdError(t("productErrorPricePositive"));
      return;
    }

    setIsSavingProduct(true);
    setProdError(null);
    try {
      const payload = {
        nameEn: prodNameEn.trim(),
        nameZh: prodNameZh.trim(),
        materialEn: prodMaterialEn.trim(),
        materialZh: prodMaterialZh.trim(),
        basePrice: prodBasePrice,
        imageUrl: prodImageUrl.trim(),
        shape: prodShape,
        specsSize: prodSpecsSize,
        detailImages: prodDetailImages.trim() || null,
        stockQuantity: Math.max(0, Number(prodStockQuantity) || 0),
        salesStatus: prodSalesStatus,
      };

      if (editingProduct) {
        await adminUpdateProduct(editingProduct.id, payload);
      } else {
        await adminCreateProduct(payload);
      }
      setIsProductModalOpen(false);
      void loadProducts();
    } catch (err) {
      setProdError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handleDeleteProduct(id: number) {
    if (window.confirm(t("deleteProductConfirm"))) {
      try {
        await adminDeleteProduct(id);
        void loadProducts();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Failed to delete product.");
      }
    }
  }

  function handleOpenTicketModal(tk: AfterSalesTicket) {
    setEditingTicket(tk);
    setTicketStatusVal(tk.status || "IN_PROGRESS");
    setTicketAssigneeVal(tk.assignee || "");
    setTicketResolutionVal(tk.resolutionNote || "");
    setTicketReturnCarrierVal(tk.returnCarrier || "");
    setTicketReturnTrackingVal(tk.returnTrackingNumber || "");
    setTicketReturnReceivedChecked(Boolean(tk.returnReceivedAt));
    setTicketReturnQcVal(tk.returnQcResult || "PENDING");
    setTicketReturnQcNoteVal(tk.returnQcNote || "");
    setTicketReturnDispositionVal(tk.returnDisposition || "PENDING_REVIEW");
    setTicketReturnEvidenceVal(tk.returnEvidenceNote || "");
    setTicketRemakeOrderVal(tk.remakeOrderNumber || "");
    setTicketRemakeCarrierVal(tk.remakeCarrier || "");
    setTicketRemakeTrackingVal(tk.remakeTrackingNumber || "");
    setTicketRemakeCostVal(tk.remakeCostAmount != null ? String(tk.remakeCostAmount) : "");
    setTicketReturnShippingCostVal(tk.returnShippingCost != null ? String(tk.returnShippingCost) : "");
    setTicketRootCauseVal(tk.rootCause || "");
    setTicketRefundAmountVal(tk.refundAmount ? String(tk.refundAmount) : "");
    setTicketRefundTxVal(tk.refundTransactionId || "");
    setTicketActionMsg(null);
    setTicketActionErr(null);
  }

  async function handleSaveTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTicket) return;
    setIsSavingTicket(true);
    setTicketActionErr(null);
    setTicketActionMsg(null);
    try {
      const receiptTimestamp =
        editingTicket.returnReceivedAt ||
        (ticketReturnReceivedChecked ? new Date().toISOString().slice(0, 19) : undefined);
      await adminUpdateAfterSalesTicket(editingTicket.ticketNumber, {
        status: ticketStatusVal,
        assignee: ticketAssigneeVal.trim() || undefined,
        resolutionNote: ticketResolutionVal.trim() || undefined,
        returnCarrier: ticketReturnCarrierVal.trim() || undefined,
        returnTrackingNumber: ticketReturnTrackingVal.trim() || undefined,
        returnReceivedAt: receiptTimestamp,
        returnQcResult: ticketReturnQcVal || undefined,
        returnQcNote: ticketReturnQcNoteVal.trim() || undefined,
        returnDisposition: ticketReturnDispositionVal || undefined,
        returnEvidenceNote: ticketReturnEvidenceVal.trim() || undefined,
        remakeOrderNumber: ticketRemakeOrderVal.trim() || undefined,
        remakeCarrier: ticketRemakeCarrierVal.trim() || undefined,
        remakeTrackingNumber: ticketRemakeTrackingVal.trim() || undefined,
        remakeCostAmount: ticketRemakeCostVal.trim() ? Number(ticketRemakeCostVal) : undefined,
        returnShippingCost: ticketReturnShippingCostVal.trim() ? Number(ticketReturnShippingCostVal) : undefined,
        rootCause: ticketRootCauseVal || undefined,
      });
      setEditingTicket(null);
      void loadTickets();
      void refreshStats();
      void refreshAlerts();
    } catch (err) {
      setTicketActionErr(err instanceof Error ? err.message : "Failed to update ticket.");
    } finally {
      setIsSavingTicket(false);
    }
  }

  async function handleRestockTicket() {
    if (!editingTicket || isSavingTicket) return;
    setIsSavingTicket(true);
    setTicketActionErr(null);
    setTicketActionMsg(null);
    try {
      const needsReceiptSync = !editingTicket.returnReceivedAt && ticketReturnReceivedChecked;
      const needsQcSync = editingTicket.returnQcResult !== "RESTOCKABLE" && ticketReturnQcVal === "RESTOCKABLE";
      if (needsReceiptSync || needsQcSync) {
        await adminUpdateAfterSalesTicket(editingTicket.ticketNumber, {
          status: ticketStatusVal,
          returnCarrier: ticketReturnCarrierVal.trim() || undefined,
          returnTrackingNumber: ticketReturnTrackingVal.trim() || undefined,
          returnReceivedAt:
            editingTicket.returnReceivedAt ||
            (ticketReturnReceivedChecked ? new Date().toISOString().slice(0, 19) : undefined),
          returnQcResult: "RESTOCKABLE",
          returnQcNote: ticketReturnQcNoteVal.trim() || undefined,
          returnDisposition: ticketReturnDispositionVal === "PENDING_REVIEW" ? "RESTOCK" : ticketReturnDispositionVal,
          returnEvidenceNote: ticketReturnEvidenceVal.trim() || undefined,
          rootCause: ticketRootCauseVal || undefined,
        });
      }
      const updated = await adminRestockAfterSalesTicket(editingTicket.ticketNumber);
      setEditingTicket(updated);
      setTicketActionMsg(t("ticketActionSuccess"));
      void loadTickets();
      void loadProducts();
      void refreshStats();
      void refreshAlerts();
    } catch (err) {
      setTicketActionErr(err instanceof Error ? err.message : "Failed to restock returned item.");
    } finally {
      setIsSavingTicket(false);
    }
  }

  async function handleRefundTicket() {
    if (!editingTicket || isSavingTicket || !ticketRefundAmountVal.trim()) return;
    setIsSavingTicket(true);
    setTicketActionErr(null);
    setTicketActionMsg(null);
    try {
      const updated = await adminRefundAfterSalesTicket(editingTicket.ticketNumber, {
        refundAmount: Number(ticketRefundAmountVal),
        refundReason: ticketResolutionVal.trim() || undefined,
        refundTransactionId: ticketRefundTxVal.trim() || undefined,
      });
      setEditingTicket(updated);
      setTicketActionMsg(t("ticketActionSuccess"));
      void loadTickets();
      void loadDashboardData();
      void refreshStats();
    } catch (err) {
      setTicketActionErr(err instanceof Error ? err.message : "Failed to execute after-sales refund.");
    } finally {
      setIsSavingTicket(false);
    }
  }

  async function handleFinanceVerifyTicket() {
    if (!editingTicket || isSavingTicket) return;
    const txRef = ticketRefundTxVal.trim() || editingTicket.refundTransactionId?.trim() || "";
    if (!txRef) {
      setTicketActionErr(t("manualVoucherRequiredError"));
      return;
    }
    setIsSavingTicket(true);
    setTicketActionErr(null);
    setTicketActionMsg(null);
    try {
      const updated = await adminFinanceVerifyAfterSalesTicket(editingTicket.ticketNumber, {
        refundTransactionId: txRef,
        note: ticketResolutionVal.trim() || undefined,
      });
      setEditingTicket(updated);
      setTicketActionMsg(t("ticketActionSuccess"));
      void loadTickets();
      void refreshStats();
    } catch (err) {
      setTicketActionErr(err instanceof Error ? err.message : "Failed to verify refund.");
    } finally {
      setIsSavingTicket(false);
    }
  }

  async function handleRetryRefundTx(refundRequestId: string) {
    if (!editingTicket || isSavingTicket) return;
    setIsSavingTicket(true);
    setTicketActionErr(null);
    setTicketActionMsg(null);
    try {
      await adminRetryRefundTransaction(refundRequestId);
      setTicketActionMsg(t("ticketActionSuccess"));
      const refreshed = await adminFetchAfterSalesTickets(undefined, ticketsPage, 20);
      setTickets(refreshed.content);
      const updatedTicket = refreshed.content.find((x) => x.ticketNumber === editingTicket.ticketNumber);
      if (updatedTicket) setEditingTicket(updatedTicket);
      void refreshStats();
    } catch (err) {
      setTicketActionErr(err instanceof Error ? err.message : "Failed to retry refund.");
    } finally {
      setIsSavingTicket(false);
    }
  }

  async function handleManualConfirmRefundTx(tx: RefundTransactionRecord) {
    if (!editingTicket || isSavingTicket) return;
    const voucher = ticketRefundTxVal.trim();
    if (!voucher) {
      setTicketActionErr(t("manualVoucherRequiredError"));
      return;
    }
    setIsSavingTicket(true);
    setTicketActionErr(null);
    setTicketActionMsg(null);
    try {
      await adminManualConfirmRefundTransaction(tx.refundRequestId, {
        confirmedAmount: tx.requestedAmount,
        manualVoucherRef: voucher,
        note: ticketResolutionVal.trim() || undefined,
      });
      setTicketActionMsg(t("ticketActionSuccess"));
      const refreshed = await adminFetchAfterSalesTickets(undefined, ticketsPage, 20);
      setTickets(refreshed.content);
      const updatedTicket = refreshed.content.find((x) => x.ticketNumber === editingTicket.ticketNumber);
      if (updatedTicket) setEditingTicket(updatedTicket);
      void refreshStats();
    } catch (err) {
      setTicketActionErr(err instanceof Error ? err.message : "Failed to confirm refund voucher.");
    } finally {
      setIsSavingTicket(false);
    }
  }

  async function handleRoleChange(userItem: UserProfile, nextRole: string) {
    setRoleFeedback(null);
    try {
      const updated = await adminUpdateUserRole(userItem.id, nextRole);
      setUsersList((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setRoleFeedback(t("roleUpdateSuccess", { email: updated.email, role: roleLabel(updated.role) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user role.");
    }
  }

  const queueFilters: Array<{ id: OrderQueueFilter; label: string }> = [
    { id: "ALL", label: t("filterAll") },
    { id: "AWAITING_REVIEW", label: t("filterAwaitingReview") },
    { id: "QUOTE_READY", label: t("filterQuoteReady") },
    { id: "OVERDUE", label: t("filterOverdue") },
    { id: "PENDING_REVIEW", label: t("filterPendingReview") },
    { id: "NEEDS_INFO", label: t("filterNeedsInfo") },
    { id: "IN_PRODUCTION", label: t("filterInProduction") },
    { id: "QC_PASSED", label: t("filterQcPassed") },
    { id: "REFUND_PENDING", label: t("filterRefundPending") },
    { id: "SHIPPED", label: t("filterShipped") },
    { id: "DELIVERED", label: t("filterDelivered") },
  ];

  const hasAnyModalOpen = Boolean(
    isProductModalOpen ||
      fulfillmentOrderNum ||
      quoteOrderNum ||
      skuProduct ||
      editingTicket ||
      shippingOrderNum ||
      deliverOrderNum ||
      addressOrderNum
  );

  useEffect(() => {
    if (!hasAnyModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (addressOrderNum) setAddressOrderNum(null);
      else if (deliverOrderNum) setDeliverOrderNum(null);
      else if (shippingOrderNum) setShippingOrderNum(null);
      else if (editingTicket) setEditingTicket(null);
      else if (skuProduct) setSkuProduct(null);
      else if (quoteOrderNum) setQuoteOrderNum(null);
      else if (fulfillmentOrderNum) setFulfillmentOrderNum(null);
      else if (isProductModalOpen) setIsProductModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    hasAnyModalOpen,
    addressOrderNum,
    deliverOrderNum,
    shippingOrderNum,
    editingTicket,
    skuProduct,
    quoteOrderNum,
    fulfillmentOrderNum,
    isProductModalOpen,
  ]);

  const roleLabel = (role?: string) => {
    if (!role) return "";
    const key = role.trim().toUpperCase();
    return t("roles." + key, { defaultValue: key });
  };

  const shapeLabel = (shape?: string) => {
    if (!shape) return "—";
    const key = shape.trim().toUpperCase();
    return t("shapes." + key, { defaultValue: shape });
  };

  const orderSourceLabel = (source?: string) => {
    if (!source) return "—";
    const key = source.trim().toUpperCase();
    return t("orderSources." + key, { defaultValue: source });
  };

  const notifEventLabel = (eventType?: string) => {
    if (!eventType) return "—";
    const key = eventType.trim().toUpperCase();
    return t("notifEventTypes." + key, { defaultValue: eventType });
  };

  const notifStatusLabel = (status?: string) => {
    if (!status) return "—";
    const key = status.trim().toUpperCase();
    return t("notifStatuses." + key, { defaultValue: status });
  };

  const resolveEffectiveProductStatus = (prod: Product) => {
    const raw = (prod.salesStatus || "AVAILABLE").toUpperCase();
    if (raw !== "AVAILABLE") return raw;
    if (prod.skus && prod.skus.length > 0) {
      if (prod.skus.every((s) => (s.salesStatus || "").toUpperCase() === "PAUSED")) {
        return "PAUSED";
      }
      const hasOrderableSku = prod.skus.some(
        (s) => (s.salesStatus || "").toUpperCase() === "AVAILABLE" && (s.availableQty ?? 0) > 0
      );
      if (!hasOrderableSku) {
        return "OUT_OF_STOCK";
      }
    } else if ((prod.stockQuantity ?? 0) <= 0) {
      return "OUT_OF_STOCK";
    }
    return "AVAILABLE";
  };

  const salesStatusBadgeClass = (status: string) => {
    switch (status.toUpperCase()) {
      case "AVAILABLE":
        return "bg-emerald-50 text-emerald-700";
      case "PAUSED":
        return "bg-amber-50 text-amber-800";
      case "OUT_OF_STOCK":
        return "bg-red-50 text-red-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const salesStatusLabel = (status?: string) => {
    switch ((status || "AVAILABLE").toUpperCase()) {
      case "OUT_OF_STOCK":
        return t("salesStatusOutOfStock");
      case "PAUSED":
        return t("salesStatusPaused");
      case "ARCHIVED":
        return t("salesStatusArchived");
      default:
        return t("salesStatusAvailable");
    }
  };

  return (
    <div className="flex-1 w-full bg-surface-offwhite px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        <PageIntro
          eyebrow={t("pageEyebrow")}
          title={t("pageTitle")}
          description={t("pageDescription")}
          actions={
            canToggleKillSwitch ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex flex-col gap-2 min-w-64">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400">
                    {t("checkoutSwitchLabel")}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      checkoutSetting.checkoutEnabled
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {checkoutSetting.checkoutEnabled ? t("checkoutEnabledBadge") : t("checkoutPausedBadge")}
                  </span>
                </div>
                {!checkoutSetting.checkoutEnabled && checkoutSetting.pauseReason && (
                  <p className="text-[11px] text-amber-700">{checkoutSetting.pauseReason}</p>
                )}
                <button
                  type="button"
                  disabled={isTogglingCheckout}
                  onClick={handleToggleCheckoutKillSwitch}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                    checkoutSetting.checkoutEnabled
                      ? "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      : "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  {checkoutSetting.checkoutEnabled ? (
                    <>
                      <PauseCircle className="w-3.5 h-3.5" />
                      {t("pauseCheckoutBtn")}
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-3.5 h-3.5" />
                      {t("resumeCheckoutBtn")}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400">
                  {t("roleBadgePrefix")}
                </span>
                <span className="inline-flex items-center rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-[11px] font-mono font-bold text-brand-primary">
                  {staffRole}
                </span>
              </div>
            )
          }
        />

        {error && (
          <SectionCard className="border-red-200 bg-red-50/70" title={t("errorTitle")}>
            <p className="text-sm text-red-700">{error}</p>
          </SectionCard>
        )}

        {/* Operational Alerts Banner (Sec 6 P1) */}
        {alertsSummary && alertsSummary.totalActionable > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">{t("alertsBannerTitle")}</span>
              </div>
              <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-mono font-bold text-amber-900">
                {alertsSummary.totalActionable}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {alertsSummary.alerts
                .filter((a) => a.count > 0)
                .map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleJumpToAlert(item.key)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      item.severity === "CRITICAL"
                        ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
                        : "border-amber-200 bg-white text-amber-800 hover:bg-amber-100/70"
                    }`}
                  >
                    <span>{t("alertKey." + item.key, { defaultValue: item.key })}</span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                      {item.count}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {t("alertsOwnerPrefix")}: {roleLabel(item.ownerRole)}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Stats Summary Cards & Reconciliation Panel (P1) */}
        {stats && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  icon: DollarSign,
                  label: t("netRevenue"),
                  value: formatPrice(stats.netRevenue ?? stats.totalSales),
                  note: `${t("totalRevenue")} ${formatPrice(stats.grossReceipts ?? stats.totalSales)} · ${t("totalRefunded")} ${formatPrice(stats.confirmedRefunded ?? stats.totalRefunded ?? 0)}${
                    (stats.pendingRefundAmount ?? 0) > 0
                      ? ` · ${t("pendingRefundSub", { amount: formatPrice(stats.pendingRefundAmount ?? 0) })}`
                      : ""
                  }`,
                  color: "text-brand-cyan bg-brand-cyan/10",
                },
                {
                  icon: CheckCircle2,
                  label: t("onTimeDeliveryRate"),
                  value: `${stats.onTimeDeliveryMetrics?.onTimeRatePct ?? 0}%`,
                  note: t("onTimeRateSub", {
                    due: stats.onTimeDeliveryMetrics?.dueCount ?? 0,
                    onTime: stats.onTimeDeliveryMetrics?.onTimeDeliveredCount ?? 0,
                    delayed: stats.onTimeDeliveryMetrics?.delayedCount ?? 0,
                    rescheduled: stats.onTimeDeliveryMetrics?.rescheduledCount ?? 0,
                  }),
                  color: "text-emerald-600 bg-emerald-500/10",
                },
                {
                  icon: CreditCard,
                  label: t("netContribution"),
                  value: formatPrice(stats.netContribution ?? stats.netRevenue ?? stats.totalSales),
                  note: t("contributionSub", {
                    cost: formatPrice(stats.totalVariableCost ?? 0),
                    prepay: stats.awaitingPrepayReviewCount ?? 0,
                  }),
                  color: "text-indigo-600 bg-indigo-500/10",
                },
                {
                  icon: ShoppingBag,
                  label: t("totalOrders"),
                  value: stats.totalOrders.toString(),
                  note: `${t("totalCustomers")} ${stats.totalUsers} · ${t("averageTicket")} ${formatPrice(stats.averageOrderValue)}${
                    (stats.expiredHoldCount ?? 0) > 0
                      ? ` · ${t("expiredHoldsSub", { count: stats.expiredHoldCount ?? 0 })}`
                      : ""
                  }`,
                  color: "text-amber-500 bg-amber-500/10",
                },
              ].map((card, idx) => (
                <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      {card.label}
                    </span>
                    <span className="text-xl font-display font-semibold text-brand-primary mt-1 block">
                      {card.value}
                    </span>
                    {card.note && <span className="text-[11px] text-slate-500 block mt-1 leading-snug">{card.note}</span>}
                  </div>
                </div>
              ))}
            </div>

            <SectionCard
              eyebrow={t("reconciliationPanelEyebrow")}
              title={t("reconciliationPanelTitle")}
              description={t("reconciliationPanelDesc")}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span>{t("reconcileFromLabel")}</span>
                    <input
                      type="date"
                      value={reconcileFrom}
                      onChange={(e) => setReconcileFrom(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-brand-primary"
                    />
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span>{t("reconcileToLabel")}</span>
                    <input
                      type="date"
                      value={reconcileTo}
                      onChange={(e) => setReconcileTo(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-brand-primary"
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={isExportingCsv}
                    onClick={handleExportReconciliation}
                    className="rounded-xl"
                  >
                    <Download className="w-4 h-4" />
                    {isExportingCsv ? t("exportingCsv") : t("exportReconciliationCsv")}
                  </Button>
                </div>
              }
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {stats.contributionByProduct && stats.contributionByProduct.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-brand-primary">{t("byProductTitle")}</p>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                          <tr>
                            <th className="px-3 py-2">{t("productCol")}</th>
                            <th className="px-3 py-2">{t("ordersCountCol")}</th>
                            <th className="px-3 py-2">{t("grossCol")}</th>
                            <th className="px-3 py-2">{t("refundCol")}</th>
                            <th className="px-3 py-2">{t("contributionCol")}</th>
                            <th className="px-3 py-2">{t("ticketsCountCol")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stats.contributionByProduct.map((row) => (
                            <tr key={row.key}>
                              <td className="px-3 py-2 font-medium text-brand-primary">{row.key}</td>
                              <td className="px-3 py-2 font-mono">{row.orderCount}</td>
                              <td className="px-3 py-2 font-mono">{formatPrice(row.grossRevenue)}</td>
                              <td className="px-3 py-2 font-mono text-amber-700">{formatPrice(row.refundedAmount)}</td>
                              <td className="px-3 py-2 font-mono font-semibold text-emerald-700">{formatPrice(row.netContribution)}</td>
                              <td className="px-3 py-2 font-mono">{row.ticketCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {stats.contributionBySource && stats.contributionBySource.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-brand-primary">{t("bySourceTitle")}</p>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                          <tr>
                            <th className="px-3 py-2">{t("orderSourceShortLabel")}</th>
                            <th className="px-3 py-2">{t("ordersCountCol")}</th>
                            <th className="px-3 py-2">{t("grossCol")}</th>
                            <th className="px-3 py-2">{t("refundCol")}</th>
                            <th className="px-3 py-2">{t("contributionCol")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stats.contributionBySource.map((row) => (
                            <tr key={row.key}>
                              <td className="px-3 py-2 font-medium text-brand-primary">{orderSourceLabel(row.key)}</td>
                              <td className="px-3 py-2 font-mono">{row.orderCount}</td>
                              <td className="px-3 py-2 font-mono">{formatPrice(row.grossRevenue)}</td>
                              <td className="px-3 py-2 font-mono text-amber-700">{formatPrice(row.refundedAmount)}</td>
                              <td className="px-3 py-2 font-mono font-semibold text-emerald-700">{formatPrice(row.netContribution)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              {stats.afterSalesByRootCause && Object.keys(stats.afterSalesByRootCause).length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">{t("rootCauseTitle")}</span>
                  {Object.entries(stats.afterSalesByRootCause).map(([cause, count]) => (
                    <span
                      key={cause}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-medium text-brand-primary"
                    >
                      <span>{tOrder("rootCauses." + cause, { defaultValue: cause })}</span>
                      <span className="font-mono font-bold text-brand-cyan">{count}</span>
                    </span>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* Tab Switcher (Role-Scoped P0-10) */}
        <div className="flex flex-wrap border-b border-slate-200 gap-6 mt-2">
          {[
            { id: "orders" as const, icon: ShoppingBag, label: t("ordersFulfillmentsTab"), visible: true },
            { id: "products" as const, icon: Package, label: t("productCatalogTab"), visible: canViewProducts },
            { id: "afterSales" as const, icon: LifeBuoy, label: t("afterSalesTab"), visible: canViewAfterSales },
            { id: "notifications" as const, icon: Mail, label: t("notificationsTab"), visible: canViewNotifications },
            { id: "users" as const, icon: Users, label: t("userDirectoryTab"), visible: canViewUsers },
            { id: "auditLogs" as const, icon: ClipboardList, label: t("auditLogsTab"), visible: canViewAuditLogs },
          ]
            .filter((tab) => tab.visible)
            .map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "border-brand-cyan text-brand-cyan"
                    : "border-transparent text-slate-400 hover:text-brand-primary"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
        </div>

        {/* Tab 1: Orders Fulfillment */}
        {activeTab === "orders" && (
          <SectionCard
            title={t("ordersSectionTitle")}
            eyebrow={t("ordersSectionEyebrow")}
            description={t("ordersSectionDescription")}
          >
            {/* Search + Queue Filters */}
            <div className="flex flex-col gap-4 mb-6">
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder={t("searchOrdersPlaceholder")}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 py-2 text-sm text-brand-primary focus:bg-white focus:border-brand-primary focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {queueFilters.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setOrderQueueFilter(f.id);
                      setPage(0);
                    }}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      orderQueueFilter === f.id
                        ? "bg-brand-primary text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <p className="text-center text-sm text-slate-500 py-10">{t("loading")}</p>
            ) : orders.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">{t("noOrders")}</p>
            ) : (
              <div className="w-full overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="px-5 py-4">{t("orderNumberCol")}</th>
                      <th className="px-5 py-4">{t("productCol")}</th>
                      <th className="px-5 py-4">{t("amountCol")}</th>
                      <th className="px-5 py-4">{t("createdAtCol")}</th>
                      <th className="px-5 py-4">{t("statusCol")}</th>
                      <th className="px-5 py-4">{t("fulfillmentCol")}</th>
                      <th className="px-5 py-4 text-right">{t("actionsCol")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-brand-primary">
                    {orders.map((order) => {
                      const statusUpper = order.status.toUpperCase();
                      const statusColors: Record<string, string> = {
                        CREATED: "text-slate-400 bg-slate-100",
                        AWAITING_REVIEW: "text-amber-800 bg-amber-100",
                        QUOTE_READY: "text-sky-700 bg-sky-100",
                        PENDING_PAYMENT: "text-amber-600 bg-amber-50",
                        PAID: "text-brand-cyan bg-brand-cyan/15",
                        SHIPPED: "text-indigo-600 bg-indigo-50",
                        DELIVERED: "text-emerald-600 bg-emerald-50",
                        CANCELLED: "text-red-500 bg-red-50",
                        REFUND_PENDING: "text-amber-700 bg-amber-100",
                        REFUNDED: "text-slate-600 bg-slate-100",
                      };

                      const statusText: Record<string, string> = {
                        CREATED: t("statusCreated"),
                        AWAITING_REVIEW: t("statusAwaitingReview"),
                        QUOTE_READY: t("statusQuoteReady"),
                        PENDING_PAYMENT: t("statusPendingPayment"),
                        PAID: t("statusPaid"),
                        SHIPPED: t("statusShipped"),
                        DELIVERED: t("statusDelivered"),
                        CANCELLED: t("statusCancelled"),
                        REFUND_PENDING: t("statusRefundPending"),
                        REFUNDED: t("statusRefunded"),
                      };

                      return (
                        <tr key={order.orderNumber} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-4 font-mono font-medium">
                            <Link
                              to={`/admin/orders/${order.orderNumber}`}
                              className="inline-block py-1 whitespace-nowrap hover:underline text-brand-cyan"
                            >
                              {order.orderNumber}
                            </Link>
                          </td>
                          <td className="px-5 py-4 font-medium">{order.productName}</td>
                          <td className="px-5 py-4 font-semibold">{formatPrice(order.totalAmount)}</td>
                          <td className="px-5 py-4 text-xs text-slate-500">{formatDate(order.createdAt)}</td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[9px] uppercase tracking-wider font-semibold whitespace-nowrap ${
                                statusColors[statusUpper] || "text-slate-500 bg-slate-100"
                              }`}
                            >
                              {statusText[statusUpper] || order.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs">
                            {order.fulfillmentStatus ? (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-700">
                                {tOrder("fulfillment." + order.fulfillmentStatus, { defaultValue: order.fulfillmentStatus })}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right flex justify-end flex-wrap gap-2">
                            {statusUpper === "PAID" && (
                              <>
                                {(canQuoteOrOptician || canWarehouse || canFinance) && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenFulfillment(order)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-all"
                                  >
                                    <Wrench className="w-3.5 h-3.5" />
                                    {t("fulfillmentAction")}
                                  </button>
                                )}
                                {canWarehouse && (
                                  <button
                                    type="button"
                                    disabled={order.fulfillmentStatus !== "QC_PASSED"}
                                    title={
                                      order.fulfillmentStatus !== "QC_PASSED"
                                        ? t("shipRequiresQcPassed")
                                        : undefined
                                    }
                                    onClick={() => handleOpenShip(order.orderNumber)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-brand-cyan text-brand-cyan hover:bg-brand-cyan hover:text-white disabled:opacity-45 disabled:cursor-not-allowed rounded-xl text-xs font-semibold transition-all"
                                  >
                                    <Truck className="w-3.5 h-3.5" />
                                    {t("shipAction")}
                                  </button>
                                )}
                                {(canCustomerService || canFinance) && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancel(order.orderNumber, true)}
                                    className="px-2.5 py-1.5 border border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 rounded-xl text-xs font-semibold transition-all"
                                  >
                                    {t("refundCancelAction")}
                                  </button>
                                )}
                              </>
                            )}

                            {statusUpper === "SHIPPED" && canWarehouse && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenUpdateTracking(order.orderNumber)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl text-xs font-semibold transition-all"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  {t("updateTrackingAction")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeliverModal(order.orderNumber)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-semibold transition-all"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {t("deliverAction")}
                                </button>
                              </>
                            )}

                            {["AWAITING_REVIEW", "QUOTE_READY"].includes(statusUpper) && canQuoteOrOptician && (
                              <button
                                type="button"
                                onClick={() => handleOpenQuoteModal(order)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-sky-300 text-sky-700 hover:bg-sky-50 rounded-xl text-xs font-semibold transition-all"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                                {t("quoteConfirmAction")}
                              </button>
                            )}

                            {["AWAITING_REVIEW", "QUOTE_READY", "PENDING_PAYMENT", "CREATED", "PAID"].includes(
                              statusUpper
                            ) &&
                              canCustomerService && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddressModal(order.orderNumber)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-all"
                                >
                                  <MapPin className="w-3.5 h-3.5" />
                                  {t("editAddressAction")}
                                </button>
                              )}

                            {["AWAITING_REVIEW", "QUOTE_READY", "PENDING_PAYMENT", "CREATED"].includes(statusUpper) &&
                              (canCustomerService || canFinance) && (
                                <button
                                  type="button"
                                  onClick={() => handleCancel(order.orderNumber, false)}
                                  className="px-2.5 py-1.5 border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl text-xs font-semibold transition-all"
                                >
                                  {t("cancelAction")}
                                </button>
                              )}

                            <Link
                              to={`/admin/orders/${order.orderNumber}`}
                              className="px-2.5 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-brand-primary rounded-xl text-xs font-semibold transition-all inline-block"
                            >
                              {t("detailsAction")}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <span className="text-xs text-slate-400">
                      {t("pageIndicator", { current: page + 1, total: totalPages })}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        {t("previousPage")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        {t("nextPage")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* Tab 2: Products Catalog Management */}
        {activeTab === "products" && canViewProducts && (
          <SectionCard
            title={t("productsSectionTitle")}
            eyebrow={t("productsSectionEyebrow")}
            description={t("productsSectionDescription")}
            actions={
              canEditProducts ? (
                <button
                  type="button"
                  onClick={handleOpenCreateProduct}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white hover:bg-brand-primary/90 rounded-2xl text-xs font-bold transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  {t("addFrameProduct")}
                </button>
              ) : undefined
            }
          >
            {isProductsLoading ? (
              <p className="text-center text-sm text-slate-500 py-10">{t("loading")}</p>
            ) : products.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">{t("noProducts")}</p>
            ) : (
              <div className="w-full overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="px-5 py-4">{t("imageCol")}</th>
                      <th className="px-5 py-4">{t("productNameCol")}</th>
                      <th className="px-5 py-4">{t("materialCol")}</th>
                      <th className="px-5 py-4">{t("shapeCol")}</th>
                      <th className="px-5 py-4">{t("sizeSpecCol")}</th>
                      <th className="px-5 py-4">{t("basePriceCol")}</th>
                      <th className="px-5 py-4">{t("stockCol")}</th>
                      <th className="px-5 py-4">{t("salesStatusCol")}</th>
                      <th className="px-5 py-4 text-right">{t("actionsCol")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-brand-primary">
                    {products.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-10 h-10 object-contain rounded border border-slate-100 bg-slate-50/50"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/images/aero_x1.png";
                            }}
                            loading="lazy"
                          />
                        </td>
                        <td className="px-5 py-4 font-medium">
                          <div className="font-semibold">{isZh ? prod.nameZh : prod.nameEn}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{isZh ? prod.nameEn : prod.nameZh}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div>{isZh ? prod.materialZh : prod.materialEn}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{isZh ? prod.materialEn : prod.materialZh}</div>
                        </td>
                        <td className="px-5 py-4 text-xs whitespace-nowrap">{shapeLabel(prod.shape)}</td>
                        <td className="px-5 py-4 text-xs font-mono">{prod.specsSize}</td>
                        <td className="px-5 py-4 font-semibold">{formatPrice(prod.basePrice)}</td>
                        <td className="px-5 py-4 font-mono text-xs">{prod.stockQuantity ?? 0}</td>
                        <td className="px-5 py-4 text-xs">
                          {(() => {
                            const effectiveStatus = resolveEffectiveProductStatus(prod);
                            return (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${salesStatusBadgeClass(effectiveStatus)}`}
                              >
                                {salesStatusLabel(effectiveStatus)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-4 text-right flex justify-end gap-2 items-center">
                          {canEditProducts && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenSkuModal(prod)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-brand-primary/30 text-brand-primary hover:bg-brand-primary hover:text-white rounded-xl text-xs font-semibold transition-all"
                                title={t("manageSkusAction")}
                              >
                                <Layers className="w-3.5 h-3.5" />
                                {t("manageSkusAction")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditProduct(prod)}
                                className="p-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-brand-primary rounded-xl transition-all"
                                title={t("editAction")}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="p-1.5 border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                                title={t("deleteAction")}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {/* Tab 3: After-Sales Tickets */}
        {activeTab === "afterSales" && canViewAfterSales && (
          <SectionCard
            title={t("afterSalesSectionTitle")}
            eyebrow={t("afterSalesSectionEyebrow")}
            description={t("afterSalesSectionDescription")}
          >
            {isTicketsLoading ? (
              <p className="text-center text-sm text-slate-500 py-10">{t("loading")}</p>
            ) : tickets.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">{t("noTickets")}</p>
            ) : (
              <div className="w-full overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="px-5 py-4">{t("ticketNumberCol")}</th>
                      <th className="px-5 py-4">{t("orderNumberCol")}</th>
                      <th className="px-5 py-4">{t("ticketCategoryCol")}</th>
                      <th className="px-5 py-4">{t("ticketReasonCol")}</th>
                      <th className="px-5 py-4">{t("ticketStatusCol")}</th>
                      <th className="px-5 py-4">{t("ticketAssigneeCol")}</th>
                      <th className="px-5 py-4 text-right">{t("actionsCol")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-brand-primary">
                    {tickets.map((tk) => (
                      <tr key={tk.ticketNumber} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs font-semibold">{tk.ticketNumber}</td>
                        <td className="px-5 py-4 font-mono text-xs">
                          <Link to={`/admin/orders/${tk.orderNumber}`} className="text-brand-cyan hover:underline">
                            {tk.orderNumber}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          {tOrder("categories." + tk.category, { defaultValue: tk.category })}
                        </td>
                        <td className="px-5 py-4 text-xs max-w-xs truncate" title={tk.reason}>
                          {tk.reason}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">
                            {tOrder("ticketStatus." + tk.status, { defaultValue: tk.status })}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">{tk.assignee || "—"}</td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenTicketModal(tk)}
                            className="px-3 py-1.5 border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white rounded-xl text-xs font-semibold transition-all"
                          >
                            {t("updateTicketAction")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ticketsTotalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <span className="text-xs text-slate-400">
                      {t("pageIndicator", { current: ticketsPage + 1, total: ticketsTotalPages })}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={ticketsPage === 0}
                        onClick={() => setTicketsPage((p) => p - 1)}
                      >
                        {t("previousPage")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={ticketsPage >= ticketsTotalPages - 1}
                        onClick={() => setTicketsPage((p) => p + 1)}
                      >
                        {t("nextPage")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* Tab 4: Email Notifications Outbox & Idempotent Resend (Sec 6 P1) */}
        {activeTab === "notifications" && canViewNotifications && (
          <SectionCard
            title={t("notificationsSectionTitle")}
            eyebrow={t("notificationsSectionEyebrow")}
            description={t("notificationsSectionDescription")}
            actions={
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "", label: t("notifFilterAll") },
                    { id: "FAILED", label: t("notifFilterFailed") },
                    { id: "SENT", label: t("notifFilterSent") },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id || "ALL"}
                    type="button"
                    onClick={() => {
                      setNotifStatusFilter(f.id);
                      setNotifPage(0);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      notifStatusFilter === f.id
                        ? "bg-brand-primary text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            }
          >
            {notifFeedback && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
                {notifFeedback}
              </div>
            )}
            {isNotifLoading ? (
              <p className="text-center text-sm text-slate-500 py-10">{t("loading")}</p>
            ) : notifications.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">{t("noNotifications")}</p>
            ) : (
              <div className="w-full overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="px-5 py-4">{t("notifEventCol")}</th>
                      <th className="px-5 py-4">{t("orderNumberCol")}</th>
                      <th className="px-5 py-4">{t("notifRecipientCol")}</th>
                      <th className="px-5 py-4">{t("notifAttemptsCol")}</th>
                      <th className="px-5 py-4">{t("notifErrorCol")}</th>
                      <th className="px-5 py-4 text-right">{t("actionsCol")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-brand-primary">
                    {notifications.map((notif) => {
                      const isSent = notif.status.toUpperCase() === "SENT";
                      return (
                        <tr key={notif.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5 text-xs">
                            <div className="font-semibold text-brand-primary">{notifEventLabel(notif.eventType)}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[220px]">{notif.subject}</div>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs">{notif.orderNumber || "—"}</td>
                          <td className="px-5 py-3.5 text-xs font-mono">{notif.recipientEmail}</td>
                          <td className="px-5 py-3.5 text-xs font-mono">{notif.attemptCount}</td>
                          <td className="px-5 py-3.5 text-xs">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                                isSent ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                              }`}
                            >
                              {notifStatusLabel(notif.status)}
                            </span>
                            {notif.lastError && (
                              <p className="mt-1 text-[11px] text-red-600 max-w-xs break-words">{notif.lastError}</p>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              disabled={isSent || resendingNotifId === notif.id}
                              onClick={() => void handleResendNotification(notif.id)}
                              className="inline-flex items-center gap-1 rounded-xl border border-brand-primary px-3 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-primary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${resendingNotifId === notif.id ? "animate-spin" : ""}`} />
                              {isSent ? t("notifSentDone") : t("notifResendBtn")}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {notifTotalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <span className="text-xs text-slate-400">
                      {t("pageIndicator", { current: notifPage + 1, total: notifTotalPages })}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={notifPage === 0}
                        onClick={() => setNotifPage((p) => p - 1)}
                      >
                        {t("previousPage")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={notifPage >= notifTotalPages - 1}
                        onClick={() => setNotifPage((p) => p + 1)}
                      >
                        {t("nextPage")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* Tab 5: Users Directory */}
        {activeTab === "users" && canViewUsers && (
          <SectionCard
            title={t("usersSectionTitle")}
            eyebrow={t("usersSectionEyebrow")}
            description={t("usersSectionDescription")}
          >
            {roleFeedback && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
                {roleFeedback}
              </div>
            )}
            {isUsersLoading ? (
              <p className="text-center text-sm text-slate-500 py-10">{t("loading")}</p>
            ) : usersList.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">{t("noUsers")}</p>
            ) : (
              <div className="w-full overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">{t("fullNameCol")}</th>
                      <th className="px-6 py-4">{t("emailCol")}</th>
                      <th className="px-6 py-4">{t("phoneCol")}</th>
                      <th className="px-6 py-4">{t("roleCol")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-brand-primary">
                    {usersList.map((userItem) => (
                      <tr key={userItem.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-semibold text-slate-400">{userItem.id}</td>
                        <td className="px-6 py-4 font-medium">{`${userItem.firstName} ${userItem.lastName}`}</td>
                        <td className="px-6 py-4">{userItem.email}</td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {userItem.phone ? (
                            <span className="flex items-center gap-1.5">
                              {userItem.phone}
                              <span
                                className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                  userItem.phoneVerified ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"
                                }`}
                              >
                                {userItem.phoneVerified ? t("verified") : t("unverified")}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400">{t("phoneNotBound")}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            aria-label={`${t("roleCol")} ${userItem.email}`}
                            value={userItem.role}
                            onChange={(e) => void handleRoleChange(userItem, e.target.value)}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-brand-primary focus:border-brand-primary focus:outline-none"
                          >
                            {STAFF_ROLE_OPTIONS.map((roleOpt) => (
                              <option key={roleOpt} value={roleOpt}>
                                {roleLabel(roleOpt)}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {usersTotalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <span className="text-xs text-slate-400">
                      {t("pageIndicator", { current: usersPage + 1, total: usersTotalPages })}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={usersPage === 0}
                        onClick={() => setUsersPage((p) => p - 1)}
                      >
                        {t("previousPage")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={usersPage >= usersTotalPages - 1}
                        onClick={() => setUsersPage((p) => p + 1)}
                      >
                        {t("nextPage")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* Tab 5: Audit Logs */}
        {activeTab === "auditLogs" && canViewAuditLogs && (
          <SectionCard
            title={t("auditSectionTitle")}
            eyebrow={t("auditSectionEyebrow")}
            description={t("auditSectionDescription")}
          >
            {isAuditLoading ? (
              <p className="text-center text-sm text-slate-500 py-10">{t("loading")}</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">{t("noAuditLogs")}</p>
            ) : (
              <div className="w-full overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="px-5 py-4">{t("auditTimeCol")}</th>
                      <th className="px-5 py-4">{t("auditAdminCol")}</th>
                      <th className="px-5 py-4">{t("auditActionCol")}</th>
                      <th className="px-5 py-4">{t("auditTargetCol")}</th>
                      <th className="px-5 py-4">{t("auditDetailsCol")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-brand-primary">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{formatDate(log.timestamp)}</td>
                        <td className="px-5 py-3.5 text-xs font-mono">{log.adminEmail}</td>
                        <td className="px-5 py-3.5 text-xs font-mono font-semibold">{log.action}</td>
                        <td className="px-5 py-3.5 text-xs font-mono">{`${log.targetType}:${log.targetId}`}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 max-w-md break-words">{log.details || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {auditTotalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <span className="text-xs text-slate-400">
                      {t("pageIndicator", { current: auditPage + 1, total: auditTotalPages })}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={auditPage === 0}
                        onClick={() => setAuditPage((p) => p - 1)}
                      >
                        {t("previousPage")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={auditPage >= auditTotalPages - 1}
                        onClick={() => setAuditPage((p) => p + 1)}
                      >
                        {t("nextPage")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* Product Modal Overlay (Add & Edit) */}
        {isProductModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-product-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsProductModalOpen(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-brand-primary/40 backdrop-blur-sm p-4"
          >
            <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
              <div className="bg-brand-primary px-6 py-5 text-white flex justify-between items-center shrink-0">
                <h3 id="admin-product-modal-title" className="font-display font-medium text-lg tracking-wide text-white">
                  {editingProduct ? t("editFrameTitle", { name: editingProduct.name }) : t("addFrameTitle")}
                </h3>
                <button
                  type="button"
                  aria-label={t("closeModal")}
                  onClick={() => setIsProductModalOpen(false)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="p-6 flex flex-col gap-4 overflow-y-auto">
                {prodError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl p-3">{prodError}</p>}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("englishNameLabel")}</label>
                    <input
                      type="text"
                      value={prodNameEn}
                      onChange={(e) => setProdNameEn(e.target.value)}
                      required
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("chineseNameLabel")}</label>
                    <input
                      type="text"
                      value={prodNameZh}
                      onChange={(e) => setProdNameZh(e.target.value)}
                      required
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("englishMaterialLabel")}</label>
                    <input
                      type="text"
                      value={prodMaterialEn}
                      onChange={(e) => setProdMaterialEn(e.target.value)}
                      required
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("chineseMaterialLabel")}</label>
                    <input
                      type="text"
                      value={prodMaterialZh}
                      onChange={(e) => setProdMaterialZh(e.target.value)}
                      required
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("basePriceLabel")}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={prodBasePrice}
                      onChange={(e) => setProdBasePrice(Number(e.target.value))}
                      required
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("frameShapeLabel")}</label>
                    <select
                      value={prodShape}
                      onChange={(e) => setProdShape(e.target.value)}
                      required
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    >
                      <option value="ROUND">{shapeLabel("ROUND")}</option>
                      <option value="SQUARE">{shapeLabel("SQUARE")}</option>
                      <option value="RECTANGLE">{shapeLabel("RECTANGLE")}</option>
                      <option value="AVIATOR">{shapeLabel("AVIATOR")}</option>
                      <option value="CAT_EYE">{shapeLabel("CAT_EYE")}</option>
                      <option value="GEOMETRIC">{shapeLabel("GEOMETRIC")}</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("sizeSpecLabel")}</label>
                    <input
                      type="text"
                      value={prodSpecsSize}
                      onChange={(e) => setProdSpecsSize(e.target.value)}
                      required
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("stockLabel")}</label>
                    <input
                      type="number"
                      min={0}
                      value={prodStockQuantity}
                      onChange={(e) => setProdStockQuantity(Number(e.target.value))}
                      required
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("salesStatusLabel")}</label>
                    <select
                      value={prodSalesStatus}
                      onChange={(e) => setProdSalesStatus(e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    >
                      <option value="AVAILABLE">{t("salesStatusAvailable")}</option>
                      <option value="OUT_OF_STOCK">{t("salesStatusOutOfStock")}</option>
                      <option value="PAUSED">{t("salesStatusPaused")}</option>
                      <option value="ARCHIVED">{t("salesStatusArchived")}</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("primaryImageUrlLabel")}</label>
                  <input
                    type="text"
                    value={prodImageUrl}
                    onChange={(e) => setProdImageUrl(e.target.value)}
                    required
                    className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("detailImageUrlsLabel")}</label>
                  <textarea
                    value={prodDetailImages}
                    onChange={(e) => setProdDetailImages(e.target.value)}
                    rows={2}
                    className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50 resize-none"
                  />
                </div>

                <div className="flex gap-3 justify-end mt-4 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline-light" onClick={() => setIsProductModalOpen(false)}>
                    {t("cancelAction")}
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSavingProduct}>
                    {isSavingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : t("saveChanges")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Fulfillment, QC & Unit Economics Update Modal */}
        {fulfillmentOrderNum && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-fulfillment-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setFulfillmentOrderNum(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-brand-primary/40 backdrop-blur-sm p-4"
          >
            <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
              <div className="bg-brand-primary px-6 py-5 text-white flex justify-between items-center shrink-0">
                <h3 id="admin-fulfillment-modal-title" className="font-display font-medium text-lg tracking-wide text-white">{t("fulfillmentModalTitle")}</h3>
                <button
                  type="button"
                  aria-label={t("closeModal")}
                  onClick={() => setFulfillmentOrderNum(null)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleFulfillmentSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
                {fulfillmentError && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl p-3">{fulfillmentError}</p>
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("fulfillingOrderLabel")}</span>
                  <span className="text-sm font-mono font-bold text-brand-primary">{fulfillmentOrderNum}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    {t("quickStepsTitle")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {canQuoteOrOptician && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-light"
                          disabled={isSavingFulfillment}
                          onClick={() => void handleQuickStageAction("verify")}
                          className="rounded-xl text-xs"
                        >
                          {t("btnVerifyOptician")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-light"
                          disabled={isSavingFulfillment}
                          onClick={() => void handleQuickStageAction("produce")}
                          className="rounded-xl text-xs"
                        >
                          {t("btnStartProduction")}
                        </Button>
                      </>
                    )}
                    {canWarehouse && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={isSavingFulfillment}
                          onClick={() => void handleQuickStageAction("qc_pass")}
                          className="rounded-xl text-xs"
                        >
                          {t("btnQcPassed")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-light"
                          disabled={isSavingFulfillment}
                          onClick={() => void handleQuickStageAction("qc_fail")}
                          className="rounded-xl text-xs border-red-200 text-red-600 hover:bg-red-50"
                        >
                          {t("btnQcFailed")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {canQuoteOrOptician && (
                  <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setShowRxRevision((prev) => !prev)}
                        className="text-xs font-semibold text-sky-800 hover:underline"
                      >
                        {showRxRevision ? t("reviseRxHideBtn") : t("reviseRxToggleBtn")}
                      </button>
                    </div>
                    {rxRevisionFeedback && (
                      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2">
                        {rxRevisionFeedback}
                      </p>
                    )}
                    {showRxRevision && (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-500">
                            <span>{t("rxOdSphLabel")}</span>
                            <input
                              type="number"
                              step="0.25"
                              value={rxSphOdVal}
                              onChange={(e) => setRxSphOdVal(e.target.value)}
                              className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-500">
                            <span>{t("rxOsSphLabel")}</span>
                            <input
                              type="number"
                              step="0.25"
                              value={rxSphOsVal}
                              onChange={(e) => setRxSphOsVal(e.target.value)}
                              className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-500">
                            <span>{t("rxOdCylLabel")}</span>
                            <input
                              type="number"
                              step="0.25"
                              value={rxCylOdVal}
                              onChange={(e) => setRxCylOdVal(e.target.value)}
                              className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-500">
                            <span>{t("rxOsCylLabel")}</span>
                            <input
                              type="number"
                              step="0.25"
                              value={rxCylOsVal}
                              onChange={(e) => setRxCylOsVal(e.target.value)}
                              className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-500">
                            <span>{t("rxOdAxisLabel")}</span>
                            <input
                              type="number"
                              min="0"
                              max="180"
                              value={rxAxisOdVal}
                              onChange={(e) => setRxAxisOdVal(e.target.value)}
                              className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-500">
                            <span>{t("rxOsAxisLabel")}</span>
                            <input
                              type="number"
                              min="0"
                              max="180"
                              value={rxAxisOsVal}
                              onChange={(e) => setRxAxisOsVal(e.target.value)}
                              className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-500 col-span-2">
                            <span>{t("rxPdLabel")}</span>
                            <input
                              type="number"
                              step="0.5"
                              value={rxPdVal}
                              onChange={(e) => setRxPdVal(e.target.value)}
                              className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white"
                            />
                          </label>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                            {t("rxRevisionNoteLabel")}
                          </label>
                          <input
                            type="text"
                            value={rxRevisionNoteVal}
                            onChange={(e) => setRxRevisionNoteVal(e.target.value)}
                            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={isSavingFulfillment}
                            onClick={() => void handleReviseRxSubmit()}
                            className="rounded-xl text-xs"
                          >
                            {t("reviseRxSaveBtn")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("fulfillmentStatusLabel")}</label>
                    <select
                      value={fulfillmentStatusVal}
                      onChange={(e) => setFulfillmentStatusVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    >
                      {FULFILLMENT_EDIT_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {tOrder("fulfillment." + opt, { defaultValue: opt })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("qcStatusInputLabel")}</label>
                    <select
                      value={qcStatusVal}
                      onChange={(e) => setQcStatusVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    >
                      {QC_STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {tOrder("qcStatuses." + opt, { defaultValue: opt })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-brand-primary font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opticianVerifiedVal}
                    onChange={(e) => setOpticianVerifiedVal(e.target.checked)}
                    className="rounded border-slate-300 text-brand-primary"
                  />
                  <span>{t("opticianVerifiedCheckbox")}</span>
                </label>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("qcNoteInputLabel")}</label>
                  <input
                    type="text"
                    value={qcNoteVal}
                    onChange={(e) => setQcNoteVal(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("fulfillmentNoteLabel")}</label>
                  <textarea
                    rows={2}
                    value={fulfillmentNoteVal}
                    onChange={(e) => setFulfillmentNoteVal(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("estimatedDeliveryLabel")}</label>
                    <input
                      type="date"
                      value={estimatedDeliveryVal}
                      onChange={(e) => setEstimatedDeliveryVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("deliveryDelayReasonLabel")}</label>
                    <input
                      type="text"
                      value={deliveryDelayReasonVal}
                      onChange={(e) => setDeliveryDelayReasonVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                </div>
                {canFinance && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3 items-end">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("orderSourceShortLabel")}</label>
                      <input
                        type="text"
                        value={orderSourceVal}
                        onChange={(e) => setOrderSourceVal(e.target.value)}
                        placeholder={t("orderSourcePlaceholder")}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("variableCostShortLabel")}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={variableCostVal}
                        onChange={(e) => setVariableCostVal(e.target.value)}
                        placeholder={t("variableCostPlaceholder")}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-3 justify-end mt-2 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline-light" onClick={() => setFulfillmentOrderNum(null)}>
                    {t("cancelAction")}
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSavingFulfillment}>
                    {isSavingFulfillment ? <Loader2 className="w-4 h-4 animate-spin" /> : t("saveFulfillment")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Pre-Payment Compatibility & Quote Confirmation Modal (P0-2) */}
        {quoteOrderNum && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-quote-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setQuoteOrderNum(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-brand-primary/40 backdrop-blur-sm p-4"
          >
            <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
              <div className="bg-brand-primary px-6 py-5 text-white flex justify-between items-center shrink-0">
                <h3 id="admin-quote-modal-title" className="font-display font-medium text-lg tracking-wide text-white">{t("quoteModalTitle")}</h3>
                <button
                  type="button"
                  aria-label={t("closeModal")}
                  onClick={() => setQuoteOrderNum(null)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleQuoteSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
                {quoteError && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl p-3">{quoteError}</p>
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("fulfillingOrderLabel")}</span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-mono font-bold text-brand-primary">{quoteOrderNum}</span>
                    {quoteOrderDetail?.quoteVersion != null && quoteOrderDetail.quoteVersion > 0 && (
                      <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-sky-800">
                        {t("quoteCurrentVersion", { version: quoteOrderDetail.quoteVersion })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("quoteTargetFinishLabel")}</label>
                    <input
                      type="text"
                      value={quoteTargetFinishVal}
                      onChange={(e) => setQuoteTargetFinishVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("quoteTargetSizeLabel")}</label>
                    <input
                      type="text"
                      value={quoteTargetSizeVal}
                      onChange={(e) => setQuoteTargetSizeVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("quoteChangeSummaryLabel")}</label>
                  <input
                    type="text"
                    value={quoteChangeSummaryVal}
                    onChange={(e) => setQuoteChangeSummaryVal(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("quoteRevisedAmountLabel")}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={quoteRevisedAmountVal}
                    onChange={(e) => setQuoteRevisedAmountVal(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("quotePromisedDateLabel")}</label>
                  <input
                    type="date"
                    value={quotePromisedDateVal}
                    onChange={(e) => setQuotePromisedDateVal(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("quoteExpiresAtLabel")}</label>
                  <input
                    type="datetime-local"
                    value={quoteExpiresAtVal}
                    onChange={(e) => setQuoteExpiresAtVal(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>
                {availableLensOptions.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("quoteLensOptionsLabel")}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {availableLensOptions.map((opt) => {
                        const checked = quoteLensTypesVal.includes(opt.type);
                        return (
                          <label
                            key={opt.type}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs cursor-pointer ${
                              checked
                                ? "border-brand-cyan bg-brand-cyan/10 text-brand-primary font-semibold"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setQuoteLensTypesVal((prev) =>
                                  e.target.checked
                                    ? Array.from(new Set([...prev, opt.type]))
                                    : prev.filter((item) => item !== opt.type)
                                );
                              }}
                              className="rounded border-slate-300"
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("quoteNoteInputLabel")}</label>
                  <textarea
                    rows={3}
                    value={quoteNoteVal}
                    onChange={(e) => setQuoteNoteVal(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>
                <div className="flex gap-3 justify-end mt-2 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline-light" onClick={() => setQuoteOrderNum(null)}>
                    {t("cancelAction")}
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSavingQuote}>
                    {isSavingQuote ? <Loader2 className="w-4 h-4 animate-spin" /> : t("saveQuoteConfirmBtn")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SKU Inventory Management Modal (P0-1) */}
        {skuProduct && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-sku-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSkuProduct(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-brand-primary/40 backdrop-blur-sm p-4"
          >
            <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
              <div className="bg-brand-primary px-6 py-5 text-white flex justify-between items-center shrink-0">
                <h3 id="admin-sku-modal-title" className="font-display font-medium text-lg tracking-wide text-white">
                  {t("skuModalTitle", { name: isZh ? skuProduct.nameZh : skuProduct.nameEn })}
                </h3>
                <button
                  type="button"
                  aria-label={t("closeModal")}
                  onClick={() => setSkuProduct(null)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-5 overflow-y-auto">
                {skuError && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl p-3">{skuError}</p>
                )}
                {isLoadingSkus ? (
                  <p className="text-xs text-slate-500 text-center py-4">{t("loading")}</p>
                ) : skuList.length > 0 && (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                        <tr>
                          <th className="px-3 py-2">{t("skuFinishLabel")}</th>
                          <th className="px-3 py-2">{t("skuSizeLabel")}</th>
                          <th className="px-3 py-2">{t("skuSupplierLabel")}</th>
                          <th className="px-3 py-2">{t("skuOnHandLabel")}</th>
                          <th className="px-3 py-2">{t("skuReservedCol")}</th>
                          <th className="px-3 py-2">{t("skuCommittedCol")}</th>
                          <th className="px-3 py-2">{t("skuAvailableCol")}</th>
                          <th className="px-3 py-2">{t("skuStocktakeCol")}</th>
                          <th className="px-3 py-2">{t("salesStatusCol")}</th>
                          <th className="px-3 py-2">{t("skuRestockEtaLabel")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {skuList.map((sku) => (
                          <tr
                            key={sku.id}
                            onClick={() => {
                              setSkuFinishVal(sku.finishId);
                              setSkuSizeVal(sku.sizeSpec);
                              setSkuSupplierVal(sku.supplierName || "");
                              setSkuOnHandVal(sku.onHandQty ?? 0);
                              setSkuStatusVal(sku.salesStatus);
                              setSkuRestockEtaVal(sku.restockEta || "");
                              setSkuUnitCostVal(sku.unitCost != null ? String(sku.unitCost) : "");
                            }}
                            className="hover:bg-slate-50 cursor-pointer"
                          >
                            <td className="px-3 py-2 font-mono font-semibold text-brand-primary">{sku.finishId}</td>
                            <td className="px-3 py-2 font-mono">{sku.sizeSpec}</td>
                            <td className="px-3 py-2">{sku.supplierName || "—"}</td>
                            <td className="px-3 py-2 font-mono">{sku.onHandQty ?? 0}</td>
                            <td className="px-3 py-2 font-mono text-amber-700">{sku.reservedQty ?? 0}</td>
                            <td className="px-3 py-2 font-mono text-indigo-700">{sku.committedQty ?? 0}</td>
                            <td className="px-3 py-2 font-mono font-bold text-emerald-700">{sku.availableQty ?? 0}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                                  sku.stocktakeVerified
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {sku.stocktakeVerified ? t("stocktakeVerifiedBadge") : t("stocktakeUnverifiedBadge")}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{salesStatusLabel(sku.salesStatus)}</td>
                            <td className="px-3 py-2 font-mono">{sku.restockEta || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <form onSubmit={handleSaveSku} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("skuFinishLabel")}</label>
                    <input
                      type="text"
                      required
                      value={skuFinishVal}
                      onChange={(e) => setSkuFinishVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("skuSizeLabel")}</label>
                    <input
                      type="text"
                      required
                      value={skuSizeVal}
                      onChange={(e) => setSkuSizeVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("skuSupplierLabel")}</label>
                    <input
                      type="text"
                      value={skuSupplierVal}
                      onChange={(e) => setSkuSupplierVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("skuOnHandLabel")}</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={skuOnHandVal}
                      onChange={(e) => setSkuOnHandVal(Number(e.target.value))}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("salesStatusLabel")}</label>
                    <select
                      value={skuStatusVal}
                      onChange={(e) => setSkuStatusVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    >
                      <option value="AVAILABLE">{t("salesStatusAvailable")}</option>
                      <option value="OUT_OF_STOCK">{t("salesStatusOutOfStock")}</option>
                      <option value="PAUSED">{t("salesStatusPaused")}</option>
                      <option value="ARCHIVED">{t("salesStatusArchived")}</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("skuRestockEtaLabel")}</label>
                      {skuRestockEtaVal && (
                        <button
                          type="button"
                          onClick={() => setSkuRestockEtaVal("")}
                          className="text-[10px] font-semibold text-brand-cyan hover:underline"
                        >
                          {t("clearDateAction")}
                        </button>
                      )}
                    </div>
                    <input
                      type="date"
                      value={skuRestockEtaVal}
                      onChange={(e) => setSkuRestockEtaVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("skuUnitCostLabel")}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={skuUnitCostVal}
                      onChange={(e) => setSkuUnitCostVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap justify-end gap-2 pt-2">
                    <Button type="button" variant="outline-light" onClick={() => setSkuProduct(null)}>
                      {t("cancelAction")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isSavingSku}
                      onClick={() => void handleVerifyStocktakeSku()}
                    >
                      {t("verifyStocktakeBtn")}
                    </Button>
                    <Button type="submit" variant="primary" disabled={isSavingSku}>
                      {isSavingSku ? <Loader2 className="w-4 h-4 animate-spin" /> : t("saveSkuBtn")}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* After-Sales Execution Modal (P0-3: Return QC, Restock, Remake, Refund & Finance Verification) */}
        {editingTicket && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-ticket-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingTicket(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-brand-primary/40 backdrop-blur-sm p-4"
          >
            <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
              <div className="bg-brand-primary px-6 py-5 text-white flex justify-between items-center shrink-0">
                <h3 id="admin-ticket-modal-title" className="font-display font-medium text-lg tracking-wide text-white">{t("ticketModalTitle")}</h3>
                <button
                  type="button"
                  aria-label={t("closeModal")}
                  onClick={() => setEditingTicket(null)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveTicket} className="p-6 flex flex-col gap-4 overflow-y-auto">
                {ticketActionErr && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{ticketActionErr}</p>
                )}
                {ticketActionMsg && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">{ticketActionMsg}</p>
                )}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
                  <p className="font-mono font-semibold text-brand-primary">{editingTicket.ticketNumber} · {editingTicket.orderNumber}</p>
                  <p className="text-slate-600">{editingTicket.reason}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("ticketStatusCol")}</label>
                    <select
                      value={ticketStatusVal}
                      onChange={(e) => setTicketStatusVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    >
                      {TICKET_STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {tOrder("ticketStatus." + st, { defaultValue: st })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("ticketAssigneeLabel")}</label>
                    <input
                      type="text"
                      value={ticketAssigneeVal}
                      onChange={(e) => setTicketAssigneeVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("ticketRootCauseLabel")}</label>
                    <select
                      value={ticketRootCauseVal}
                      onChange={(e) => setTicketRootCauseVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    >
                      <option value="">{tOrder("rootCauses.UNCLASSIFIED")}</option>
                      {ROOT_CAUSE_OPTIONS.map((rc) => (
                        <option key={rc} value={rc}>
                          {tOrder("rootCauses." + rc, { defaultValue: rc })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("ticketResolutionLabel")}</label>
                  <textarea
                    rows={2}
                    value={ticketResolutionVal}
                    onChange={(e) => setTicketResolutionVal(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                  />
                </div>

                {/* Return Logistics & QC Restock */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("ticketReturnCarrierLabel")}</label>
                    <input
                      type="text"
                      value={ticketReturnCarrierVal}
                      onChange={(e) => setTicketReturnCarrierVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("ticketReturnTrackingLabel")}</label>
                    <input
                      type="text"
                      value={ticketReturnTrackingVal}
                      onChange={(e) => setTicketReturnTrackingVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("ticketReturnQcLabel")}</label>
                    <select
                      value={ticketReturnQcVal}
                      onChange={(e) => setTicketReturnQcVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    >
                      {RETURN_QC_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {tOrder("returnQc." + opt, { defaultValue: opt })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("ticketReturnQcNoteLabel")}</label>
                    <input
                      type="text"
                      value={ticketReturnQcNoteVal}
                      onChange={(e) => setTicketReturnQcNoteVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("returnDispositionLabel")}
                    </label>
                    <select
                      value={ticketReturnDispositionVal}
                      onChange={(e) => setTicketReturnDispositionVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    >
                      {RETURN_DISPOSITION_OPTIONS.map((disp) => (
                        <option key={disp} value={disp}>
                          {t("disposition." + disp, { defaultValue: disp })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("returnEvidenceNoteLabel")}
                    </label>
                    <input
                      type="text"
                      value={ticketReturnEvidenceVal}
                      onChange={(e) => setTicketReturnEvidenceVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-1.5 text-xs">
                    {editingTicket.returnReceivedAt ? (
                      <span className="inline-flex w-fit rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-semibold">
                        {t("returnReceivedBadge")}
                      </span>
                    ) : (
                      <>
                        {canWarehouse ? (
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-brand-primary cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ticketReturnReceivedChecked}
                              onChange={(e) => setTicketReturnReceivedChecked(e.target.checked)}
                              className="rounded border-slate-300 text-brand-primary"
                            />
                            <span>{t("confirmPhysicalReceiptCheckbox")}</span>
                          </label>
                        ) : (
                          <span className="text-[11px] text-amber-700">{t("returnNotReceivedNotice")}</span>
                        )}
                      </>
                    )}
                  </div>
                  {canWarehouse && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={
                        isSavingTicket ||
                        editingTicket.returnRestocked ||
                        (!editingTicket.returnReceivedAt && !ticketReturnReceivedChecked) ||
                        (editingTicket.returnQcResult !== "RESTOCKABLE" && ticketReturnQcVal !== "RESTOCKABLE")
                      }
                      onClick={handleRestockTicket}
                      className="rounded-xl"
                    >
                      {editingTicket.returnRestocked ? t("ticketRestockedDone") : t("ticketRestockBtn")}
                    </Button>
                  )}
                </div>

                {/* Remake Linkage & Cost Attribution */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("ticketRemakeOrderLabel")}</label>
                    <input
                      type="text"
                      value={ticketRemakeOrderVal}
                      onChange={(e) => setTicketRemakeOrderVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("ticketRemakeCarrierLabel")}</label>
                    <input
                      type="text"
                      value={ticketRemakeCarrierVal}
                      onChange={(e) => setTicketRemakeCarrierVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("ticketRemakeTrackingLabel")}</label>
                    <input
                      type="text"
                      value={ticketRemakeTrackingVal}
                      onChange={(e) => setTicketRemakeTrackingVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("remakeCostLabel")}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ticketRemakeCostVal}
                      onChange={(e) => setTicketRemakeCostVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("returnShippingCostLabel")}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ticketReturnShippingCostVal}
                      onChange={(e) => setTicketReturnShippingCostVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Post-Shipment Refund & Finance Verification */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <p className="text-xs font-semibold text-amber-900">{t("ticketRefundSectionTitle")}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{t("ticketRefundAmountLabel")}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={ticketRefundAmountVal}
                        onChange={(e) => setTicketRefundAmountVal(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{t("ticketRefundTxLabel")}</label>
                      <input
                        type="text"
                        value={ticketRefundTxVal}
                        onChange={(e) => setTicketRefundTxVal(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(canFinance || canCustomerService) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline-light"
                        disabled={isSavingTicket || !ticketRefundAmountVal.trim()}
                        onClick={handleRefundTicket}
                        className="rounded-xl border-amber-300 text-amber-900 bg-white hover:bg-amber-100"
                      >
                        {t("ticketRefundBtn")}
                      </Button>
                    )}
                    {canFinance && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={isSavingTicket || !editingTicket.refundAmount || Boolean(editingTicket.financeVerifiedAt)}
                        onClick={handleFinanceVerifyTicket}
                        className="rounded-xl"
                      >
                        {editingTicket.financeVerifiedAt
                          ? t("ticketFinanceVerifiedInfo", { by: editingTicket.financeVerifiedBy || "finance" })
                          : t("ticketFinanceVerifyBtn")}
                      </Button>
                    )}
                  </div>
                  {editingTicket.refundTransactions && editingTicket.refundTransactions.length > 0 && (
                    <div className="border-t border-amber-200/80 pt-3 space-y-2">
                      <p className="text-[10px] uppercase font-bold text-amber-900 tracking-wider">
                        {t("refundLedgerHeading")}
                      </p>
                      {editingTicket.refundTransactions.map((rtx) => {
                        const st = (rtx.status || "").toUpperCase();
                        const isConfirmed = st === "CONFIRMED";
                        return (
                          <div
                            key={rtx.refundRequestId}
                            className="rounded-xl bg-white border border-amber-200/70 p-2.5 text-xs flex flex-col gap-1.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono font-semibold text-brand-primary">
                                {rtx.refundRequestId} · {formatPrice(rtx.requestedAmount)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  isConfirmed
                                    ? "bg-emerald-100 text-emerald-800"
                                    : st === "FAILED"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {tOrder("refundTxStatus." + st, { defaultValue: st })}
                              </span>
                            </div>
                            {rtx.failureMessage && (
                              <p className="text-[11px] text-red-600">{rtx.failureMessage}</p>
                            )}
                            {!isConfirmed && (canFinance || canCustomerService) && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline-light"
                                  disabled={isSavingTicket}
                                  onClick={() => void handleRetryRefundTx(rtx.refundRequestId)}
                                  className="rounded-lg text-[11px]"
                                >
                                  {t("retryRefundBtn")}
                                </Button>
                                {canFinance && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={isSavingTicket}
                                    onClick={() => void handleManualConfirmRefundTx(rtx)}
                                    className="rounded-lg text-[11px]"
                                  >
                                    {t("manualConfirmRefundBtn")}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-end mt-2 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline-light" onClick={() => setEditingTicket(null)}>
                    {t("cancelAction")}
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSavingTicket}>
                    {isSavingTicket ? <Loader2 className="w-4 h-4 animate-spin" /> : t("saveTicket")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Ship Modal Overlay */}
        {shippingOrderNum && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-ship-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShippingOrderNum(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-brand-primary/40 backdrop-blur-sm p-4"
          >
            <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-brand-primary px-6 py-6 text-white flex justify-between items-center">
                <h3 id="admin-ship-modal-title" className="font-display font-medium text-lg tracking-wide text-white">
                  {shipDialogMode === "updateTracking" ? t("updateTrackingModalTitle") : t("shipModalTitle")}
                </h3>
                <button
                  type="button"
                  aria-label={t("closeModal")}
                  onClick={() => setShippingOrderNum(null)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleShipSubmit} className="p-6 flex flex-col gap-4">
                {shipError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl p-3">{shipError}</p>}

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("fulfillingOrderLabel")}</span>
                  <span className="text-sm font-mono font-bold text-brand-primary">{shippingOrderNum}</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("carrierLabel")}</label>
                  <input
                    type="text"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    required
                    placeholder={t("carrierPlaceholder")}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("trackingNumberLabel")}</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    required
                    placeholder={t("trackingNumberPlaceholder")}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>

                {shipDialogMode === "updateTracking" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("trackingCorrectionNoteLabel")}
                    </label>
                    <input
                      type="text"
                      value={trackingCorrectionNote}
                      onChange={(e) => setTrackingCorrectionNote(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                )}

                <div className="flex gap-3 justify-end mt-4 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline-light" onClick={() => setShippingOrderNum(null)}>
                    {t("cancelAction")}
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSubmittingShip}>
                    {isSubmittingShip ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : shipDialogMode === "updateTracking" ? (
                      t("confirmUpdateTracking")
                    ) : (
                      t("confirmShip")
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Deliver Order Modal (P0-05 optional actual carrier deliveredAt) */}
        {deliverOrderNum && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-deliver-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeliverOrderNum(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-brand-primary/40 backdrop-blur-sm p-4"
          >
            <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-brand-primary px-6 py-5 text-white flex justify-between items-center">
                <h3 id="admin-deliver-modal-title" className="font-display font-medium text-lg tracking-wide text-white">{t("deliverModalTitle")}</h3>
                <button
                  type="button"
                  aria-label={t("closeModal")}
                  onClick={() => setDeliverOrderNum(null)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleDeliverSubmit} className="p-6 flex flex-col gap-4">
                {deliverError && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl p-3">{deliverError}</p>
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("fulfillingOrderLabel")}</span>
                  <span className="text-sm font-mono font-bold text-brand-primary">{deliverOrderNum}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {t("deliverActualTimeLabel")}
                  </label>
                  <input
                    type="datetime-local"
                    value={deliverAtVal}
                    onChange={(e) => setDeliverAtVal(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>
                <div className="flex gap-3 justify-end mt-2 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline-light" onClick={() => setDeliverOrderNum(null)}>
                    {t("cancelAction")}
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSubmittingDeliver}>
                    {isSubmittingDeliver ? <Loader2 className="w-4 h-4 animate-spin" /> : t("confirmDeliverBtn")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Pre-Shipment Shipping Address Update Modal (P0-05) */}
        {addressOrderNum && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-address-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAddressOrderNum(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-brand-primary/40 backdrop-blur-sm p-4"
          >
            <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
              <div className="bg-brand-primary px-6 py-5 text-white flex justify-between items-center shrink-0">
                <h3 id="admin-address-modal-title" className="font-display font-medium text-lg tracking-wide text-white">{t("editAddressModalTitle")}</h3>
                <button
                  type="button"
                  aria-label={t("closeModal")}
                  onClick={() => setAddressOrderNum(null)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleAddressSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
                {addressError && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl p-3">{addressError}</p>
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("fulfillingOrderLabel")}</span>
                  <span className="text-sm font-mono font-bold text-brand-primary">{addressOrderNum}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("addrProvinceLabel")}</label>
                    <input
                      type="text"
                      value={addrProvinceVal}
                      onChange={(e) => setAddrProvinceVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("addrCityLabel")}</label>
                    <input
                      type="text"
                      value={addrCityVal}
                      onChange={(e) => setAddrCityVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("addrDistrictLabel")}</label>
                    <input
                      type="text"
                      value={addrDistrictVal}
                      onChange={(e) => setAddrDistrictVal(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("addrDetailLabel")}</label>
                  <input
                    type="text"
                    value={addrDetailVal}
                    onChange={(e) => setAddrDetailVal(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("addrFullLabel")}</label>
                  <input
                    type="text"
                    required
                    value={addrFullVal}
                    onChange={(e) => setAddrFullVal(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t("addrPhoneLabel")}</label>
                  <input
                    type="text"
                    value={addrPhoneVal}
                    onChange={(e) => setAddrPhoneVal(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50"
                  />
                </div>
                <div className="flex gap-3 justify-end mt-2 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline-light" onClick={() => setAddressOrderNum(null)}>
                    {t("cancelAction")}
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSavingAddress}>
                    {isSavingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : t("saveAddressBtn")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
