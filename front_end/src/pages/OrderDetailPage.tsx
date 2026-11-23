import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Truck,
  AlertCircle,
  User,
  MapPin,
  Phone,
  RefreshCw,
  CreditCard,
  XCircle,
  Wrench,
  MessageSquarePlus,
  FileWarning,
  LifeBuoy,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useCart } from "../hooks/useCart";
import {
  adminFetchOrderDetail,
  cancelMyOrder,
  confirmOrderQuote,
  createAfterSalesTicket,
  fetchOrderAfterSalesTickets,
  fetchOrderDetail,
  getApiBaseUrl,
  isApiErrorWithStatus,
  isStaffRole,
  refreshOrderPaymentStatus,
  resumeOrderPayment,
  type AfterSalesTicket,
  type OrderDetailResponse,
  type RefundTransactionRecord,
} from "../services/api";
import { parseAndValidatePaymentForm } from "../lib/paymentForm";
import { SectionCard } from "../components/ui/SectionCard";
import { Button } from "../components/ui/Button";
import { formatPrice, formatDate } from "../lib/utils";

const AFTER_SALES_CATEGORIES = [
  "WRONG_PRESCRIPTION",
  "DAMAGED",
  "FIT_DISCOMFORT",
  "REMAKE",
  "RETURN_EXCHANGE",
  "ADDRESS_CHANGE",
  "INVOICE",
  "NOT_RECEIVED",
  "PRESCRIPTION_SUPPLEMENT",
  "OTHER",
] as const;

/**
 * Only return an external carrier tracking URL when carrier matches a verified official query URL.
 */
function getCarrierTrackingUrl(carrier?: string | null, trackingNumber?: string | null): string | null {
  const num = trackingNumber?.trim();
  const c = carrier?.trim().toLowerCase();
  if (!num || !c) return null;
  const enc = encodeURIComponent(num);
  if (c.includes("顺丰") || c.includes("sf")) {
    return `https://www.sf-express.com/chn/sc/dynamic_function/waybill/#search/bill-number/${enc}`;
  }
  if (c.includes("京东") || c.includes("jd")) {
    return `https://www.jdl.com/orderSearch?waybillCode=${enc}`;
  }
  if (c.includes("ems") || c.includes("邮政")) {
    return `https://www.ems.com.cn/queryList?mailNum=${enc}`;
  }
  return null;
}

