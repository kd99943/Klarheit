import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Box, CheckCircle2, Circle, Truck, AlertCircle, FileText, User, CreditCard, MapPin } from "lucide-react";
import { fetchOrderDetail, type OrderDetailResponse } from "../services/api";
import { SectionCard } from "../components/ui/SectionCard";
import { Button } from "../components/ui/Button";
import { formatPrice, formatDate } from "../lib/utils";

export function OrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("order");

  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrderDetails() {
      if (!orderNumber) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchOrderDetail(orderNumber);
        setOrder(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load order details.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadOrderDetails();
  }, [orderNumber]);

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
          <Link to="/my-account">
            <Button variant="outline-light">{t("backToAccount")}</Button>
          </Link>
        </SectionCard>
      </div>
    );
  }

  // Timeline statuses
  const statusSteps = [
    { key: "CREATED", label: t("statusCreatedLabel"), desc: t("statusCreatedDesc") },
    { key: "PAID", label: t("statusPaidLabel"), desc: t("statusPaidDesc") },
    { key: "SHIPPED", label: t("statusShippedLabel"), desc: t("statusShippedDesc") },
    { key: "DELIVERED", label: t("statusDeliveredLabel"), desc: t("statusDeliveredDesc") },
  ];

  const currentStatusIndex = statusSteps.findIndex((step) => step.key === order.status.toUpperCase());
  const isCancelled = order.status.toUpperCase() === "CANCELLED";

  return (
    <div className="w-full bg-surface-offwhite px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto flex max-w-[1000px] flex-col gap-6">
        {/* Back Navigation */}
        <Link
          to="/my-account"
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 hover:text-brand-primary transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t("backToAccount")}
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

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block">
              {t("totalPaid")}
            </span>
            <span className="text-2xl font-semibold text-brand-primary mt-1 block">
              {formatPrice(order.totalAmount)}
            </span>
          </div>
        </div>

        {/* Order Status Timeline */}
        <SectionCard
          title={t("orderStatusTracking")}
          eyebrow={t("trackingEyebrow")}
          description={t("orderStatusDesc")}
        >
          {isCancelled ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-red-700">{t("orderCancelled")}</h4>
                <p className="text-xs text-red-600 mt-1 leading-relaxed">
                  {t("orderCancelledDesc")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-start gap-8 md:gap-4 mt-4 px-4 relative">
              {statusSteps.map((step, idx) => {
                const isCompleted = idx <= currentStatusIndex;
                const isActive = idx === currentStatusIndex;

                return (
                  <div key={step.key} className="flex md:flex-col items-center md:items-center text-left md:text-center gap-4 md:gap-3 flex-1 relative">
                    {/* Visual Connector Line */}
                    {idx < statusSteps.length - 1 && (
                      <div
                        className={`hidden md:block absolute top-[18px] left-[50%] right-[-50%] h-[2px] z-0 transition-colors ${
                          idx < currentStatusIndex ? "bg-brand-cyan" : "bg-slate-200"
                        }`}
                      />
                    )}

                    {/* Node Circle */}
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

                    {/* Step descriptions */}
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

          {/* Courier logistics section */}
          {(order.carrier || order.trackingNumber) && (
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-start gap-4 bg-slate-50/50 rounded-2xl p-4 border border-slate-200/50">
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
          )}
        </SectionCard>

        {/* Detailed Itemization */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Main Item: Glasses & Prescription (Left) */}
          <div className="md:col-span-8 flex flex-col gap-6">
            {/* Product Card */}
            <SectionCard title={t("selectedItem")} eyebrow={t("productEyebrow")}>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-32 h-24 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center p-3 overflow-hidden shrink-0">
                  <img src={order.productImageUrl} alt={order.productName} className="object-contain max-h-full" loading="lazy" />
                </div>
                <div className="flex-1 w-full text-center sm:text-left">
                  <h3 className="text-lg font-display font-medium text-brand-primary">{order.productName}</h3>
                  <p className="text-xs text-slate-400 mt-1">{t("productSubtitle")}</p>

                  {/* Lens details */}
                  {order.lensOptions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 justify-center sm:justify-start">
                      {order.lensOptions.map((lo) => (
                        <span key={lo.type} className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600 font-medium">
                          {lo.label} (+{formatPrice(lo.additionalPrice)})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Prescription details */}
            {order.prescription && (
              <SectionCard
                title={t("opticalPrescription")}
                eyebrow={t("prescriptionEyebrow")}
                description={t("prescriptionDesc")}
              >
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
          </div>

          {/* Address & Payment Info (Right) */}
          <div className="md:col-span-4 flex flex-col gap-6">
            {/* Recipient Details */}
            <SectionCard title={t("shippingAddress")} eyebrow={t("recipientEyebrow")}>
              <div className="flex flex-col gap-3 text-sm text-slate-600 font-light leading-relaxed">
                <div className="flex items-center gap-2 font-medium text-brand-primary">
                  <User className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
                  <span>
                    {order.customerFirstName} {order.customerLastName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono text-xs">{order.customerEmail}</span>
                </div>
                <p className="mt-2 border-t border-slate-100 pt-3 text-xs flex gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span>{order.shippingAddress}</span>
                </p>
              </div>
            </SectionCard>

            {/* Payment Summary */}
            <SectionCard title={t("paymentDetail")} eyebrow={t("billingEyebrow")}>
              <div className="flex flex-col gap-2.5 text-xs text-slate-500 font-light">
                <div className="flex justify-between">
                  <span>{t("paymentMethod")}</span>
                  <span className="font-semibold text-brand-primary">{order.paymentChannel || "MOCK"}</span>
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
