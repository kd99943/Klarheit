import { AlertCircle, CheckCircle2, Package, RefreshCw, Truck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { useCart } from "../hooks/useCart";
import { formatPrice } from "../lib/utils";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { track } from "../services/analytics";
import {
  fetchOrderDetail,
  refreshOrderPaymentStatus,
  type OrderDetailResponse,
} from "../services/api";

type OrderConfirmationState = {
  orderNumber?: string;
  status?: string;
  totalAmount?: number;
  productName?: string;
  lensOptionTypes?: string[];
  cartItemId?: string;
  customer?: { firstName: string; lastName?: string; email: string; phone?: string; shippingAddress: string };
};

const LAST_ORDER_KEY = "klarheit_last_order_number";

export function OrderConfirmationPage() {
  const { t } = useTranslation("confirmation");
  const { t: tAccount } = useTranslation("account");
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state as OrderConfirmationState | null;
  const { completeOrderCartCleanup } = useCart();

  const resolvedOrderNumber =
    state?.orderNumber ||
    searchParams.get("orderNumber") ||
    searchParams.get("out_trade_no") ||
    (() => {
      try {
        return sessionStorage.getItem(LAST_ORDER_KEY) || undefined;
      } catch {
        return undefined;
      }
    })();

  const [liveOrder, setLiveOrder] = useState<OrderDetailResponse | null>(null);
  const [queryState, setQueryState] = useState<"loading" | "confirmed" | "unknown">(
    resolvedOrderNumber ? "loading" : "unknown"
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!resolvedOrderNumber) return;
    setQueryState("loading");
    try {
      const detail = await fetchOrderDetail(resolvedOrderNumber);
      setLiveOrder(detail);
      setQueryState("confirmed");
      if (detail.status === "PAID" || detail.status === "SHIPPED" || detail.status === "DELIVERED") {
        completeOrderCartCleanup(detail.orderNumber, state?.cartItemId);
        try {
          sessionStorage.removeItem(LAST_ORDER_KEY);
        } catch {
          // ignore
        }
      }
    } catch {
      // Never fabricate ¥0 or PENDING_PAYMENT when server lookup fails
      setQueryState("unknown");
    }
  }, [resolvedOrderNumber, completeOrderCartCleanup, state?.cartItemId]);

  useEffect(() => {
    if (!resolvedOrderNumber) return;
    track("order_confirmation_viewed", {});
    void loadOrder();

    if (state?.status === "PAID") {
      completeOrderCartCleanup(resolvedOrderNumber, state.cartItemId);
      try {
        sessionStorage.removeItem(LAST_ORDER_KEY);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedOrderNumber]);

  const handleRefreshPayment = async () => {
    if (!resolvedOrderNumber || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const updated = await refreshOrderPaymentStatus(resolvedOrderNumber);
      setLiveOrder(updated);
      setQueryState("confirmed");
      if (updated.status === "PAID" || updated.status === "SHIPPED" || updated.status === "DELIVERED") {
        completeOrderCartCleanup(updated.orderNumber, state?.cartItemId);
        try {
          sessionStorage.removeItem(LAST_ORDER_KEY);
        } catch {
          // ignore
        }
      }
    } catch {
      setQueryState("unknown");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!resolvedOrderNumber) {
    return (
      <div className="flex-1 w-full bg-surface-offwhite py-10 lg:py-16 px-5 sm:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-slate-500">{t("noOrderInfo")}</p>
          <Link to="/collections" className="mt-4 inline-block">
            <Button variant="outline-light">{t("browseCollections")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (queryState === "loading" && !liveOrder && !state?.productName) {
    return (
      <div className="flex-1 w-full bg-surface-offwhite py-24 px-5 sm:px-8 text-center">
        <p className="text-sm text-slate-500">{t("loadingOrder")}</p>
      </div>
    );
  }

  const isStatusUnknown = queryState === "unknown" && !liveOrder;
  const confirmedStatus = liveOrder?.status ?? (queryState === "confirmed" ? state?.status : undefined);
  const displayStatus = confirmedStatus ? confirmedStatus.toUpperCase() : null;
  const isConfirmedPending = displayStatus === "CREATED" || displayStatus === "PENDING_PAYMENT";
  const isConfirmedPaid = displayStatus === "PAID" || displayStatus === "SHIPPED" || displayStatus === "DELIVERED";

  const displayProductName = liveOrder?.productName ?? state?.productName ?? "—";
  const displayTotal = liveOrder?.totalAmount ?? state?.totalAmount;
  const displayShippingAddress = liveOrder?.shippingAddress ?? state?.customer?.shippingAddress ?? "—";
  const displayPhone = liveOrder?.customerPhone ?? state?.customer?.phone;
  const displayLensTypes = liveOrder
    ? liveOrder.lensOptions.map((o) => o.type)
    : (state?.lensOptionTypes ?? []);

  return (
    <div className="flex-1 w-full bg-surface-offwhite py-10 lg:py-16 px-5 sm:px-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <PageIntro
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          actions={
            <div
              className={`rounded-2xl border px-4 py-3 shadow-sm ${
                isStatusUnknown || isConfirmedPending
                  ? "border-amber-200 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <div className="flex items-center gap-2">
                {isStatusUnknown ? (
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                ) : (
                  <CheckCircle2 className={`h-5 w-5 ${isConfirmedPending ? "text-amber-600" : "text-emerald-600"}`} />
                )}
                <p
                  className={`text-sm font-semibold ${
                    isStatusUnknown || isConfirmedPending ? "text-amber-800" : "text-emerald-700"
                  }`}
                >
                  {isStatusUnknown
                    ? t("statusUnknownLabel")
                    : isConfirmedPending
                      ? t("statusConfirming")
                      : t("statusPaid")}
                </p>
              </div>
            </div>
          }
        />

        {/* Unknown Status Recovery Card (never defaults to ¥0 or unpaid) */}
        {isStatusUnknown && (
          <div
            role="alert"
            className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">{t("statusUnknownTitle")}</p>
              <p className="text-xs text-amber-800 leading-relaxed">{t("statusUnknownDesc")}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isRefreshing}
              onClick={handleRefreshPayment}
              className="shrink-0 rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              {t("retryQuery")}
            </Button>
          </div>
        )}

        {/* Confirmed Pending Payment Refresh Card */}
        {!isStatusUnknown && isConfirmedPending && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-amber-800">{t("statusConfirming")}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isRefreshing}
              onClick={handleRefreshPayment}
              className="shrink-0 rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              {t("refreshStatus")}
            </Button>
          </div>
        )}

        <SectionCard eyebrow={t("details.eyebrow")} title={resolvedOrderNumber} description={t("details.description")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-slate-50 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("details.product")}</p>
              <p className="mt-2 text-lg font-display font-medium text-brand-primary">{displayProductName}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("details.status")}</p>
              <p className="mt-2 text-lg font-display font-medium text-brand-primary">
                {displayStatus
                  ? tAccount("orders.statusLabels." + displayStatus, { defaultValue: displayStatus })
                  : t("statusUnknownLabel")}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("details.total")}</p>
              <p className="mt-2 text-lg font-display font-medium text-brand-primary">
                {displayTotal !== undefined ? formatPrice(displayTotal) : "—"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("details.shippingTo")}</p>
              <p className="mt-2 text-sm text-brand-primary">{displayShippingAddress}</p>
              {displayPhone && <p className="mt-1 text-xs font-mono text-slate-500">{displayPhone}</p>}
            </div>
          </div>
          {displayLensTypes.length > 0 && (
            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">
                {t("details.lensConfiguration")}
              </p>
              <div className="flex flex-col gap-2">
                {displayLensTypes.map((type) => (
                  <div key={type} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-brand-primary">
                    {t("lensLabels." + type, { defaultValue: type })}
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="mt-5 text-xs text-slate-500 border-t border-slate-100 pt-4">{t("deliveryNote")}</p>
        </SectionCard>

        <SectionCard eyebrow={t("timeline.eyebrow")} title={t("timeline.title")} description={t("timeline.description")}>
          <div className="flex flex-col gap-4">
            {[
              { icon: CheckCircle2, label: t("timeline.orderConfirmed"), description: t("timeline.orderConfirmedDesc"), active: !isStatusUnknown },
              { icon: Package, label: t("timeline.lensCrafting"), description: t("timeline.lensCraftingDesc"), active: isConfirmedPaid },
              { icon: Truck, label: t("timeline.shipped"), description: t("timeline.shippedDesc"), active: displayStatus === "SHIPPED" || displayStatus === "DELIVERED" },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${step.active ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-400"}`}>
                  <step.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-brand-primary">{step.label}</p>
                  <p className="text-sm text-slate-500 mt-1">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="flex flex-col gap-3 sm:flex-row flex-wrap">
          <Link to={`/order/${resolvedOrderNumber}`} className="w-full sm:w-auto">
            <Button className="w-full">{t("viewOrderDetail")}</Button>
          </Link>
          <Link to="/my-orders" className="w-full sm:w-auto">
            <Button variant="outline-light" className="w-full">{t("viewMyOrders")}</Button>
          </Link>
          <Link to="/collections" className="w-full sm:w-auto">
            <Button variant="outline-light" className="w-full">{t("continueShopping")}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
