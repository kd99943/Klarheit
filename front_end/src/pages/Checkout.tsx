import { CheckCircle2, ChevronRight, ShieldCheck, X, Sparkles, Loader2, Check } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AR_FRAME_CATALOG } from "../ar/frameCatalog";
import { useAuth } from "../auth/AuthProvider";
import { useProducts } from "../hooks/useProducts";
import { checkoutOrder, isApiErrorWithStatus, type Product, validateCouponApi, getOrderStatus, triggerMockPayment, type OrderResponse, getApiBaseUrl } from "../services/api";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { formatPrice } from "../lib/utils";

type CheckoutLocationState = {
  product?: Product;
  prescription?: { sphOd: number; sphOs: number; cylOd: number; cylOs: number; axisOd: number; axisOs: number; pd: number };
  lensOptionTypes?: string[];
  finishId?: string;
};

type CustomerForm = { firstName: string; lastName: string; email: string; shippingAddress: string };
type PrescriptionForm = { sphOd: string; sphOs: string; cylOd: string; cylOs: string; axisOd: string; axisOs: string; pd: string };

const PRESCRIPTION_RANGES = {
  sphOd: { min: -20, max: 20 },
  sphOs: { min: -20, max: 20 },
  cylOd: { min: -10, max: 10 },
  cylOs: { min: -10, max: 10 },
  axisOd: { min: 0, max: 180 },
  axisOs: { min: 0, max: 180 },
} as const;

const LENS_LABELS: Record<string, string> = { HIGH_INDEX_174: "Custom Lenses (High-Index)", AR_ONYX: "Onyx AR Coating", HEV_BLUE: "HEV Filter" };
const LENS_PRICES: Record<string, number> = { HIGH_INDEX_174: 215, AR_ONYX: 60, HEV_BLUE: 30 };