export function OrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const { completeOrderCartCleanup } = useCart();
  const { t } = useTranslation("order");
  const { t: tCheckout } = useTranslation("checkout");

  const isAdminRoute = location.pathname.startsWith("/admin/orders/");
  const isAdminViewer = isAdminRoute || isStaffRole(user?.role);
  const backPath = isAdminRoute ? "/admin" : "/my-orders";
  const isDevMode = Boolean(import.meta.env.DEV);

  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [tickets, setTickets] = useState<AfterSalesTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsLoadError, setTicketsLoadError] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState<"resume" | "refresh" | "cancel" | "quote" | null>(null);
  const [paymentQueryUnknown, setPaymentQueryUnknown] = useState(false);
  const [quoteConflictNotice, setQuoteConflictNotice] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // After-sales form state
  const [ticketCategory, setTicketCategory] = useState<string>("FIT_DISCOMFORT");
  const [ticketReason, setTicketReason] = useState("");
  const [ticketContact, setTicketContact] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const afterSalesReasonRef = useRef<HTMLTextAreaElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const loadTickets = useCallback(async (targetOrderNum: string) => {
    setTicketsLoading(true);
    setTicketsLoadError(false);
    try {
      const list = await fetchOrderAfterSalesTickets(targetOrderNum);
      setTickets(list);
    } catch {
      setTicketsLoadError(true);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  const loadOrderDetails = useCallback(async () => {
    if (!orderNumber) return;
    setIsLoading(true);
    setError(null);
    setPaymentQueryUnknown(false);
    try {
      const data = isAdminViewer
        ? await adminFetchOrderDetail(orderNumber)
        : await fetchOrderDetail(orderNumber);
      setOrder(data);
      setTicketContact((prev) => prev || data.customerPhone || data.customerEmail || "");
      if (data.status === "PAID" || data.status === "SHIPPED" || data.status === "DELIVERED") {
        completeOrderCartCleanup(data.orderNumber);
        try {
          if (sessionStorage.getItem("klarheit_last_order_number") === data.orderNumber) {
            sessionStorage.removeItem("klarheit_last_order_number");
          }
        } catch {
          // ignore
        }
      }
      // Load tickets independently so ticket endpoint errors never break viewing the order
      void loadTickets(orderNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order details.");
    } finally {
      setIsLoading(false);
    }
  }, [orderNumber, isAdminViewer, completeOrderCartCleanup, loadTickets]);

  useEffect(() => {
    void loadOrderDetails();
  }, [loadOrderDetails]);

  const handleConfirmQuoteAndPay = async () => {
    if (!order || actionBusy) return;
    setActionBusy("quote");
    setActionMessage(null);
    setActionError(null);
    setQuoteConflictNotice(null);
    try {
      const channel = order.paymentChannel || "ALIPAY";
      const response =
        order.quoteVersion != null && order.quoteVersion > 0
          ? await confirmOrderQuote(order.orderNumber, channel, order.quoteVersion)
          : await confirmOrderQuote(order.orderNumber, channel);
      if (!response.payData) {
        await loadOrderDetails();
        return;
      }
      const validatedForm = parseAndValidatePaymentForm(response.payData, {
        allowMockEndpoint: isDevMode,
      });
      const action = validatedForm.getAttribute("action") ?? "";
      if (action.startsWith("/")) {
        try {
          const origin = new URL(getApiBaseUrl()).origin;
          validatedForm.setAttribute("action", origin + action);
        } catch {
          validatedForm.setAttribute("action", "http://localhost:8081" + action);
        }
      }
      const importedForm = document.importNode(validatedForm, true);
      importedForm.style.display = "none";
      document.body.appendChild(importedForm);
      HTMLFormElement.prototype.submit.call(importedForm);
    } catch (err) {
      if (isApiErrorWithStatus(err, 409)) {
        // P0-03: Quote was revised while customer had stale version open -> reload fresh quote & require re-confirmation
        setQuoteConflictNotice(t("quoteUpdatedReloadedNotice"));
        await loadOrderDetails();
      } else {
        setActionError(err instanceof Error ? err.message : "Failed to confirm quote.");
      }
    } finally {
      setActionBusy(null);
    }
  };

  const handleResumePayment = async () => {
    if (!order || actionBusy) return;
    setActionBusy("resume");
    setActionMessage(null);
    setActionError(null);
    try {
      const response = await resumeOrderPayment(order.orderNumber, "ALIPAY");
      if (response.status === "PAID" || response.status === "SHIPPED" || response.status === "DELIVERED") {
        await loadOrderDetails();
        return;
      }
      if (!response.payData) {
        throw new Error("Payment gateway did not return a payment form.");
      }
      const validatedForm = parseAndValidatePaymentForm(response.payData, {
        allowMockEndpoint: isDevMode,
      });
      const action = validatedForm.getAttribute("action") ?? "";
      if (action.startsWith("/")) {
        try {
          const origin = new URL(getApiBaseUrl()).origin;
          validatedForm.setAttribute("action", origin + action);
        } catch {
          validatedForm.setAttribute("action", "http://localhost:8081" + action);
        }
      }
      const importedForm = document.importNode(validatedForm, true);
      importedForm.style.display = "none";
      document.body.appendChild(importedForm);
      HTMLFormElement.prototype.submit.call(importedForm);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to resume payment.");
    } finally {
      setActionBusy(null);
    }
  };

  const handleRefreshPayment = async () => {
    if (!order || actionBusy) return;
    setActionBusy("refresh");
    setActionMessage(null);
    setActionError(null);
    try {
      const updated = await refreshOrderPaymentStatus(order.orderNumber);
      setOrder(updated);
      setPaymentQueryUnknown(false);
      if (updated.status === "PAID" || updated.status === "SHIPPED" || updated.status === "DELIVERED") {
        completeOrderCartCleanup(updated.orderNumber);
      }
    } catch {
      setPaymentQueryUnknown(true);
    } finally {
      setActionBusy(null);
    }
  };

  const handleCancelOrder = async () => {
    if (!order || actionBusy) return;
    if (!window.confirm(t("cancelOrderConfirm", { orderNumber: order.orderNumber }))) {
      return;
    }
    setActionBusy("cancel");
    setActionMessage(null);
    setActionError(null);
    try {
      const updated = await cancelMyOrder(order.orderNumber);
      setOrder(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to cancel order.");
    } finally {
      setActionBusy(null);
    }
  };

  const handleCopyTracking = async (trackingNum: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(trackingNum);
      }
      setCopiedTracking(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedTracking(false);
        copyTimerRef.current = null;
      }, 2500);
    } catch {
      // Fallback: leave text selectable
    }
  };

  const handleJumpToSupplement = () => {
    setTicketCategory("PRESCRIPTION_SUPPLEMENT");
    const formEl = document.getElementById("after-sales-form");
    formEl?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      afterSalesReasonRef.current?.focus();
    }, 150);
  };

  const handleJumpToTicketsHistory = () => {
    const historyEl = document.getElementById("after-sales-history");
    historyEl?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  };

  const handleCreateTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!order || !ticketReason.trim() || ticketSubmitting) return;
    setTicketSubmitting(true);
    setTicketSuccess(null);
    setTicketError(null);
    try {
      const created = await createAfterSalesTicket(order.orderNumber, {
        category: ticketCategory,
        reason: ticketReason.trim(),
        contactInfo: ticketContact.trim() || undefined,
      });
      setTickets((prev) => [created, ...prev]);
      setTicketsLoadError(false);
      setTicketReason("");
      setTicketSuccess(t("afterSalesSuccess", { ticketNumber: created.ticketNumber }));
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : "Failed to submit ticket.");
    } finally {
      setTicketSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full text-center py-32 text-sm uppercase tracking-[0.2em] text-slate-400">
        {t("loadingOrderDetails")}
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto py-20 px-5 text-center">
        <SectionCard className="border-red-200 bg-red-50/70" title={t("errorTitle")}>
          <p className="text-sm text-red-700 mb-6">{error || "Order not found"}</p>
          <Link to={backPath}>
            <Button variant="outline-light">{isAdminRoute ? t("backToAdmin") : t("backToOrders")}</Button>
          </Link>
        </SectionCard>
      </div>
    );
  }

  const normalizedStatus = order.status.toUpperCase();
  const isAwaitingReview = normalizedStatus === "AWAITING_REVIEW";
  const isQuoteReady = normalizedStatus === "QUOTE_READY";
  const isPendingPayment = normalizedStatus === "CREATED" || normalizedStatus === "PENDING_PAYMENT";
  const isCancelled =
    normalizedStatus === "CANCELLED" ||
    normalizedStatus === "REFUND_PENDING" ||
    normalizedStatus === "REFUNDED";

  const canCustomerCancel =
    !isAdminRoute &&
    (isPendingPayment ||
      isAwaitingReview ||
      isQuoteReady ||
      (normalizedStatus === "PAID" &&
        (!order.fulfillmentStatus ||
          order.fulfillmentStatus === "PENDING_REVIEW" ||
          order.fulfillmentStatus === "NEEDS_INFO")));

  const activeOpenTicket = tickets.find((tk) =>
    ["OPEN", "AWAITING_CUSTOMER", "IN_PROGRESS"].includes(tk.status.toUpperCase())
  );
  const trackingUrl = getCarrierTrackingUrl(order.carrier, order.trackingNumber);

  const statusSteps = [
    {
      key: "CREATED",
      label: normalizedStatus === "PENDING_PAYMENT" ? t("statusPendingPaymentLabel") : t("statusCreatedLabel"),
      desc: normalizedStatus === "PENDING_PAYMENT" ? t("statusPendingPaymentDesc") : t("statusCreatedDesc"),
    },
    { key: "PAID", label: t("statusPaidLabel"), desc: t("statusPaidDesc") },
    { key: "SHIPPED", label: t("statusShippedLabel"), desc: t("statusShippedDesc") },
    { key: "DELIVERED", label: t("statusDeliveredLabel"), desc: t("statusDeliveredDesc") },
  ];

  const currentStatusIndex =
    normalizedStatus === "PENDING_PAYMENT"
      ? 0
      : statusSteps.findIndex((step) => step.key === normalizedStatus);

  return (
    <div className="w-full bg-surface-offwhite px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto flex max-w-[1000px] flex-col gap-6">
        <Link
          to={backPath}
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 hover:text-brand-primary transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          {isAdminRoute ? t("backToAdmin") : t("backToOrders")}
        </Link>

        {/* Header summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              {t("orderNumber")}
            </span>
            <h1 className="text-xl font-display font-medium text-brand-primary tracking-wide mt-1">
              {order.orderNumber}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {t("orderedOn")}
              {formatDate(order.createdAt)}
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className="text-left sm:text-right">
              <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block">
                {isAwaitingReview
                  ? t("orderEstimatedTotal")
                  : isQuoteReady || isPendingPayment
                    ? t("orderTotalDue")
                    : normalizedStatus === "CANCELLED"
                      ? t("orderTotalAmount")
                      : t("totalPaid")}
              </span>
              <div className="mt-1 flex items-baseline gap-2 sm:justify-end">
                <span className="text-2xl font-semibold text-brand-primary">
                  {formatPrice(order.quoteRevisedAmount ?? order.totalAmount)}
                </span>
                {order.quoteRevisedAmount != null && Math.abs(order.quoteRevisedAmount - order.totalAmount) >= 0.01 && (
                  <span className="text-xs text-slate-400 line-through font-mono">
                    {formatPrice(order.totalAmount)}
                  </span>
                )}
              </div>
            </div>
            {!isAdminRoute && !isPendingPayment && !isQuoteReady && canCustomerCancel && (
              <Button
                type="button"
                variant="outline-light"
                size="sm"
                disabled={actionBusy !== null}
                onClick={handleCancelOrder}
                className="text-red-600 border-red-200 hover:bg-red-50 rounded-xl"
              >
                <XCircle className="w-4 h-4" />
                {actionBusy === "cancel" ? t("cancellingOrder") : t("cancelOrder")}
              </Button>
            )}
          </div>
        </div>

        {/* First-Screen Contextual Priority Action Banner */}
        {!isAdminRoute && paymentQueryUnknown ? (
          <div role="alert" className="rounded-3xl border border-amber-300 bg-amber-50 p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-amber-700">{t("heroActionEyebrow")}</p>
                <h3 className="text-sm font-semibold text-amber-900 mt-1">{t("heroStatusUnknownTitle")}</h3>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">{t("heroStatusUnknownDesc")}</p>
              </div>
            </div>
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={actionBusy !== null}
                onClick={handleRefreshPayment}
                className="rounded-xl"
              >
                <RefreshCw className={`w-4 h-4 ${actionBusy === "refresh" ? "animate-spin" : ""}`} />
                {actionBusy === "refresh" ? t("refreshing") : t("refreshPayment")}
              </Button>
            </div>
          </div>
        ) : !isAdminRoute && isAwaitingReview ? (
          <div className="rounded-3xl border border-amber-300 bg-amber-50/90 p-6 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <FileWarning className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest font-bold text-amber-700">{t("heroActionEyebrow")}</p>
                <h3 className="text-sm font-semibold text-amber-950">{t("heroAwaitingReviewTitle")}</h3>
                <p className="text-xs text-amber-800 leading-relaxed">{t("heroAwaitingReviewDesc")}</p>
                {order.prepayReviewReason && (
                  <p className="text-xs font-medium text-amber-900 bg-white/80 border border-amber-200 rounded-xl px-3 py-2">
                    {order.prepayReviewReason}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : !isAdminRoute && isQuoteReady ? (
          <div className="rounded-3xl border border-brand-cyan/40 bg-sky-50/90 p-6 flex flex-col gap-4">
            {quoteConflictNotice && (
              <div
                role="alert"
                className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{quoteConflictNotice}</span>
              </div>
            )}
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-brand-cyan shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-sky-700">{t("heroActionEyebrow")}</p>
                  {order.quoteVersion != null && order.quoteVersion > 0 && (
                    <span className="rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-brand-primary">
                      {t("quoteVersionBadge", { version: order.quoteVersion })}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-brand-primary">{t("heroQuoteReadyTitle")}</h3>
                <p className="text-xs text-slate-700 leading-relaxed">{t("heroQuoteReadyDesc")}</p>
                <div className="rounded-xl bg-white border border-sky-200/80 p-3 text-xs space-y-1 text-slate-700">
                  <p>
                    <span className="font-semibold text-brand-primary">{t("revisedQuoteAmount")}</span>
                    <span className="font-mono font-bold text-brand-primary">
                      {formatPrice(order.quoteRevisedAmount ?? order.totalAmount)}
                    </span>
                  </p>
                  {order.estimatedDeliveryDate && (
                    <p>
                      <span className="font-semibold text-brand-primary">{t("estimatedDelivery")}</span>
                      {order.estimatedDeliveryDate}
                    </p>
                  )}
                  {order.quoteExpiresAt && (
                    <p>
                      <span className="font-semibold text-brand-primary">{t("quoteExpiresAtLabel")}</span>
                      {formatDate(order.quoteExpiresAt)}
                    </p>
                  )}
                  {order.quoteChangeSummary && (
                    <p className="text-amber-900 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1.5 mt-1">
                      <span className="font-semibold">{t("quoteChangeSummaryLabel")}</span>
                      {order.quoteChangeSummary}
                    </p>
                  )}
                  {order.quoteNote && (
                    <p>
                      <span className="font-semibold text-brand-primary">{t("quoteNoteLabel")}</span>
                      {order.quoteNote}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" size="sm" disabled={actionBusy !== null} onClick={handleConfirmQuoteAndPay} className="rounded-xl">
                <CreditCard className="w-4 h-4" />
                {t("confirmQuoteAndPay")}
              </Button>
              <Button type="button" variant="outline-light" size="sm" disabled={actionBusy !== null} onClick={handleCancelOrder} className="rounded-xl">
                <XCircle className="w-4 h-4" />
                {actionBusy === "cancel" ? t("cancellingOrder") : t("cancelOrder")}
              </Button>
            </div>
          </div>
        ) : !isAdminRoute && isPendingPayment ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-amber-700">{t("heroActionEyebrow")}</p>
                <h3 className="text-sm font-semibold text-amber-900 mt-1">{t("paymentPendingBannerTitle")}</h3>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">{t("paymentPendingBannerDesc")}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" size="sm" disabled={actionBusy !== null} onClick={handleResumePayment} className="rounded-xl">
                <CreditCard className="w-4 h-4" />
                {t("continuePayment")}
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={actionBusy !== null} onClick={handleRefreshPayment} className="rounded-xl">
                <RefreshCw className={`w-4 h-4 ${actionBusy === "refresh" ? "animate-spin" : ""}`} />
                {actionBusy === "refresh" ? t("refreshing") : t("refreshPayment")}
              </Button>
              <Button type="button" variant="outline-light" size="sm" disabled={actionBusy !== null} onClick={handleCancelOrder} className="rounded-xl">
                <XCircle className="w-4 h-4" />
                {actionBusy === "cancel" ? t("cancellingOrder") : t("cancelOrder")}
              </Button>
            </div>
          </div>
        ) : !isAdminRoute && activeOpenTicket ? (
          <div className="rounded-3xl border border-sky-200 bg-sky-50/80 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <LifeBuoy className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-sky-700">{t("heroActionEyebrow")}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-sky-950">
                    {t("heroOpenTicketTitle")}
                  </h3>
                  <span className="inline-flex items-center rounded-full border border-sky-200 bg-white px-2.5 py-0.5 font-mono text-[11px] font-semibold text-sky-800 whitespace-nowrap">
                    {activeOpenTicket.ticketNumber}
                  </span>
                </div>
                <p className="text-xs text-sky-800 mt-1">{t("heroOpenTicketDesc")}</p>
              </div>
            </div>
            <Button type="button" size="sm" onClick={handleJumpToTicketsHistory} className="shrink-0 rounded-xl">
              {t("heroOpenTicketAction")}
            </Button>
          </div>
        ) : !isAdminRoute && !isCancelled && order.fulfillmentStatus === "NEEDS_INFO" ? (
          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <FileWarning className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-amber-700">{t("heroActionEyebrow")}</p>
                <h3 className="text-sm font-semibold text-amber-950 mt-1">{t("heroNeedsInfoTitle")}</h3>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">{t("heroNeedsInfoDesc")}</p>
              </div>
            </div>
            <Button type="button" size="sm" onClick={handleJumpToSupplement} className="shrink-0 rounded-xl">
              {t("heroNeedsInfoAction")}
            </Button>
          </div>
        ) : !isAdminRoute && normalizedStatus === "SHIPPED" && order.trackingNumber ? (
          <div className="rounded-3xl border border-indigo-200 bg-indigo-50/70 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-700">{t("heroActionEyebrow")}</p>
                <h3 className="text-sm font-semibold text-indigo-950 mt-1">{t("heroShippedTitle")}</h3>
                <p className="text-xs text-indigo-800 mt-1 font-mono">
                  {t("heroShippedDesc", {
                    carrier: order.carrier || "—",
                    trackingNumber: order.trackingNumber,
                  })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                onClick={() => handleCopyTracking(order.trackingNumber!)}
                className="rounded-xl"
              >
                {copiedTracking ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedTracking ? t("copiedTracking") : t("copyTracking")}
              </Button>
              {trackingUrl && (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-white px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-800 hover:bg-indigo-50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t("trackShipment")}
                </a>
              )}
            </div>
          </div>
        ) : null}

        {actionMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-xs text-emerald-800">
            {actionMessage}
          </div>
        )}
        {actionError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-xs text-red-700">
            {actionError}
          </div>
        )}

        {/* Order Status Timeline */}
        <SectionCard
          title={t("orderStatusTracking")}
          eyebrow={t("trackingEyebrow")}
          description={t("orderStatusDesc")}
        >
          {isCancelled ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h4 className="text-sm font-semibold text-red-700">
                  {normalizedStatus === "REFUNDED"
                    ? t("orderRefunded")
                    : normalizedStatus === "REFUND_PENDING"
                      ? t("orderRefundPending")
                      : t("orderCancelled")}
                </h4>
                <p className="text-xs text-red-600 leading-relaxed">
                  {normalizedStatus === "REFUNDED"
                    ? t("orderRefundedDesc")
                    : normalizedStatus === "REFUND_PENDING"
                      ? t("orderRefundPendingDesc")
                      : t("orderCancelledDesc")}
                </p>
                {order.confirmedRefundAmount !== undefined && order.confirmedRefundAmount !== null && order.confirmedRefundAmount > 0 ? (
                  <p className="text-xs font-medium text-emerald-700">
                    {t("confirmedRefundAmountLabel")}
                    {formatPrice(order.confirmedRefundAmount)}
                  </p>
                ) : order.refundAmount !== undefined && order.refundAmount !== null && order.refundAmount > 0 && (!order.pendingRefundAmount || order.pendingRefundAmount <= 0) ? (
                  <p className="text-xs font-medium text-red-700">
                    {t("refundAmount")}: {formatPrice(order.refundAmount)}
                  </p>
                ) : null}
                {order.pendingRefundAmount !== undefined && order.pendingRefundAmount !== null && order.pendingRefundAmount > 0 && (
                  <p className="text-xs font-medium text-amber-800">
                    {t("pendingRefundAmountLabel")}
                    {formatPrice(order.pendingRefundAmount)}
                  </p>
                )}
                {order.refundReason && (
                  <p className="text-xs text-red-700">
                    {t("refundReason")}: {order.refundReason}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-start gap-8 md:gap-4 mt-4 px-4 relative">
              {statusSteps.map((step, idx) => {
                const isCompleted = idx <= currentStatusIndex;
                const isActive = idx === currentStatusIndex;

                return (
                  <div key={step.key} className="flex md:flex-col items-center md:items-center text-left md:text-center gap-4 md:gap-3 flex-1 relative">
                    {idx < statusSteps.length - 1 && (
                      <div
                        className={`hidden md:block absolute top-[18px] left-[50%] right-[-50%] h-[2px] z-0 transition-colors ${
                          idx < currentStatusIndex ? "bg-brand-cyan" : "bg-slate-200"
                        }`}
                      />
                    )}

                    <div className="z-10 shrink-0">
                      {isCompleted ? (
                        <div className={`flex items-center justify-center w-9 h-9 rounded-full ${
                          isActive ? "bg-brand-cyan text-white shadow-lg shadow-brand-cyan/20" : "bg-brand-primary text-white"
                        }`}>
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 border-2 border-slate-200 text-slate-400">
                          <Circle className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-semibold ${isCompleted ? "text-brand-primary" : "text-slate-400"}`}>
                        {step.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-light max-w-[140px] md:mx-auto">
                        {step.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fulfillment Sub-status */}
          {!isCancelled && (order.fulfillmentStatus || order.fulfillmentNote || order.estimatedDeliveryDate || order.deliveredAt) && (
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-4 bg-slate-50/70 rounded-2xl p-4 border border-slate-200/60">
              <Wrench className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold uppercase tracking-wider text-slate-400 text-[10px]">
                    {t("fulfillmentTitle")}
                  </span>
                  {order.fulfillmentStatus && (
                    <span className="inline-flex items-center rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-primary whitespace-nowrap">
                      {order.fulfillmentStatus === "PENDING_REVIEW" &&
                      Boolean(order.opticianVerifiedAt) &&
                      (isQuoteReady || isPendingPayment)
                        ? t("fulfillment.QUOTE_CONFIRMED_AWAITING_PAYMENT")
                        : t("fulfillment." + order.fulfillmentStatus, { defaultValue: order.fulfillmentStatus })}
                    </span>
                  )}
                </div>
                {order.fulfillmentNote && (
                  <p className="text-slate-700">
                    <span className="font-semibold">{t("fulfillmentNoteLabel")}</span>
                    {order.fulfillmentNote}
                  </p>
                )}
                {order.initialPromisedDeliveryDate && (
                  <p className="text-slate-600">
                    <span className="font-semibold">{t("initialPromisedDate")}</span>
                    {order.initialPromisedDeliveryDate}
                  </p>
                )}
                {order.estimatedDeliveryDate &&
                  order.initialPromisedDeliveryDate &&
                  order.estimatedDeliveryDate !== order.initialPromisedDeliveryDate && (
                    <p
                      className={
                        order.estimatedDeliveryDate > order.initialPromisedDeliveryDate
                          ? "text-amber-700 font-medium"
                          : "text-emerald-700 font-medium"
                      }
                    >
                      <span className="font-semibold">{t("estimatedDelivery")}</span>
                      {order.estimatedDeliveryDate}
                    </p>
                  )}
                {order.estimatedDeliveryDate && !order.initialPromisedDeliveryDate && (
                  <p className="text-slate-600">
                    <span className="font-semibold">{t("estimatedDelivery")}</span>
                    {order.estimatedDeliveryDate}
                  </p>
                )}
                {order.deliveryDelayReason && (
                  <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    <span className="font-semibold">{t("deliveryDelayReasonLabel")}</span>
                    {order.deliveryDelayReason}
                  </p>
                )}
                {order.opticianVerifiedAt && (
                  <p className="text-slate-600">
                    <span className="font-semibold">{t("opticianVerifiedLabel")}</span>
                    {`${order.opticianVerifiedBy || "—"} (${formatDate(order.opticianVerifiedAt)})`}
                  </p>
                )}
                {order.qcStatus && (
                  <p className="text-slate-600">
                    <span className="font-semibold">{t("qcStatusLabel")}</span>
                    {t("qcStatuses." + order.qcStatus, { defaultValue: order.qcStatus })}
                    {order.qcNote ? ` · ${order.qcNote}` : ""}
                  </p>
                )}
                {order.deliveredAt && (
                  <p className="text-emerald-700">
                    <span className="font-semibold">{t("deliveredAt")}</span>
                    {formatDate(order.deliveredAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {(order.carrier || order.trackingNumber) && (
            <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 rounded-2xl p-4 border border-slate-200/50">
              <div className="flex items-start gap-4">
                <Truck className="w-5 h-5 text-brand-cyan shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-brand-primary uppercase tracking-wider">
                    {t("shippingLogistics")}
                  </h4>
                  <p className="text-sm font-medium text-brand-primary mt-1.5">
                    {t("carrier")}
                    <span className="text-slate-600 font-normal">{order.carrier || "—"}</span>
                  </p>
                  <p className="text-sm font-medium text-brand-primary mt-1">
                    {t("trackingNumber")}
                    <span className="text-slate-600 font-mono font-normal">{order.trackingNumber || "—"}</span>
                  </p>
                </div>
              </div>
              {order.trackingNumber && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyTracking(order.trackingNumber!)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-brand-primary hover:bg-slate-50 transition-colors"
                  >
                    {copiedTracking ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedTracking ? t("copiedTracking") : t("copyTracking")}
                  </button>
                  {trackingUrl && (
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-brand-primary hover:bg-slate-50 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t("trackShipment")}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Detailed Itemization */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-8 flex flex-col gap-6">
            <SectionCard title={t("selectedItem")} eyebrow={t("productEyebrow")}>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-32 h-24 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center p-3 overflow-hidden shrink-0">
                  <img src={order.productImageUrl} alt={order.productName} className="object-contain max-h-full" loading="lazy" />
                </div>
                <div className="flex-1 w-full text-center sm:text-left">
                  <h3 className="text-lg font-display font-medium text-brand-primary">{order.productName}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {t("productSubtitle")}
                    {order.sizeSpecSnapshot ? ` · ${t("sizeSpecLabel")}${order.sizeSpecSnapshot}` : ""}
                  </p>

                  {order.lensOptions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 justify-center sm:justify-start">
                      {order.lensOptions.map((lo) => (
                        <span key={lo.type} className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600 font-medium">
                          {tCheckout("lens." + lo.type + ".label", { defaultValue: lo.label })} (+{formatPrice(lo.additionalPrice)})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            {order.prescription && (
              <SectionCard
                title={t("opticalPrescription")}
                eyebrow={t("prescriptionEyebrow")}
                description={t("prescriptionDesc")}
              >
                {order.wearerName && (
                  <p className="text-xs text-slate-600 mb-3">
                    <span className="font-semibold text-brand-primary">{t("wearerName")}</span>
                    {order.wearerName}
                  </p>
                )}
                <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50">
                  <div className="grid grid-cols-2 divide-x divide-slate-200">
                    <div className="p-4 bg-white">
                      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 text-center mb-3">
                        {t("rightEye")}
                      </p>
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-semibold">SPH</span>
                          <span className="font-mono font-medium text-brand-primary">{order.prescription.sphOd.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-semibold">CYL</span>
                          <span className="font-mono font-medium text-brand-primary">{order.prescription.cylOd.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-semibold">AXIS</span>
                          <span className="font-mono font-medium text-brand-primary">{order.prescription.axisOd}°</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-white">
                      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 text-center mb-3">
                        {t("leftEye")}
                      </p>
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-semibold">SPH</span>
                          <span className="font-mono font-medium text-brand-primary">{order.prescription.sphOs.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-semibold">CYL</span>
                          <span className="font-mono font-medium text-brand-primary">{order.prescription.cylOs.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-semibold">AXIS</span>
                          <span className="font-mono font-medium text-brand-primary">{order.prescription.axisOs}°</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 p-4 bg-white flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider">{t("pupillaryDistance")}</span>
                    <span className="font-mono font-medium text-brand-primary">{order.prescription.pd.toFixed(1)} mm</span>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* After-Sales, Address Change & Invoice Panel */}
            <SectionCard
              title={t("afterSalesTitle")}
              eyebrow={t("afterSalesEyebrow")}
              description={t("afterSalesDesc")}
            >
              {!isAdminRoute && (
                <form
                  id="after-sales-form"
                  onSubmit={handleCreateTicket}
                  className="space-y-4 mb-6 pb-6 border-b border-slate-100"
                >
                  <p className="rounded-xl bg-slate-50 border border-slate-200/70 px-3.5 py-2.5 text-xs text-slate-600 leading-relaxed">
                    {t("supplementGuidanceNote")}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                        {t("afterSalesCategory")}
                      </label>
                      <select
                        value={ticketCategory}
                        onChange={(e) => setTicketCategory(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-brand-primary focus:border-brand-primary focus:outline-none"
                      >
                        {AFTER_SALES_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {t("categories." + cat)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                        {t("afterSalesContact")}
                      </label>
                      <input
                        type="text"
                        value={ticketContact}
                        onChange={(e) => setTicketContact(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-brand-primary focus:border-brand-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                      {t("afterSalesReason")}
                    </label>
                    <textarea
                      ref={afterSalesReasonRef}
                      required
                      rows={3}
                      value={ticketReason}
                      onChange={(e) => setTicketReason(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-brand-primary focus:border-brand-primary focus:outline-none"
                    />
                  </div>
                  {ticketSuccess && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-700">
                      {ticketSuccess}
                    </div>
                  )}
                  {ticketError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
                      {ticketError}
                    </div>
                  )}
                  <Button type="submit" size="sm" disabled={ticketSubmitting || !ticketReason.trim()} className="rounded-xl">
                    <MessageSquarePlus className="w-4 h-4" />
                    {ticketSubmitting ? t("afterSalesSubmitting") : t("afterSalesSubmit")}
                  </Button>
                </form>
              )}

              <div id="after-sales-history">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">
                  {t("afterSalesHistory")}
                </p>
                {ticketsLoadError ? (
                  <div
                    role="alert"
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <span className="text-xs font-medium text-amber-900">{t("ticketsLoadFailed")}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={ticketsLoading}
                      onClick={() => orderNumber && void loadTickets(orderNumber)}
                      className="rounded-xl shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${ticketsLoading ? "animate-spin" : ""}`} />
                      {t("retryLoadTickets")}
                    </Button>
                  </div>
                ) : tickets.length === 0 ? (
                  <p className="text-xs text-slate-400">{t("afterSalesEmpty")}</p>
                ) : (
                  <div className="space-y-3">
                    {tickets.map((tk) => (
                      <div key={tk.ticketNumber} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-brand-primary">{tk.ticketNumber}</span>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
                              {t("categories." + tk.category, { defaultValue: tk.category })}
                            </span>
                            <span className="rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-brand-primary">
                              {t("ticketStatus." + tk.status, { defaultValue: tk.status })}
                            </span>
                          </div>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{tk.reason}</p>
                        {tk.assignee && (
                          <p className="text-slate-500">
                            <span className="font-semibold">{t("afterSalesAssignee")}</span>
                            {tk.assignee}
                          </p>
                        )}
                        {tk.resolutionNote && (
                          <p className="text-emerald-700">
                            <span className="font-semibold">{t("afterSalesResolution")}</span>
                            {tk.resolutionNote}
                          </p>
                        )}
                        {tk.nextContactAt && (
                          <p className="text-slate-500">
                            <span className="font-semibold">{t("afterSalesNextContact")}</span>
                            {formatDate(tk.nextContactAt)}
                          </p>
                        )}
                        {(tk.returnCarrier || tk.returnTrackingNumber) && (
                          <p className="text-slate-600 font-mono">
                            <span className="font-sans font-semibold">{t("ticketReturnTracking")}</span>
                            {`${tk.returnCarrier || ""} ${tk.returnTrackingNumber || ""}`.trim()}
                          </p>
                        )}
                        {tk.returnQcResult && (
                          <p className="text-slate-600 flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{t("ticketReturnQc")}</span>
                            <span>{t("returnQc." + tk.returnQcResult, { defaultValue: tk.returnQcResult })}</span>
                            {tk.returnQcNote ? <span>{`· ${tk.returnQcNote}`}</span> : null}
                            {tk.returnRestocked && (
                              <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold">
                                {t("ticketRestockedBadge")}
                              </span>
                            )}
                          </p>
                        )}
                        {(tk.remakeOrderNumber || tk.remakeTrackingNumber) && (
                          <p className="text-indigo-700 font-mono">
                            <span className="font-sans font-semibold">{t("ticketRemakeTracking")}</span>
                            {[tk.remakeOrderNumber, tk.remakeCarrier, tk.remakeTrackingNumber].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {tk.refundTransactions && tk.refundTransactions.length > 0 ? (
                          <div className="space-y-1.5 pt-1">
                            {tk.refundTransactions.map((rtx: RefundTransactionRecord) => {
                              const st = (rtx.status || "").toUpperCase();
                              const isConfirmed = st === "CONFIRMED";
                              const isFailed = st === "FAILED";
                              const badgeStyle = isConfirmed
                                ? "bg-emerald-100 text-emerald-800"
                                : isFailed
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-800";
                              return (
                                <div
                                  key={rtx.refundRequestId}
                                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                                >
                                  <span className="font-semibold text-slate-700">{t("ticketRefundRecord")}</span>
                                  <span className="font-mono font-semibold text-brand-primary">
                                    {formatPrice(isConfirmed ? (rtx.confirmedAmount ?? rtx.requestedAmount) : rtx.requestedAmount)}
                                  </span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeStyle}`}>
                                    {t("refundTxStatus." + st, { defaultValue: st })}
                                  </span>
                                  {(rtx.gatewayRefundId || rtx.manualVoucherRef) && (
                                    <span className="font-mono text-[10px] text-slate-500">
                                      {rtx.gatewayRefundId || rtx.manualVoucherRef}
                                    </span>
                                  )}
                                  {rtx.financeVerifiedAt && (
                                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold">
                                      {t("ticketFinanceVerified")}
                                    </span>
                                  )}
                                  {!isConfirmed && (
                                    <p className="w-full text-[11px] text-amber-800 mt-0.5">
                                      {t("refundNotCompletedNotice")}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : tk.refundAmount != null && tk.refundAmount > 0 ? (
                          <p className="text-emerald-700 flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{t("ticketRefundRecord")}</span>
                            <span className="font-mono font-semibold">{formatPrice(tk.refundAmount)}</span>
                            {tk.refundTransactionId ? <span className="font-mono text-[10px] text-slate-500">{tk.refundTransactionId}</span> : null}
                            {tk.financeVerifiedAt && (
                              <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold">
                                {t("ticketFinanceVerified")}
                              </span>
                            )}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          <div className="md:col-span-4 flex flex-col gap-6">
            <SectionCard title={t("shippingAddress")} eyebrow={t("recipientEyebrow")}>
              <div className="flex flex-col gap-3 text-sm text-slate-600 font-light leading-relaxed">
                <div className="flex items-center gap-2 font-medium text-brand-primary">
                  <User className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
                  <span>{`${order.customerFirstName} ${order.customerLastName || ""}`.trim()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono text-xs">{order.customerEmail}</span>
                </div>
                {order.customerPhone && (
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.5} />
                    <span>{order.customerPhone}</span>
                  </div>
                )}
                <p className="mt-2 border-t border-slate-100 pt-3 text-xs flex gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span>{order.shippingAddress}</span>
                </p>
              </div>
            </SectionCard>

            <SectionCard title={t("paymentDetail")} eyebrow={t("billingEyebrow")}>
              <div className="flex flex-col gap-2.5 text-xs text-slate-500 font-light">
                <div className="flex justify-between">
                  <span>{t("paymentMethod")}</span>
                  <span className="font-semibold text-brand-primary">
                    {t("paymentChannels." + (order.paymentChannel || "ALIPAY").toUpperCase(), {
                      defaultValue: order.paymentChannel || "ALIPAY",
                    })}
                  </span>
                </div>
                {order.appliedCouponCode && (
                  <div className="flex justify-between">
                    <span>{t("couponUsed")}</span>
                    <span className="font-semibold text-brand-cyan">{order.appliedCouponCode}</span>
                  </div>
                )}
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-brand-cyan">
                    <span>{t("discount")}</span>
                    <span>-{formatPrice(order.discountAmount)}</span>
                  </div>
                )}
                {order.shippingFee != null && order.shippingFee > 0 && (
                  <div className="flex justify-between">
                    <span>{t("shippingFeeLabel")}</span>
                    <span className="font-mono font-semibold text-brand-primary">{formatPrice(order.shippingFee)}</span>
                  </div>
                )}
                {order.refundTransactions && order.refundTransactions.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2.5 mt-1">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                      {t("refundLedgerTitle")}
                    </span>
                    {order.refundTransactions.map((rtx) => {
                      const st = (rtx.status || "").toUpperCase();
                      const isConfirmed = st === "CONFIRMED";
                      const isFailed = st === "FAILED";
                      return (
                        <div key={rtx.refundRequestId} className="flex items-center justify-between gap-2 text-[11px]">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isConfirmed
                                ? "bg-emerald-100 text-emerald-800"
                                : isFailed
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {t("refundTxStatus." + st, { defaultValue: st })}
                          </span>
                          <span className="font-mono font-semibold text-brand-primary">
                            {formatPrice(isConfirmed ? (rtx.confirmedAmount ?? rtx.requestedAmount) : rtx.requestedAmount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {order.gatewayTransactionId && (
                  <div className="flex flex-col gap-1 border-t border-slate-100 pt-2.5 mt-1">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                      {t("gatewayTransactionId")}
                    </span>
                    <span className="font-mono text-[10px] text-slate-600 break-all">{order.gatewayTransactionId}</span>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