export function Checkout() {
  const { t, i18n } = useTranslation("checkout");
  const { t: tAr } = useTranslation("ar-studio");
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as CheckoutLocationState | null;
  const { user, openAuthModal } = useAuth();
  const { products, isLoading: isLoadingProducts, error: catalogError } = useProducts();

  const checkoutState = useMemo(() => {
    if (routeState && (routeState.product || routeState.prescription)) {
      return routeState;
    }
    try {
      const saved = sessionStorage.getItem("klarheit_checkout_state");
      if (saved) {
        return JSON.parse(saved) as CheckoutLocationState;
      }
    } catch (e) {
      console.error("Failed to load checkout state from sessionStorage", e);
    }
    return null;
  }, [routeState]);

  const selectedProduct = checkoutState?.product ?? products[0] ?? null;
  const isLoadingProduct = !checkoutState?.product && isLoadingProducts;
  const prescriptionFromConfig = checkoutState?.prescription;
  const lensOptionTypesFromConfig = checkoutState?.lensOptionTypes;
  const finishId = checkoutState?.finishId;
  const selectedFinishConfig = finishId ? AR_FRAME_CATALOG[finishId as keyof typeof AR_FRAME_CATALOG] : null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerForm>({ firstName: "", lastName: "", email: user?.email ?? "", shippingAddress: "" });

  const [showCashierModal, setShowCashierModal] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<OrderResponse | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);

  useEffect(() => {
    let intervalId: any;
    if (pollingActive && createdOrder) {
      intervalId = setInterval(async () => {
        try {
          const statusRes = await getOrderStatus(createdOrder.orderNumber);
          if (statusRes.status === "PAID") {
            setIsPaid(true);
            setPollingActive(false);
            setTimeout(() => {
              setShowCashierModal(false);
              navigate("/order-confirmation", {
                state: {
                  orderNumber: createdOrder.orderNumber,
                  status: "PAID",
                  totalAmount: createdOrder.totalAmount,
                  productName: createdOrder.productName,
                  lensOptionTypes: createdOrder.lensOptionTypes,
                  customer: {
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    email: customer.email,
                    shippingAddress: customer.shippingAddress
                  }
                }
              });
            }, 2500);
          }
        } catch (e) {
          console.error("Error polling order status", e);
        }
      }, 1500);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pollingActive, createdOrder, navigate, customer]);
  const [prescription, setPrescription] = useState<PrescriptionForm>({
    sphOd: prescriptionFromConfig ? String(prescriptionFromConfig.sphOd) : "",
    sphOs: prescriptionFromConfig ? String(prescriptionFromConfig.sphOs) : "",
    cylOd: prescriptionFromConfig ? String(prescriptionFromConfig.cylOd) : "",
    cylOs: prescriptionFromConfig ? String(prescriptionFromConfig.cylOs) : "",
    axisOd: prescriptionFromConfig ? String(prescriptionFromConfig.axisOd) : "",
    axisOs: prescriptionFromConfig ? String(prescriptionFromConfig.axisOs) : "",
    pd: prescriptionFromConfig ? String(prescriptionFromConfig.pd) : "",
  });

  const [paymentChannel, setPaymentChannel] = useState<"WECHAT" | "ALIPAY">("WECHAT");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);

  const activeLensTypes = lensOptionTypesFromConfig ?? ["HIGH_INDEX_174", "AR_ONYX", "HEV_BLUE"];

  useEffect(() => {
    if (user) {
      setCustomer((c) => ({ ...c, firstName: c.firstName || user.firstName, lastName: c.lastName || user.lastName, email: user.email }));
    }
  }, [user]);

  const lensTotal = useMemo(() => activeLensTypes.reduce((t, type) => t + (LENS_PRICES[type] ?? 0), 0), [activeLensTypes]);
  const subtotal = (selectedProduct?.basePrice ?? 0) + lensTotal;
  const completionScore = [customer.firstName, customer.lastName, customer.email, customer.shippingAddress].filter((v) => v.trim()).length;
  const accountDisplayName = user ? `${user.firstName} ${user.lastName}`.trim() : "";

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsCheckingCoupon(true);
    setCouponError("");
    setCouponSuccess("");
    try {
      const res = await validateCouponApi({ code: couponCode.trim(), currentAmount: subtotal });
      setDiscount(res.discountAmount);
      setAppliedCoupon(res.code);
      setCouponSuccess(t("manifest.couponSuccess"));
    } catch (err) {
      setDiscount(0);
      setAppliedCoupon("");
      setCouponError(err instanceof Error ? err.message : t("manifest.couponError"));
    } finally {
      setIsCheckingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon("");
    setDiscount(0);
    setCouponCode("");
    setCouponSuccess("");
    setCouponError("");
  };

  function handleCustomerChange(e: ChangeEvent<HTMLInputElement>) { const { name, value } = e.target; setCustomer((c) => ({ ...c, [name]: value })); }
  function handlePrescriptionChange(e: ChangeEvent<HTMLInputElement>) { const { name, value } = e.target; setPrescription((c) => ({ ...c, [name]: value })); }

  function getNumericPrescription() {
    const np = { sphOd: Number(prescription.sphOd), sphOs: Number(prescription.sphOs), cylOd: Number(prescription.cylOd), cylOs: Number(prescription.cylOs), axisOd: Number(prescription.axisOd), axisOs: Number(prescription.axisOs), pd: Number(prescription.pd) };
    return Object.values(np).some((v) => !Number.isFinite(v)) ? null : np;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProduct) { setSubmitError(t("selectProductError")); return; }
    
    // Add robust range validation to prevent submitting negative or out-of-bound values
    const ranges = {
      sphOd: { min: -20, max: 20, name: "SPH OD" },
      sphOs: { min: -20, max: 20, name: "SPH OS" },
      cylOd: { min: -10, max: 10, name: "CYL OD" },
      cylOs: { min: -10, max: 10, name: "CYL OS" },
      axisOd: { min: 0, max: 180, name: "Axis OD" },
      axisOs: { min: 0, max: 180, name: "Axis OS" },
      pd: { min: 40, max: 80, name: "PD" },
    };

    const errors: string[] = [];
    for (const [key, range] of Object.entries(ranges)) {
      const val = prescription[key as keyof PrescriptionForm];
      const num = Number(val);
      if (val.trim() === "" || isNaN(num)) {
        errors.push(t("validation.invalidNumber", { field: range.name, defaultValue: `${range.name} must be a valid number.` }));
      } else if (num < range.min || num > range.max) {
        errors.push(t("validation.outOfRange", { field: range.name, min: range.min, max: range.max, defaultValue: `${range.name} must be between ${range.min} and ${range.max}.` }));
      } else if (["sphOd", "sphOs", "cylOd", "cylOs"].includes(key)) {
        const isMultipleOf025 = Math.abs(Math.round(num * 4) - num * 4) < 1e-9;
        if (!isMultipleOf025) {
          errors.push(t("validation.stepIncrement", { field: range.name, defaultValue: `${range.name} must be in 0.25 increments (e.g. -2.00, -2.25).` }));
        }
      }
    }

    if (errors.length > 0) {
      setSubmitError(errors.join(" "));
      return;
    }

    const numericPrescription = getNumericPrescription();
    if (!numericPrescription) { setSubmitError(t("prescriptionNumberError")); return; }
    setIsSubmitting(true); setSubmitError(null);
    try {
      const response = await checkoutOrder({
        productId: selectedProduct.id,
        lensOptionTypes: activeLensTypes,
        customer: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          shippingAddress: customer.shippingAddress
        },
        prescription: numericPrescription,
        couponCode: appliedCoupon || undefined,
        paymentChannel: paymentChannel,
        finishId: finishId || undefined
      });
      
      if (paymentChannel === "ALIPAY") {
        if (response.payData) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(response.payData, "text/html");
          const form = doc.getElementById("alipay_submit") as HTMLFormElement;
          if (form) {
            const action = form.getAttribute("action") ?? "";
            if (action.startsWith("/")) {
              try {
                const origin = new URL(getApiBaseUrl()).origin;
                form.setAttribute("action", origin + action);
              } catch {
                form.setAttribute("action", "http://localhost:8081" + action);
              }
            }
            document.body.appendChild(form);
            form.submit();
            return;
          }
        }
        navigate("/order-confirmation", {
          state: {
            orderNumber: response.orderNumber,
            status: response.status,
            totalAmount: response.totalAmount,
            productName: response.productName,
            lensOptionTypes: response.lensOptionTypes,
            customer: {
              firstName: customer.firstName,
              lastName: customer.lastName,
              email: customer.email,
              shippingAddress: customer.shippingAddress
            }
          }
        });
      } else {
        // WeChat Pay modal flow
        setCreatedOrder(response);
        setIsPaid(false);
        setShowCashierModal(true);
        setPollingActive(true);
      }
    } catch (error) {
      if (isApiErrorWithStatus(error, 401) || isApiErrorWithStatus(error, 403)) { openAuthModal({ mode: "signin", message: t("sessionExpired"), pendingNavigation: { path: "/checkout", state: { product: selectedProduct } } }); }
      setSubmitError(error instanceof Error ? error.message : t("checkoutFailed"));
    } finally { setIsSubmitting(false); }
  }

  return (
    <div className="flex-1 w-full bg-surface-offwhite py-10 lg:py-16 px-5 sm:px-8">
      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-7 flex flex-col gap-10">
          <PageIntro eyebrow={t("eyebrow")} title={t("title")} description={t("description")} actions={<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm min-w-40"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("formStatus")}</p><p className="mt-2 text-2xl font-display font-medium text-brand-primary">{completionScore}/4</p></div>} />
          <SectionCard title={t("step1.title")} eyebrow={t("step1.eyebrow")} description={t("step1.description")}>
            {user ? <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("step1.accountOnFile")}</p><div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-brand-primary">{accountDisplayName}</p><p className="text-sm text-slate-500">{user.email}</p></div><div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-brand-cyan">{t("step1.syncedToCheckout")}</div></div></div> : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6"><div className="flex flex-col gap-2"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{t("step1.firstName")}</label><input name="firstName" value={customer.firstName} onChange={handleCustomerChange} required type="text" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" /></div><div className="flex flex-col gap-2"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{t("step1.lastName")}</label><input name="lastName" value={customer.lastName} onChange={handleCustomerChange} required type="text" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" /></div></div>
            <div className="flex flex-col gap-2 mb-6"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{t("step1.emailAddress")}</label><input name="email" value={customer.email} onChange={handleCustomerChange} required type="email" readOnly className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" /></div>
            <div className="flex flex-col gap-2"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{t("step1.shippingAddress")}</label><input name="shippingAddress" value={customer.shippingAddress} onChange={handleCustomerChange} required type="text" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" /></div>
          </SectionCard>
          <SectionCard title={t("step2.title")} eyebrow={t("step2.eyebrow")} description={prescriptionFromConfig ? t("step2.fromConfigLab") : t("step2.defaultDescription")}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(["sphOd", "sphOs", "cylOd", "cylOs", "axisOd", "axisOs"] as const).map((field) => {
                const range = PRESCRIPTION_RANGES[field];
                return (
                  <div key={field} className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                      {field.replace(/([A-Z])/g, " $1").toUpperCase()}
                    </label>
                    <input
                      name={field}
                      value={prescription[field]}
                      onChange={handlePrescriptionChange}
                      required
                      min={range.min}
                      max={range.max}
                      step={field.startsWith("axis") ? "1" : "0.25"}
                      type="number"
                      className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 mt-6"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{t("step2.pd")}</label><input name="pd" value={prescription.pd} onChange={handlePrescriptionChange} required min="40" max="80" step="0.5" type="number" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" /></div>
          </SectionCard>
          
          <SectionCard title={t("step3.title")} eyebrow={t("step3.eyebrow")} description={t("step3.description")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* WeChat Card */}
              <div 
                onClick={() => setPaymentChannel("WECHAT")}
                className={`border-2 rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all ${
                  paymentChannel === "WECHAT" 
                    ? "border-emerald-500 bg-emerald-50/20 shadow-sm" 
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    paymentChannel === "WECHAT" ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"
                  }`}>
                    {paymentChannel === "WECHAT" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{t("step3.wechat")}</span>
                </div>
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-inner">微</div>
              </div>

              {/* Alipay Card */}
              <div 
                onClick={() => setPaymentChannel("ALIPAY")}
                className={`border-2 rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all ${
                  paymentChannel === "ALIPAY" 
                    ? "border-sky-500 bg-sky-50/20 shadow-sm" 
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    paymentChannel === "ALIPAY" ? "border-sky-500 bg-sky-500" : "border-slate-300 bg-white"
                  }`}>
                    {paymentChannel === "ALIPAY" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{t("step3.alipay")}</span>
                </div>
                <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-inner">支</div>
              </div>
            </div>
          </SectionCard>

          {submitError ? <div className="border border-red-200 bg-red-50 text-red-700 px-6 py-4 rounded-xl text-sm">{submitError}</div> : null}
        </div>
        <div className="lg:col-span-5">
          <div className="bg-brand-primary text-white rounded-2xl p-6 sm:p-8 shadow-xl sticky top-28">
            <h2 className="text-lg font-display font-medium tracking-wide mb-8 border-b border-white/10 pb-4">{t("manifest.title")}</h2>
            {isLoadingProduct ? <div className="text-sm text-white/70 pb-6 mb-6 border-b border-white/10">{t("manifest.loadingProduct")}</div> : null}
            {catalogError ? <div className="text-sm text-red-200 pb-6 mb-6 border-b border-white/10">{catalogError}</div> : null}
            {selectedProduct ? (
              <div className="flex gap-4 sm:gap-6 items-center border-b border-white/10 pb-6 mb-6">
                <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center p-2 shrink-0 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.8)]">
                  <img src={selectedProduct.imageUrl} alt={i18n.language === "zh" ? selectedProduct.nameZh : selectedProduct.nameEn} className="w-full h-full object-contain mix-blend-multiply" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-medium text-lg">
                    {i18n.language === "zh" ? selectedProduct.nameZh : selectedProduct.nameEn}
                  </h3>
                  <p className="text-[10px] text-brand-cyan uppercase tracking-widest font-semibold mt-1">
                    {i18n.language === "zh" ? selectedProduct.materialZh : selectedProduct.materialEn}
                  </p>
                  
                  {finishId && selectedFinishConfig && (
                    <p className="text-[10px] text-emerald-300 font-semibold mt-1">
                      {t("manifest.finish")}: {tAr("color." + finishId, { defaultValue: selectedFinishConfig.finishLabelKey })}
                    </p>
                  )}
                  
                  <p className="text-white/60 text-xs mt-2 font-mono">
                    ID: PR-{String(selectedProduct.id).padStart(4, "0")}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm">{formatPrice(selectedProduct.basePrice)}</span>
                </div>
              </div>
            ) : (
              <div className="border border-white/10 rounded-lg p-5 text-sm text-white/70 mb-6">{t("manifest.noProductSelected")} <Link to="/collections" className="underline underline-offset-4 text-white">{t("manifest.collectionLink")}</Link></div>
            )}
            
            {/* Promo Code Input Box */}
            {selectedProduct && (
              <div className="mb-6 pb-6 border-b border-white/10">
                <label className="text-[10px] uppercase font-bold text-white/50 tracking-widest block mb-2">
                  {t("manifest.couponCode")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value);
                      setCouponError("");
                      setCouponSuccess("");
                    }}
                    disabled={isCheckingCoupon || !!appliedCoupon}
                    placeholder="KLARHEIT80"
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/30 uppercase font-medium"
                  />
                  {appliedCoupon ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="bg-red-500/20 text-red-200 border border-red-500/30 hover:bg-red-500/30 text-xs px-4 py-2 rounded-xl shrink-0 transition-colors"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={isCheckingCoupon || !couponCode.trim()}
                      className="bg-white text-brand-primary hover:bg-slate-100 disabled:opacity-50 text-xs px-4 py-2 rounded-xl shrink-0 font-semibold transition-colors"
                    >
                      {isCheckingCoupon ? "..." : t("manifest.apply")}
                    </button>
                  )}
                </div>
                {couponError && <p className="text-red-300 text-xs mt-2 font-medium">{couponError}</p>}
                {couponSuccess && <p className="text-emerald-300 text-xs mt-2 font-medium">{couponSuccess}</p>}
              </div>
            )}

            <div className="space-y-3 mb-8 text-sm">
              {activeLensTypes.map((type) => (
                <div key={type} className="flex justify-between text-white/70">
                  <span>{t("lens." + type + ".label", { defaultValue: LENS_LABELS[type] ?? type })}</span>
                  <span>{formatPrice(LENS_PRICES[type] ?? 0)}</span>
                </div>
              ))}
              <div className="flex justify-between text-white/70 pt-2 border-t border-white/5 font-medium">
                <span>{t("manifest.subtotal")}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-emerald-300 font-medium">
                  <span>{t("manifest.discount")} ({appliedCoupon})</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-brand-cyan/80">
                <span>{t("manifest.complimentaryShipping")}</span>
                <span>{formatPrice(0)}</span>
              </div>
            </div>

            <div className="mb-8 rounded-2xl bg-white/8 px-4 py-4 text-sm text-slate-200"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/50">{t("manifest.readiness")}</p><p className="mt-2">{completionScore >= 4 ? t("manifest.nearlyComplete") : t("manifest.stillInProgress")}</p></div>
            {user ? <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/50">{t("manifest.accountIdentity")}</p><p className="mt-2 font-medium text-white">{accountDisplayName}</p><p className="text-white/60">{user.email}</p></div> : null}
            <div className="flex justify-between items-end mb-8 pt-6 border-t border-white/10"><span className="text-white/50 text-xs font-medium uppercase tracking-widest">{t("manifest.totalCommission")}</span><span className="text-3xl font-light tracking-tight">{formatPrice(Math.max(0, subtotal - discount))}</span></div>
            <Button type="submit" disabled={isSubmitting || !selectedProduct || isLoadingProduct} className="w-full bg-white text-brand-primary hover:bg-slate-100 text-xs group">{isSubmitting ? t("manifest.authorizing") : t("manifest.authorizePayment")}<ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></Button>
            <div className="mt-6 flex flex-col gap-2"><div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-semibold tracking-widest justify-center"><CheckCircle2 className="w-3 h-3" /><span>{t("manifest.encryptedTransaction")}</span></div><div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-semibold tracking-widest justify-center"><ShieldCheck className="w-3 h-3" /><span>{t("manifest.swissDataPrivacy")}</span></div></div>
          </div>
        </div>
      </form>

      {/* WeChat QR Cashier Modal */}
      {showCashierModal && createdOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="relative w-full max-w-md overflow-hidden bg-white/95 border border-white/20 shadow-2xl rounded-3xl p-8 backdrop-blur-xl transition-all transform duration-300 scale-100 flex flex-col items-center text-center">
            
            {/* Close Button */}
            {!isPaid && (
              <button
                type="button"
                onClick={() => {
                  setShowCashierModal(false);
                  setPollingActive(false);
                }}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {!isPaid ? (
              <>
                {/* WeChat Header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md">
                    微
                  </div>
                  <span className="text-base font-semibold text-slate-800">{t("cashier.wechatPay")}</span>
                </div>
                
                <p className="text-xs text-slate-500 mb-6 font-medium">
                  {t("cashier.scanInstructions")}
                </p>

                {/* QR Code Container with Glowing Scan Line */}
                <div className="relative p-4 bg-white border border-slate-100 rounded-3xl shadow-lg mb-6 flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(createdOrder.payData ?? "")}`}
                    alt={t("cashier.qrAlt")}
                    className="w-48 h-48 object-contain rounded-xl"
                  />
                  {/* Scan laser line animation */}
                  <div className="absolute left-6 right-6 h-0.5 bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)]" style={{ animation: "scan 2s ease-in-out infinite" }} />
                </div>

                {/* Amount */}
                <div className="mb-4">
                  <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase mb-1">{t("cashier.amountDue")}</p>
                  <p className="text-3xl font-light text-slate-800 font-mono tracking-tight">
                    {formatPrice(createdOrder.totalAmount)}
                  </p>
                </div>

                <div className="w-full h-px bg-slate-100 mb-5" />

                {/* Simulation Trigger Option */}
                <div className="w-full bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 mb-3 text-left">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                    {t("cashier.devMode")}
                  </h4>
                  <p className="text-slate-600 text-[11px] leading-relaxed mb-3">
                    {t("cashier.devDescription")}
                  </p>
                  <Button
                    type="button"
                    onClick={async () => {
                      try {
                        await triggerMockPayment(createdOrder.orderNumber, "WECHAT");
                      } catch (err) {
                        console.error("Simulation failed", err);
                      }
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {t("cashier.simulateSuccess")}
                  </Button>
                </div>

                {/* Polling status */}
                <div className="flex items-center gap-1.5 justify-center text-slate-400 text-[11px]">
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                  <span>{t("cashier.polling")}</span>
                </div>
              </>
            ) : (
              /* Payment Success Screen */
              <div className="py-8 flex flex-col items-center justify-center animate-fade-in w-full">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-md">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <h3 className="text-xl font-display font-medium text-slate-800 mb-2">
                  {t("cashier.paymentSuccess")}
                </h3>
                <p className="text-sm text-slate-500 max-w-xs mb-6 font-medium">
                  {t("cashier.paymentSuccessDesc")}
                </p>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-6 py-3 w-full mb-2 text-left">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="text-slate-400">{t("cashier.transactionId")}</span>
                    <span className="font-mono text-slate-700 font-semibold">{createdOrder.orderNumber}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">{t("cashier.paymentChannel")}</span>
                    <span className="text-slate-700 font-semibold">{t("cashier.wechatPay")}</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2 text-slate-400 text-[10px] font-semibold uppercase tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{t("cashier.secureGateway")}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
