import { AlertCircle, CheckCircle2, ChevronRight, RefreshCw, ShieldCheck, X, Sparkles, Loader2, Check } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AR_FRAME_CATALOG } from "../ar/frameCatalog";
import { useAuth } from "../auth/AuthProvider";
import { useCart } from "../hooks/useCart";
import { useLensOptions } from "../hooks/useLensOptions";
import { useProducts } from "../hooks/useProducts";
import {
  checkoutOrder,
  estimateOrderDelivery,
  fetchCheckoutSystemStatus,
  isApiErrorWithStatus,
  type CheckoutSystemStatus,
  type DeliveryEstimate,
  type Product,
  validateCouponApi,
  getOrderStatus,
  triggerMockPayment,
  type OrderResponse,
  getApiBaseUrl,
  fetchAddresses,
  type AddressResponse,
} from "../services/api";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { track } from "../services/analytics";
import { parseAndValidatePaymentForm } from "../lib/paymentForm";
import { generateQrCodeDataUrl } from "../lib/qrcode";
import {
  clearFreshCheckoutHandoff,
  peekFreshCheckoutHandoff,
  resolveSkuForSelection,
} from "../lib/selection";
import { CHECKOUT_IDEMPOTENCY_KEY, CHECKOUT_STATE_KEY } from "../lib/privacy";
import { formatPrice } from "../lib/utils";

type CheckoutLocationState = {
  product?: Product;
  prescription?: { sphOd: number; sphOs: number; cylOd: number; cylOs: number; axisOd: number; axisOs: number; pd: number };
  lensOptionTypes?: string[];
  finishId?: string;
  sizeSpec?: string;
  skuId?: number;
  cartItemId?: string;
  quotedTotal?: number;
  wearerName?: string;
  savePrescriptionToProfile?: boolean;
  accountEmail?: string;
  draftCustomer?: {
    firstName: string;
    lastName: string;
    phone: string;
    province?: string;
    city?: string;
    district?: string;
    detailAddress?: string;
    shippingAddress: string;
  };
  draftUpdatedOnCheckout?: boolean;
};

type CustomerForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detailAddress: string;
  shippingAddress: string;
};

type PrescriptionForm = {
  sphOd: string;
  sphOs: string;
  cylOd: string;
  cylOs: string;
  axisOd: string;
  axisOs: string;
  pd: string;
};

const PRESCRIPTION_RANGES = {
  sphOd: { min: -20, max: 20 },
  sphOs: { min: -20, max: 20 },
  cylOd: { min: -10, max: 10 },
  cylOs: { min: -10, max: 10 },
  axisOd: { min: 0, max: 180 },
  axisOs: { min: 0, max: 180 },
} as const;

const FALLBACK_LENS_LABELS: Record<string, string> = {
  STANDARD_156: "1.56 Standard Index Lenses",
  THIN_161: "1.61 Thin Index Lenses",
  ULTRATHIN_167: "1.67 Ultra-Thin Index Lenses",
  HIGH_INDEX_174: "1.74 High-Index Ultra-Thin Lenses",
  AR_ONYX: "Onyx AR Coating",
  HEV_BLUE: "HEV Filter",
};

const FALLBACK_LENS_PRICES: Record<string, number> = {
  STANDARD_156: 0,
  THIN_161: 100,
  ULTRATHIN_167: 160,
  HIGH_INDEX_174: 215,
  AR_ONYX: 60,
  HEV_BLUE: 30,
};

const LAST_ORDER_KEY = "klarheit_last_order_number";

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolvePersistedIdempotencyKey(intentSig: string, accountEmail?: string | null): string {
  const normalizedEmail = accountEmail?.trim().toLowerCase() ?? null;
  try {
    const raw = sessionStorage.getItem(CHECKOUT_IDEMPOTENCY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        sig?: string;
        key?: string;
        accountEmail?: string | null;
      };
      const sameOwner =
        !parsed.accountEmail || !normalizedEmail || parsed.accountEmail === normalizedEmail;
      if (sameOwner && parsed.sig === intentSig && typeof parsed.key === "string" && parsed.key) {
        return parsed.key;
      }
    }
  } catch {
    /* ignore storage errors */
  }
  const freshKey = createIdempotencyKey();
  try {
    sessionStorage.setItem(
      CHECKOUT_IDEMPOTENCY_KEY,
      JSON.stringify({
        sig: intentSig,
        key: freshKey,
        accountEmail: normalizedEmail,
        updatedAt: Date.now(),
      })
    );
  } catch {
    /* ignore storage errors */
  }
  return freshKey;
}

function clearPersistedIdempotencyKey() {
  try {
    sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_KEY);
  } catch {
    /* ignore */
  }
}

function splitRecipientName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    // Split standard 2–4 character Chinese full names into surname + given name
    if (/^[\u4e00-\u9fff]{2,4}$/.test(trimmed)) {
      return { firstName: trimmed.slice(1), lastName: trimmed.slice(0, 1) };
    }
    return { firstName: trimmed, lastName: "" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function Checkout() {
  const { t, i18n } = useTranslation("checkout");
  const { t: tAr } = useTranslation("ar-studio");
  const { t: tConfig } = useTranslation("config-lab");
  const { t: tCommon } = useTranslation("common");
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as CheckoutLocationState | null;
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const { linkOrderToCartItem, completeOrderCartCleanup } = useCart();
  const { products, isLoading: isLoadingProducts, error: catalogError } = useProducts();
  const { options: serverLensOptions, error: lensError, reload: reloadLensOptions } = useLensOptions();

  const isDevMode = Boolean(import.meta.env.DEV);
  const isWeChatEnabled = isDevMode || import.meta.env.VITE_ENABLE_WECHAT_PAY === "true";

  const [wasFreshHandoff] = useState(() => peekFreshCheckoutHandoff());

  useEffect(() => {
    clearFreshCheckoutHandoff();
  }, []);

  const { checkoutState, restoredFromDraft } = useMemo(() => {
    let savedForAccount: CheckoutLocationState | null = null;
    try {
      const saved = sessionStorage.getItem(CHECKOUT_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CheckoutLocationState;
        const parsedOwner = parsed.accountEmail?.trim().toLowerCase();
        const activeOwner = user?.email?.trim().toLowerCase();
        if (parsedOwner && activeOwner && parsedOwner !== activeOwner) {
          // P0-09: Account B must never inherit Account A's checkout draft or prescription
          sessionStorage.removeItem(CHECKOUT_STATE_KEY);
          clearPersistedIdempotencyKey();
        } else {
          savedForAccount = parsed;
        }
      }
    } catch (e) {
      console.error("Failed to load checkout state from sessionStorage", e);
    }

    if (routeState && (routeState.product || routeState.prescription)) {
      const routeOwner = routeState.accountEmail?.trim().toLowerCase();
      const activeOwner = user?.email?.trim().toLowerCase();
      if (routeOwner && activeOwner && routeOwner !== activeOwner) {
        return { checkoutState: null, restoredFromDraft: false };
      }
      const matchesSavedItem =
        savedForAccount !== null &&
        savedForAccount.product?.id === routeState.product?.id &&
        (savedForAccount.cartItemId ?? null) === (routeState.cartItemId ?? null);

      if (!wasFreshHandoff && matchesSavedItem) {
        return {
          checkoutState: { ...routeState, ...savedForAccount },
          restoredFromDraft: true,
        };
      }
      return { checkoutState: routeState, restoredFromDraft: false };
    }

    if (savedForAccount) {
      return { checkoutState: savedForAccount, restoredFromDraft: true };
    }
    return { checkoutState: null, restoredFromDraft: false };
  }, [routeState, user?.email, wasFreshHandoff]);

  const selectedProduct = useMemo(() => {
    const fromState = checkoutState?.product;
    if (fromState && products.length > 0) {
      const fresh = products.find((p) => p.id === fromState.id);
      if (fresh) return fresh;
    }
    return fromState ?? null;
  }, [checkoutState?.product, products]);

  const isLoadingProduct = !checkoutState?.product && isLoadingProducts;
  const prescriptionFromConfig = checkoutState?.prescription;
  const lensOptionTypesFromConfig = checkoutState?.lensOptionTypes;
  const finishId = checkoutState?.finishId;
  const requestedSizeSpec = checkoutState?.sizeSpec || checkoutState?.product?.specsSize || undefined;
  const resolvedCheckoutSku = useMemo(
    () =>
      resolveSkuForSelection(selectedProduct, {
        skuId: checkoutState?.skuId,
        finishId,
        sizeSpec: requestedSizeSpec,
      }),
    [selectedProduct, checkoutState?.skuId, finishId, requestedSizeSpec]
  );
  const effectiveSkuId = checkoutState?.skuId ?? resolvedCheckoutSku?.id;
  const effectiveSizeSpec =
    checkoutState?.sizeSpec ?? resolvedCheckoutSku?.sizeSpec ?? selectedProduct?.specsSize ?? undefined;
  const cartItemId = checkoutState?.cartItemId;
  const selectedFinishConfig = finishId ? AR_FRAME_CATALOG[finishId as keyof typeof AR_FRAME_CATALOG] : null;

  const baseLensOptions = useMemo(
    () =>
      [...serverLensOptions.filter((opt) => opt.category === "LENS")].sort(
        (a, b) => (a.indexValue || 0) - (b.indexValue || 0) || a.additionalPrice - b.additionalPrice
      ),
    [serverLensOptions],
  );
  const coatingOptions = useMemo(
    () =>
      [...serverLensOptions.filter((opt) => opt.category !== "LENS")].sort(
        (a, b) => a.additionalPrice - b.additionalPrice
      ),
    [serverLensOptions],
  );

  const [selectedLensTypes, setSelectedLensTypes] = useState<string[]>(() =>
    lensOptionTypesFromConfig && lensOptionTypesFromConfig.length > 0
      ? lensOptionTypesFromConfig
      : ["STANDARD_156"]
  );

  useEffect(() => {
    if (selectedLensTypes.length === 0 && serverLensOptions.length > 0) {
      const defaultBase = baseLensOptions.find((opt) => opt.type === "STANDARD_156") ?? baseLensOptions[0] ?? serverLensOptions[0];
      setSelectedLensTypes([defaultBase.type]);
    }
  }, [selectedLensTypes.length, serverLensOptions, baseLensOptions]);

  const activeLensTypes =
    selectedLensTypes.length > 0
      ? selectedLensTypes
      : baseLensOptions.length > 0
        ? [baseLensOptions[0].type]
        : serverLensOptions.length > 0
          ? [serverLensOptions[0].type]
          : ["STANDARD_156"];

  const hasSelectedBaseLens =
    baseLensOptions.length === 0 ||
    activeLensTypes.some((type) => baseLensOptions.some((opt) => opt.type === type));

  const [checkoutSystemStatus, setCheckoutSystemStatus] = useState<CheckoutSystemStatus>({
    checkoutEnabled: true,
    pauseReason: "",
  });

  useEffect(() => {
    let active = true;
    fetchCheckoutSystemStatus()
      .then((status) => {
        if (active && status && typeof status.checkoutEnabled === "boolean") {
          setCheckoutSystemStatus(status);
        }
      })
      .catch(() => {
        // Default open when status endpoint is unreachable in tests/offline dev
      });
    return () => {
      active = false;
    };
  }, []);

  const [lastPendingOrderNumber, setLastPendingOrderNumber] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(LAST_ORDER_KEY);
    } catch {
      return null;
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<"idle" | "creatingOrder" | "preparingGateway" | "redirecting">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [wearerName, setWearerName] = useState(checkoutState?.wearerName ?? "");
  const [savePrescriptionToProfile, setSavePrescriptionToProfile] = useState(
    Boolean(checkoutState?.savePrescriptionToProfile)
  );
  const [priceChangeConfirmed, setPriceChangeConfirmed] = useState(false);
  const [customer, setCustomer] = useState<CustomerForm>({
    firstName: checkoutState?.draftCustomer?.firstName ?? "",
    lastName: checkoutState?.draftCustomer?.lastName ?? "",
    email: user?.email ?? "",
    phone: checkoutState?.draftCustomer?.phone ?? user?.phone ?? "",
    province: checkoutState?.draftCustomer?.province ?? "",
    city: checkoutState?.draftCustomer?.city ?? "",
    district: checkoutState?.draftCustomer?.district ?? "",
    detailAddress: checkoutState?.draftCustomer?.detailAddress ?? "",
    shippingAddress: checkoutState?.draftCustomer?.shippingAddress ?? "",
  });

  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimate | null>(null);
  const [isCheckingDelivery, setIsCheckingDelivery] = useState(false);

  const customerTouchedRef = useRef({
    firstName: Boolean(checkoutState?.draftCustomer?.firstName),
    lastName: Boolean(checkoutState?.draftCustomer?.lastName),
    phone: Boolean(checkoutState?.draftCustomer?.phone),
    province: Boolean(checkoutState?.draftCustomer?.province),
    city: Boolean(checkoutState?.draftCustomer?.city),
    district: Boolean(checkoutState?.draftCustomer?.district),
    detailAddress: Boolean(checkoutState?.draftCustomer?.detailAddress),
    shippingAddress: Boolean(checkoutState?.draftCustomer?.shippingAddress),
  });

  const hasDraftEditsRef = useRef(Boolean(checkoutState?.draftUpdatedOnCheckout));

  const idempotencyRef = useRef<{ sig: string; key: string }>({ sig: "", key: "" });

  const [savedAddresses, setSavedAddresses] = useState<AddressResponse[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (isAuthenticated) {
      fetchAddresses()
        .then((addrs) => {
          if (!active) return;
          setSavedAddresses(addrs);
          const defaultAddr = addrs.find((a) => a.isDefault);
          const userAlreadyEdited =
            customerTouchedRef.current.firstName ||
            customerTouchedRef.current.lastName ||
            customerTouchedRef.current.phone ||
            customerTouchedRef.current.province ||
            customerTouchedRef.current.city ||
            customerTouchedRef.current.detailAddress ||
            customerTouchedRef.current.shippingAddress;
          if (defaultAddr && !userAlreadyEdited) {
            setSelectedAddressId(defaultAddr.id);
            const parsedName = splitRecipientName(defaultAddr.recipientName);
            setCustomer((prev) => ({
              ...prev,
              firstName: parsedName.firstName || prev.firstName,
              lastName: parsedName.lastName,
              phone: defaultAddr.phoneNumber || prev.phone,
              province: defaultAddr.province || "",
              city: defaultAddr.city || "",
              district: defaultAddr.district || "",
              detailAddress: defaultAddr.detailAddress || "",
              shippingAddress: `${defaultAddr.province} ${defaultAddr.city} ${defaultAddr.district || ""} ${defaultAddr.detailAddress}`.trim(),
            }));
          }
        })
        .catch(() => {
          // Non-fatal; customer can still enter shipping details manually
        });
    }
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  // P0-05: Live delivery zone, remote fee & estimated window preview (non-blocking if offline/mocked)
  useEffect(() => {
    const combinedAddr = customer.shippingAddress.trim();
    const hasAddressInput = Boolean(
      combinedAddr.length >= 2 || customer.province.trim() || customer.city.trim() || customer.detailAddress.trim()
    );
    if (!hasAddressInput) {
      setDeliveryEstimate(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setIsCheckingDelivery(true);
      estimateOrderDelivery({
        firstName: customer.firstName.trim() || "Guest",
        lastName: customer.lastName.trim() || "",
        email: customer.email.trim() || "preview@klarheit.local",
        phone: customer.phone.trim() || undefined,
        province: customer.province.trim() || undefined,
        city: customer.city.trim() || undefined,
        district: customer.district.trim() || undefined,
        detailAddress: customer.detailAddress.trim() || undefined,
        shippingAddress: combinedAddr || [customer.province, customer.city, customer.district, customer.detailAddress].filter(Boolean).join(" "),
      })
        .then((est) => {
          if (active && est && typeof est.deliverable === "boolean") {
            setDeliveryEstimate(est);
          }
        })
        .catch(() => {
          if (active) setDeliveryEstimate(null);
        })
        .finally(() => {
          if (active) setIsCheckingDelivery(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    customer.firstName,
    customer.lastName,
    customer.email,
    customer.phone,
    customer.province,
    customer.city,
    customer.district,
    customer.detailAddress,
    customer.shippingAddress,
  ]);

  const [showCashierModal, setShowCashierModal] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<OrderResponse | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (pollingActive && createdOrder) {
      intervalId = setInterval(async () => {
        try {
          const statusRes = await getOrderStatus(createdOrder.orderNumber);
          if (statusRes.status === "PAID") {
            setIsPaid(true);
            setPollingActive(false);
            completeOrderCartCleanup(createdOrder.orderNumber, cartItemId);
            try {
              sessionStorage.removeItem(LAST_ORDER_KEY);
            } catch {
              // ignore
            }
            setTimeout(() => {
              setShowCashierModal(false);
              navigate("/order-confirmation", {
                state: {
                  orderNumber: createdOrder.orderNumber,
                  status: "PAID",
                  totalAmount: createdOrder.totalAmount,
                  productName: createdOrder.productName,
                  lensOptionTypes: createdOrder.lensOptionTypes,
                  cartItemId,
                  customer: {
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    email: customer.email,
                    phone: customer.phone,
                    shippingAddress: customer.shippingAddress,
                  },
                },
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
  }, [pollingActive, createdOrder, navigate, customer, cartItemId, completeOrderCartCleanup]);

  const [prescription, setPrescription] = useState<PrescriptionForm>({
    sphOd: prescriptionFromConfig ? String(prescriptionFromConfig.sphOd) : "",
    sphOs: prescriptionFromConfig ? String(prescriptionFromConfig.sphOs) : "",
    cylOd: prescriptionFromConfig ? String(prescriptionFromConfig.cylOd) : "",
    cylOs: prescriptionFromConfig ? String(prescriptionFromConfig.cylOs) : "",
    axisOd: prescriptionFromConfig ? String(prescriptionFromConfig.axisOd) : "",
    axisOs: prescriptionFromConfig ? String(prescriptionFromConfig.axisOs) : "",
    pd: prescriptionFromConfig ? String(prescriptionFromConfig.pd) : "",
  });

  const [paymentChannel, setPaymentChannel] = useState<"WECHAT" | "ALIPAY">("ALIPAY");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);

  useEffect(() => {
    if (user) {
      setCustomer((c) => ({
        ...c,
        firstName: customerTouchedRef.current.firstName ? c.firstName : c.firstName || user.firstName,
        lastName: customerTouchedRef.current.lastName ? c.lastName : c.lastName || user.lastName,
        email: user.email,
        phone: customerTouchedRef.current.phone ? c.phone : c.phone || user.phone || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    const fromSource: "config_lab" | "product_details" | "navbar" | "other" =
      checkoutState?.prescription || checkoutState?.lensOptionTypes || checkoutState?.finishId
        ? "config_lab"
        : checkoutState?.product
          ? "product_details"
          : "other";
    track("checkout_entered", { from_source: fromSource });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lensPriceByType = useMemo(() => {
    const map: Record<string, number> = { ...FALLBACK_LENS_PRICES };
    for (const opt of serverLensOptions) {
      map[opt.type] = opt.additionalPrice;
    }
    return map;
  }, [serverLensOptions]);

  const lensLabelByType = useMemo(() => {
    const map: Record<string, string> = { ...FALLBACK_LENS_LABELS };
    for (const opt of serverLensOptions) {
      map[opt.type] = opt.label;
    }
    return map;
  }, [serverLensOptions]);

  const lensTotal = useMemo(
    () => activeLensTypes.reduce((sum, type) => sum + (lensPriceByType[type] ?? 0), 0),
    [activeLensTypes, lensPriceByType]
  );
  const subtotal = (selectedProduct?.basePrice ?? 0) + lensTotal;
  const priceChanged =
    checkoutState?.quotedTotal !== undefined &&
    selectedProduct !== null &&
    Math.abs(subtotal - checkoutState.quotedTotal) >= 0.01;

  useEffect(() => {
    setPriceChangeConfirmed(false);
  }, [subtotal]);

  const isPrescriptionComplete = useMemo(() => {
    return Object.values(prescription).every((v) => v.trim() !== "" && Number.isFinite(Number(v)));
  }, [prescription]);

  // Mirror backend pre-payment compatibility gate so customer knows upfront no charge occurs until optician review
  const prepayReviewPreviewKey = useMemo(() => {
    if (!isPrescriptionComplete) return null;
    const maxSph = Math.max(Math.abs(Number(prescription.sphOd) || 0), Math.abs(Number(prescription.sphOs) || 0));
    const maxCyl = Math.max(Math.abs(Number(prescription.cylOd) || 0), Math.abs(Number(prescription.cylOs) || 0));
    if (maxSph > 8.0 || maxCyl > 2.5) {
      return "manifest.prepayReviewHighPower";
    }
    if (activeLensTypes.some((tp) => tp.toUpperCase() === "STANDARD_156") && maxSph > 4.0) {
      return "manifest.prepayReviewIndex156";
    }
    if (activeLensTypes.some((tp) => tp.toUpperCase() === "THIN_161") && maxSph > 6.0) {
      return "manifest.prepayReviewIndex161";
    }
    return null;
  }, [isPrescriptionComplete, prescription, activeLensTypes]);

  const pendingActions = useMemo(() => {
    const items: Array<{ key: string; label: string; targetId: string; focusName?: string }> = [];
    if (!customer.firstName.trim()) {
      items.push({
        key: "firstName",
        label: t("checklist.missingName"),
        targetId: "checkout-recipient",
        focusName: "firstName",
      });
    }
    if (!customer.shippingAddress.trim()) {
      items.push({
        key: "shippingAddress",
        label: t("checklist.missingAddress"),
        targetId: "checkout-recipient",
        focusName: "shippingAddress",
      });
    }
    if (!isPrescriptionComplete) {
      items.push({
        key: "prescription",
        label: t("checklist.missingPrescription"),
        targetId: "checkout-prescription",
        focusName: "sphOd",
      });
    }
    if (!hasSelectedBaseLens) {
      items.push({
        key: "baseLens",
        label: t("checklist.missingBaseLens"),
        targetId: "checkout-prescription",
      });
    }
    if (priceChanged && !priceChangeConfirmed) {
      items.push({
        key: "priceConfirm",
        label: t("checklist.confirmPriceChange"),
        targetId: "checkout-price-confirm",
      });
    }
    return items;
  }, [customer.firstName, customer.shippingAddress, isPrescriptionComplete, hasSelectedBaseLens, priceChanged, priceChangeConfirmed, t]);

  function jumpToSection(targetId: string, focusName?: string) {
    const targetEl = document.getElementById(targetId);
    targetEl?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    if (focusName) {
      const input = document.querySelector<HTMLInputElement>(`input[name="${focusName}"]`);
      input?.focus();
    }
  }

  const completionScore = [
    customer.firstName,
    customer.email,
    customer.phone || customer.lastName,
    customer.shippingAddress,
  ].filter((v) => v.trim()).length;
  const accountDisplayName = user ? `${user.firstName} ${user.lastName}`.trim() : "";

  const invalidateStaleCoupon = () => {
    if (appliedCoupon || discount > 0) {
      setAppliedCoupon("");
      setDiscount(0);
      setCouponSuccess("");
      setCouponError(t("manifest.couponRecalcNotice"));
    }
  };

  function handleSelectBaseLens(type: string) {
    hasDraftEditsRef.current = true;
    const baseTypeSet = new Set(baseLensOptions.map((opt) => opt.type));
    setSelectedLensTypes((prev) => {
      const coatings = prev.filter((item) => !baseTypeSet.has(item));
      return [type, ...coatings];
    });
    invalidateStaleCoupon();
  }

  function handleToggleCoating(type: string) {
    hasDraftEditsRef.current = true;
    setSelectedLensTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
    invalidateStaleCoupon();
  }

  function toggleLegacyLensOption(type: string) {
    hasDraftEditsRef.current = true;
    setSelectedLensTypes((prev) => {
      if (prev.includes(type)) {
        return prev.length > 1 ? prev.filter((item) => item !== type) : prev;
      }
      return [...prev, type];
    });
    invalidateStaleCoupon();
  }

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
      track("checkout_coupon_applied", { coupon_code: res.code });
    } catch (err) {
      setDiscount(0);
      setAppliedCoupon("");
      const reason = err instanceof Error ? err.message : t("manifest.couponError");
      setCouponError(reason);
      track("checkout_coupon_failed", {
        reason_code: isApiErrorWithStatus(err, 400) ? "invalid_or_threshold" : "coupon_error",
      });
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

  function handleCustomerChange(e: ChangeEvent<HTMLInputElement>) {
    hasDraftEditsRef.current = true;
    const { name, value } = e.target;
    if (name in customerTouchedRef.current) {
      customerTouchedRef.current[name as keyof typeof customerTouchedRef.current] = true;
    }
    if (
      name === "shippingAddress" ||
      name === "province" ||
      name === "city" ||
      name === "district" ||
      name === "detailAddress" ||
      name === "firstName" ||
      name === "lastName" ||
      name === "phone"
    ) {
      setSelectedAddressId(null);
    }
    setCustomer((c) => {
      const next = { ...c, [name]: value };
      if (name === "province" || name === "city" || name === "district" || name === "detailAddress") {
        const composed = [next.province, next.city, next.district, next.detailAddress]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(" ");
        next.shippingAddress = composed;
      }
      return next;
    });
  }

  function handlePrescriptionChange(e: ChangeEvent<HTMLInputElement>) {
    hasDraftEditsRef.current = true;
    const { name, value } = e.target;
    setPrescription((c) => ({ ...c, [name]: value }));
  }

  useEffect(() => {
    if (!hasDraftEditsRef.current || !selectedProduct) return;
    const np = {
      sphOd: Number(prescription.sphOd),
      sphOs: Number(prescription.sphOs),
      cylOd: Number(prescription.cylOd),
      cylOs: Number(prescription.cylOs),
      axisOd: Number(prescription.axisOd),
      axisOs: Number(prescription.axisOs),
      pd: Number(prescription.pd),
    };
    const validRx = Object.values(np).every((v) => Number.isFinite(v)) && Object.values(prescription).every((v) => v.trim() !== "");
    const updatedDraft: CheckoutLocationState = {
      product: selectedProduct,
      prescription: validRx ? np : checkoutState?.prescription,
      lensOptionTypes: activeLensTypes,
      finishId,
      sizeSpec: effectiveSizeSpec,
      skuId: effectiveSkuId,
      cartItemId,
      quotedTotal: checkoutState?.quotedTotal,
      wearerName: wearerName.trim() || undefined,
      savePrescriptionToProfile,
      accountEmail: user?.email ?? checkoutState?.accountEmail,
      draftCustomer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        province: customer.province,
        city: customer.city,
        district: customer.district,
        detailAddress: customer.detailAddress,
        shippingAddress: customer.shippingAddress,
      },
      draftUpdatedOnCheckout: true,
    };
    try {
      sessionStorage.setItem(CHECKOUT_STATE_KEY, JSON.stringify(updatedDraft));
    } catch {
      // ignore storage errors
    }
  }, [
    selectedProduct,
    prescription,
    activeLensTypes,
    finishId,
    effectiveSizeSpec,
    effectiveSkuId,
    cartItemId,
    checkoutState?.prescription,
    checkoutState?.quotedTotal,
    checkoutState?.accountEmail,
    wearerName,
    savePrescriptionToProfile,
    user?.email,
    customer.firstName,
    customer.lastName,
    customer.phone,
    customer.province,
    customer.city,
    customer.district,
    customer.detailAddress,
    customer.shippingAddress,
  ]);

  function getNumericPrescription() {
    const np = {
      sphOd: Number(prescription.sphOd),
      sphOs: Number(prescription.sphOs),
      cylOd: Number(prescription.cylOd),
      cylOs: Number(prescription.cylOs),
      axisOd: Number(prescription.axisOd),
      axisOs: Number(prescription.axisOs),
      pd: Number(prescription.pd),
    };
    return Object.values(np).some((v) => !Number.isFinite(v)) ? null : np;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkoutSystemStatus.checkoutEnabled) {
      setSubmitError(checkoutSystemStatus.pauseReason || t("manifest.checkoutPausedDesc"));
      return;
    }
    if (!selectedProduct) {
      setSubmitError(t("selectProductError"));
      return;
    }
    if (lensError) {
      setSubmitError(t("step2.lensLoadError"));
      return;
    }
    if (!hasSelectedBaseLens) {
      setSubmitError(t("selectLensError"));
      return;
    }
    if (priceChanged && !priceChangeConfirmed) {
      setSubmitError(t("manifest.priceConfirmRequiredError"));
      jumpToSection("checkout-price-confirm");
      return;
    }

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
        errors.push(t("validation.invalidNumber", { field: range.name }));
      } else if (num < range.min || num > range.max) {
        errors.push(t("validation.outOfRange", { field: range.name, min: range.min, max: range.max }));
      } else if (["sphOd", "sphOs", "cylOd", "cylOs"].includes(key)) {
        const isMultipleOf025 = Math.abs(Math.round(num * 4) - num * 4) < 1e-9;
        if (!isMultipleOf025) {
          errors.push(t("validation.stepIncrement", { field: range.name }));
        }
      }
    }

    if (errors.length > 0) {
      setSubmitError(errors.join(" "));
      return;
    }

    if (deliveryEstimate && !deliveryEstimate.deliverable) {
      setSubmitError(deliveryEstimate.reason || t("step1.deliveryOutOfRegion"));
      return;
    }

    const numericPrescription = getNumericPrescription();
    if (!numericPrescription) {
      setSubmitError(t("prescriptionNumberError"));
      return;
    }

    const intentSig = JSON.stringify({
      productId: selectedProduct.id,
      skuId: effectiveSkuId ?? null,
      finishId: finishId ?? null,
      sizeSpec: effectiveSizeSpec ?? null,
      lenses: [...activeLensTypes].sort(),
      coupon: appliedCoupon,
      rx: numericPrescription,
      channel: paymentChannel,
      address: customer.shippingAddress.trim(),
      province: customer.province.trim(),
      city: customer.city.trim(),
      district: customer.district.trim(),
      detailAddress: customer.detailAddress.trim(),
      phone: customer.phone.trim(),
      wearerName: wearerName.trim(),
    });
    const resolvedKey = resolvePersistedIdempotencyKey(intentSig, user?.email);
    idempotencyRef.current = { sig: intentSig, key: resolvedKey };

    setIsSubmitting(true);
    setSubmitStage("creatingOrder");
    setSubmitError(null);
    const submitChannel = paymentChannel === "ALIPAY" ? "alipay" : "wechat";
    const estimatedShippingFee = deliveryEstimate?.shippingFee ?? 0;
    track("checkout_submit_clicked", {
      channel: submitChannel,
      total_amount: Math.max(0, subtotal - discount) + estimatedShippingFee,
    });
    try {
      const response = await checkoutOrder({
        productId: selectedProduct.id,
        skuId: effectiveSkuId,
        lensOptionTypes: activeLensTypes,
        customer: {
          firstName: customer.firstName.trim(),
          lastName: customer.lastName.trim(),
          email: customer.email.trim(),
          phone: customer.phone.trim() || undefined,
          province: customer.province.trim() || undefined,
          city: customer.city.trim() || undefined,
          district: customer.district.trim() || undefined,
          detailAddress: customer.detailAddress.trim() || undefined,
          shippingAddress: customer.shippingAddress.trim(),
        },
        prescription: numericPrescription,
        couponCode: appliedCoupon || undefined,
        paymentChannel: paymentChannel,
        finishId: finishId || undefined,
        idempotencyKey: idempotencyRef.current.key,
        wearerName: wearerName.trim() || undefined,
        savePrescriptionToProfile,
        sizeSpec: effectiveSizeSpec,
        orderSource: (() => {
          try {
            const params = new URLSearchParams(window.location.search);
            return params.get("utm_source") || params.get("source") || sessionStorage.getItem("klarheit_order_source") || "DIRECT";
          } catch {
            return "DIRECT";
          }
        })(),
      });
      setSubmitStage("preparingGateway");
      clearPersistedIdempotencyKey();
      track("order_created", { total_amount: response.totalAmount });
      try {
        sessionStorage.setItem(LAST_ORDER_KEY, response.orderNumber);
      } catch {
        // ignore storage errors
      }
      setLastPendingOrderNumber(response.orderNumber);

      if (cartItemId) {
        linkOrderToCartItem(response.orderNumber, cartItemId);
      }

      // Pre-payment compatibility/feasibility review required -> clear submitted cart item & go straight to Order Detail without initiating gateway
      if (response.status === "AWAITING_REVIEW" || response.status === "QUOTE_READY") {
        completeOrderCartCleanup(response.orderNumber, cartItemId);
        try {
          sessionStorage.removeItem("klarheit_checkout_state");
        } catch {
          // ignore
        }
        navigate(`/order/${response.orderNumber}`);
        return;
      }

      if (paymentChannel === "ALIPAY") {
        if (!response.payData) {
          throw new Error(t("paymentGatewayError"));
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
        setSubmitStage("redirecting");
        track("order_payment_initiated", { channel: "alipay" });
        const importedForm = document.importNode(validatedForm, true);
        importedForm.style.display = "none";
        document.body.appendChild(importedForm);
        HTMLFormElement.prototype.submit.call(importedForm);
        return;
      } else {
        track("order_payment_initiated", { channel: "wechat" });
        setCreatedOrder(response);
        setIsPaid(false);
        setShowCashierModal(true);
        setPollingActive(true);
      }
    } catch (error) {
      if (isApiErrorWithStatus(error, 401) || isApiErrorWithStatus(error, 403)) {
        const preservedState: CheckoutLocationState = {
          product: selectedProduct,
          prescription: numericPrescription,
          lensOptionTypes: activeLensTypes,
          finishId,
          sizeSpec: effectiveSizeSpec,
          skuId: effectiveSkuId,
          cartItemId,
          quotedTotal: subtotal,
          wearerName: wearerName.trim() || undefined,
          savePrescriptionToProfile,
          accountEmail: user?.email ?? undefined,
        };
        try {
          sessionStorage.setItem("klarheit_checkout_state", JSON.stringify(preservedState));
        } catch {
          // ignore
        }
        openAuthModal({
          mode: "signin",
          message: t("sessionExpired"),
          pendingNavigation: { path: "/checkout", state: preservedState },
        });
      }
      const failReason = error instanceof Error ? error.message : t("checkoutFailed");
      setSubmitError(failReason);
      const reasonCode = isApiErrorWithStatus(error, 401) || isApiErrorWithStatus(error, 403)
        ? "auth_required"
        : isApiErrorWithStatus(error, 409)
          ? "inventory_or_conflict"
          : isApiErrorWithStatus(error, 503)
            ? "checkout_paused"
            : "checkout_failed";
      track("checkout_submit_failed", { reason_code: reasonCode });
    } finally {
      setIsSubmitting(false);
      setSubmitStage("idle");
    }
  }

  if (!selectedProduct) {
    return (
      <div className="flex-1 w-full bg-surface-offwhite py-10 lg:py-16 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <PageIntro eyebrow={t("eyebrow")} title={t("title")} description={t("selectProductError")} />
          <Link to="/collections" className="inline-block mt-6 text-brand-primary underline">
            {t("manifest.collectionLink")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-surface-offwhite py-10 lg:py-16 px-5 sm:px-8">
      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-7 flex flex-col gap-10">
          <PageIntro
            eyebrow={t("eyebrow")}
            title={t("title")}
            description={t("description")}
            actions={
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm min-w-[230px] max-w-sm">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
                  {t("formStatus")}
                </p>
                {pendingActions.length === 0 ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-700 flex items-center gap-1.5 leading-relaxed whitespace-nowrap">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{prepayReviewPreviewKey ? t("checklist.readyForReview") : t("checklist.ready")}</span>
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pendingActions.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => jumpToSection(item.targetId, item.focusName)}
                        className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            }
          />

          {restoredFromDraft && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl border border-brand-cyan/30 bg-brand-cyan/5 px-5 py-3.5 text-xs text-brand-primary font-medium"
            >
              {prescriptionFromConfig ? t("draftRestoredWithRx") : t("draftRestoredNeedRx")}
            </div>
          )}

          {!checkoutSystemStatus.checkoutEnabled && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">{t("manifest.checkoutPausedTitle")}</p>
                <p className="text-xs text-amber-800 mt-1">
                  {checkoutSystemStatus.pauseReason || t("manifest.checkoutPausedDesc")}
                </p>
              </div>
            </div>
          )}

          {lastPendingOrderNumber && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/70 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-sky-900">
                {t("manifest.pendingRecoveryBanner", { orderNumber: lastPendingOrderNumber })}
              </p>
              <Link
                to={`/order/${lastPendingOrderNumber}`}
                className="text-xs font-semibold text-sky-700 underline underline-offset-4 shrink-0 hover:text-sky-900"
              >
                {t("manifest.viewPendingOrder")}
              </Link>
            </div>
          )}

          <div id="checkout-recipient">
          <SectionCard title={t("step1.title")} eyebrow={t("step1.eyebrow")} description={t("step1.description")}>
            {user ? (
              <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("step1.accountOnFile")}</p>
                <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-brand-primary">{accountDisplayName}</p>
                    <p className="text-sm text-slate-500">{user.email}</p>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-brand-cyan">{t("step1.syncedToCheckout")}</div>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="checkout-firstName" className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                  {t("step1.firstName")}
                </label>
                <input
                  id="checkout-firstName"
                  name="firstName"
                  value={customer.firstName}
                  onChange={handleCustomerChange}
                  required
                  type="text"
                  className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="checkout-lastName" className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                  {t("step1.lastName")}
                </label>
                <input
                  id="checkout-lastName"
                  name="lastName"
                  value={customer.lastName}
                  onChange={handleCustomerChange}
                  type="text"
                  placeholder={t("step1.lastNameOptional")}
                  className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium placeholder:text-slate-300"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="checkout-email" className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                  {t("step1.emailAddress")}
                </label>
                <input
                  id="checkout-email"
                  name="email"
                  value={customer.email}
                  onChange={handleCustomerChange}
                  required
                  type="email"
                  readOnly
                  className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="checkout-phone" className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                  {t("step1.phone")}
                </label>
                <input
                  id="checkout-phone"
                  name="phone"
                  value={customer.phone}
                  onChange={handleCustomerChange}
                  type="tel"
                  placeholder="13800138000"
                  className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium placeholder:text-slate-300"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 mb-6">
              <label htmlFor="checkout-wearerName" className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                {t("step1.wearerName")}
              </label>
              <input
                id="checkout-wearerName"
                name="wearerName"
                value={wearerName}
                onChange={(e) => {
                  hasDraftEditsRef.current = true;
                  setWearerName(e.target.value);
                }}
                type="text"
                placeholder={t("step1.wearerNamePlaceholder")}
                className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium placeholder:text-slate-300"
              />
            </div>
            {savedAddresses.length > 0 && (
              <div className="mb-6 mt-4">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-3">
                  {t("selectSavedAddress")}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => {
                        hasDraftEditsRef.current = true;
                        setSelectedAddressId(addr.id);
                        customerTouchedRef.current = {
                          firstName: true,
                          lastName: true,
                          phone: true,
                          province: true,
                          city: true,
                          district: true,
                          detailAddress: true,
                          shippingAddress: true,
                        };
                        const parsedName = splitRecipientName(addr.recipientName);
                        setCustomer((prev) => ({
                          ...prev,
                          firstName: parsedName.firstName,
                          lastName: parsedName.lastName,
                          phone: addr.phoneNumber || prev.phone,
                          province: addr.province || "",
                          city: addr.city || "",
                          district: addr.district || "",
                          detailAddress: addr.detailAddress || "",
                          shippingAddress: `${addr.province} ${addr.city} ${addr.district || ""} ${addr.detailAddress}`.trim(),
                        }));
                      }}
                      className={`text-left rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                        selectedAddressId === addr.id
                          ? "border-brand-cyan bg-slate-50/50 ring-1 ring-brand-cyan/25"
                          : "border-slate-200 hover:bg-slate-50/30"
                      }`}
                    >
                      <span className="text-xs font-semibold text-brand-primary block">
                        {addr.recipientName} ({addr.phoneNumber})
                      </span>
                      <span className="text-[11px] text-slate-500 mt-1 block truncate">
                        {addr.province} {addr.city} {addr.detailAddress}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="checkout-province" className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                  {t("step1.province")}
                </label>
                <input
                  id="checkout-province"
                  name="province"
                  value={customer.province}
                  onChange={handleCustomerChange}
                  type="text"
                  placeholder={t("step1.provincePlaceholder")}
                  className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium placeholder:text-slate-300"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="checkout-city" className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                  {t("step1.city")}
                </label>
                <input
                  id="checkout-city"
                  name="city"
                  value={customer.city}
                  onChange={handleCustomerChange}
                  type="text"
                  placeholder={t("step1.cityPlaceholder")}
                  className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium placeholder:text-slate-300"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="checkout-district" className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                  {t("step1.district")}
                </label>
                <input
                  id="checkout-district"
                  name="district"
                  value={customer.district}
                  onChange={handleCustomerChange}
                  type="text"
                  placeholder={t("step1.districtPlaceholder")}
                  className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium placeholder:text-slate-300"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              <label htmlFor="checkout-detailAddress" className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                {t("step1.detailAddress")}
              </label>
              <input
                id="checkout-detailAddress"
                name="detailAddress"
                value={customer.detailAddress}
                onChange={handleCustomerChange}
                type="text"
                placeholder={t("step1.detailAddressPlaceholder")}
                className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium placeholder:text-slate-300"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="checkout-shippingAddress" className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                {t("step1.shippingAddress")}
              </label>
              <input
                id="checkout-shippingAddress"
                name="shippingAddress"
                value={customer.shippingAddress}
                onChange={handleCustomerChange}
                required
                type="text"
                className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium"
              />
              <p className="text-[11px] text-slate-500 mt-1">{t("step1.shippingRegionNote")}</p>
              {isCheckingDelivery && (
                <p className="text-[11px] text-slate-400 mt-1">{t("step1.deliveryEstimateChecking")}</p>
              )}
              {deliveryEstimate && !deliveryEstimate.deliverable && (
                <div
                  role="alert"
                  className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 font-medium"
                >
                  {deliveryEstimate.reason || t("step1.deliveryOutOfRegion")}
                </div>
              )}
              {deliveryEstimate && deliveryEstimate.deliverable && deliveryEstimate.manualReviewRequired && (
                <div
                  role="status"
                  className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800"
                >
                  {deliveryEstimate.reason || t("step1.deliveryManualReview")}
                </div>
              )}
              {deliveryEstimate && deliveryEstimate.deliverable && !deliveryEstimate.manualReviewRequired && (
                <div
                  role="status"
                  className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2 text-xs text-emerald-800 flex flex-wrap items-center justify-between gap-2"
                >
                  <span>{deliveryEstimate.reason}</span>
                  <span className="font-mono font-semibold">
                    {t("step1.deliveryWindow", {
                      min: deliveryEstimate.minDays,
                      max: deliveryEstimate.maxDays,
                    })}
                  </span>
                </div>
              )}
            </div>
          </SectionCard>
          </div>

          <div id="checkout-prescription">
          <SectionCard
            title={t("step2.title")}
            eyebrow={t("step2.eyebrow")}
            description={prescriptionFromConfig ? t("step2.fromConfigLab") : t("step2.defaultDescription")}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(["sphOd", "sphOs", "cylOd", "cylOs", "axisOd", "axisOs"] as const).map((field) => {
                const range = PRESCRIPTION_RANGES[field];
                return (
                  <div key={field} className="flex flex-col gap-2">
                    <label
                      htmlFor={`checkout-rx-${field}`}
                      className="text-[10px] uppercase font-bold text-slate-400 tracking-widest"
                    >
                      {tConfig("fieldLabels." + field, {
                        defaultValue: field.replace(/([A-Z])/g, " $1").toUpperCase(),
                      })}
                    </label>
                    <input
                      id={`checkout-rx-${field}`}
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
            <div className="flex flex-col gap-2 mt-6">
              <label htmlFor="checkout-rx-pd" className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                {t("step2.pd")}
              </label>
              <input
                id="checkout-rx-pd"
                name="pd"
                value={prescription.pd}
                onChange={handlePrescriptionChange}
                required
                min="40"
                max="80"
                step="0.5"
                type="number"
                className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium"
              />
            </div>

            <label className="mt-5 inline-flex items-center gap-2.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={savePrescriptionToProfile}
                onChange={(e) => {
                  hasDraftEditsRef.current = true;
                  setSavePrescriptionToProfile(e.target.checked);
                }}
                className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
              />
              <span>{t("step2.saveRxToProfile")}</span>
            </label>

            {lensError && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-red-700 font-medium">{t("step2.lensLoadError")}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => reloadLensOptions?.()}
                  className="shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {t("step2.retryLens")}
                </Button>
              </div>
            )}

            {serverLensOptions.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-100 space-y-5">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                  {t("step2.lensOptionsTitle")}
                </p>

                {!hasSelectedBaseLens && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    {t("step2.lensOptionsRequiredHint")}
                  </p>
                )}

                {baseLensOptions.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {baseLensOptions.map((opt) => {
                        const selected = activeLensTypes.includes(opt.type);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectBaseLens(opt.type)}
                            className={`text-left rounded-xl border p-3.5 flex items-center justify-between transition-all ${
                              selected
                                ? "border-brand-primary bg-slate-50 ring-1 ring-brand-primary/20"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div>
                              <span className="text-xs font-semibold text-brand-primary block">
                                {t("lens." + opt.type + ".label", { defaultValue: opt.label })}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                +{formatPrice(opt.additionalPrice)}
                              </span>
                            </div>
                            <div
                              className={`w-4 h-4 rounded-full border shrink-0 ${
                                selected ? "border-4 border-brand-primary bg-white" : "border-slate-300 bg-white"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>

                    {coatingOptions.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {coatingOptions.map((opt) => {
                          const selected = activeLensTypes.includes(opt.type);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleToggleCoating(opt.type)}
                              className={`text-left rounded-xl border p-3.5 flex items-center justify-between transition-all ${
                                selected
                                  ? "border-brand-cyan bg-sky-50/40 ring-1 ring-brand-cyan/25"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <div>
                                <span className="text-xs font-semibold text-brand-primary block">
                                  {t("lens." + opt.type + ".label", { defaultValue: opt.label })}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  +{formatPrice(opt.additionalPrice)}
                                </span>
                              </div>
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                  selected
                                    ? "border-brand-primary bg-brand-primary text-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {selected && <Check className="w-3 h-3" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {serverLensOptions.map((opt) => {
                      const selected = activeLensTypes.includes(opt.type);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleLegacyLensOption(opt.type)}
                          className={`text-left rounded-xl border p-3.5 flex items-center justify-between transition-all ${
                            selected
                              ? "border-brand-primary bg-slate-50 ring-1 ring-brand-primary/20"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div>
                            <span className="text-xs font-semibold text-brand-primary block">
                              {t("lens." + opt.type + ".label", { defaultValue: opt.label })}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              +{formatPrice(opt.additionalPrice)}
                            </span>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border shrink-0 ${
                              selected ? "border-4 border-brand-primary bg-white" : "border-slate-300 bg-white"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </SectionCard>
          </div>

          <SectionCard title={t("step3.title")} eyebrow={t("step3.eyebrow")} description={t("step3.description")}>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              role="radiogroup"
              aria-label={t("step3.title")}
              onKeyDown={(e) => {
                if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
                e.preventDefault();
                if (!isWeChatEnabled) return;
                const nextChannel = paymentChannel === "ALIPAY" ? "WECHAT" : "ALIPAY";
                track("checkout_payment_method_selected", {
                  channel: nextChannel === "ALIPAY" ? "alipay" : "wechat",
                });
                setPaymentChannel(nextChannel);
                const nextBtn = e.currentTarget.querySelector<HTMLButtonElement>(
                  `button[data-payment-channel="${nextChannel}"]`
                );
                nextBtn?.focus();
              }}
            >
              {/* Alipay Card */}
              <button
                type="button"
                role="radio"
                data-payment-channel="ALIPAY"
                aria-checked={paymentChannel === "ALIPAY"}
                tabIndex={paymentChannel === "ALIPAY" ? 0 : -1}
                onClick={() => {
                  if (paymentChannel !== "ALIPAY") {
                    track("checkout_payment_method_selected", { channel: "alipay" });
                  }
                  setPaymentChannel("ALIPAY");
                }}
                className={`border-2 rounded-2xl p-5 flex items-center justify-between text-left cursor-pointer transition-all ${
                  paymentChannel === "ALIPAY"
                    ? "border-sky-500 bg-sky-50/20 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      paymentChannel === "ALIPAY" ? "border-sky-500 bg-sky-500" : "border-slate-300 bg-white"
                    }`}
                  >
                    {paymentChannel === "ALIPAY" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{t("step3.alipay")}</span>
                </div>
                <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-inner">支</div>
              </button>

              {/* WeChat Card */}
              <button
                type="button"
                role="radio"
                data-payment-channel="WECHAT"
                aria-checked={paymentChannel === "WECHAT"}
                tabIndex={isWeChatEnabled && paymentChannel === "WECHAT" ? 0 : -1}
                disabled={!isWeChatEnabled}
                onClick={() => {
                  if (!isWeChatEnabled) return;
                  if (paymentChannel !== "WECHAT") {
                    track("checkout_payment_method_selected", { channel: "wechat" });
                  }
                  setPaymentChannel("WECHAT");
                }}
                className={`border-2 rounded-2xl p-5 flex items-center justify-between text-left transition-all ${
                  !isWeChatEnabled
                    ? "border-slate-200 bg-slate-50/70 opacity-60 cursor-not-allowed"
                    : paymentChannel === "WECHAT"
                      ? "border-emerald-500 bg-emerald-50/20 shadow-sm cursor-pointer"
                      : "border-slate-200 bg-white hover:border-slate-300 cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      paymentChannel === "WECHAT" ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"
                    }`}
                  >
                    {paymentChannel === "WECHAT" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800">{t("step3.wechat")}</span>
                    {!isWeChatEnabled && (
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        {t("step3.wechatUnavailable")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-inner">微</div>
              </button>
            </div>
          </SectionCard>

          {submitError ? (
            <div className="border border-red-200 bg-red-50 text-red-700 px-6 py-4 rounded-xl text-sm">{submitError}</div>
          ) : null}
        </div>

        <div className="lg:col-span-5">
          <div className="bg-brand-primary text-white rounded-2xl p-6 sm:p-8 shadow-xl lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <h2 className="text-lg font-display font-medium text-white tracking-wide mb-8 border-b border-white/10 pb-4">{t("manifest.title")}</h2>
            {isLoadingProduct ? <div className="text-sm text-white/70 pb-6 mb-6 border-b border-white/10">{t("manifest.loadingProduct")}</div> : null}
            {catalogError ? <div className="text-sm text-red-200 pb-6 mb-6 border-b border-white/10">{catalogError}</div> : null}
            {selectedProduct ? (
              <div className="flex gap-4 sm:gap-6 items-center border-b border-white/10 pb-6 mb-6">
                <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center p-2 shrink-0 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.8)]">
                  <img
                    src={selectedProduct.imageUrl}
                    alt={i18n.language === "zh" ? selectedProduct.nameZh : selectedProduct.nameEn}
                    className="w-full h-full object-contain mix-blend-multiply"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-medium text-lg text-white">
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

                  {effectiveSizeSpec && (
                    <p className="text-[10px] text-white/75 font-mono mt-0.5">
                      {t("manifest.sizeSpec")}: {effectiveSizeSpec}
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
              <div className="border border-white/10 rounded-lg p-5 text-sm text-white/70 mb-6">
                {t("manifest.noProductSelected")}{" "}
                <Link to="/collections" className="underline underline-offset-4 text-white">
                  {t("manifest.collectionLink")}
                </Link>
              </div>
            )}

            {priceChanged && checkoutState?.quotedTotal !== undefined && (
              <div
                id="checkout-price-confirm"
                className="mb-6 rounded-xl border border-amber-300/50 bg-amber-400/15 px-4 py-3.5 text-xs text-amber-100 space-y-2.5"
              >
                <p>
                  {t("manifest.priceChangedNotice", {
                    oldPrice: formatPrice(checkoutState.quotedTotal),
                    newPrice: formatPrice(subtotal),
                  })}
                </p>
                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={priceChangeConfirmed}
                    onChange={(e) => setPriceChangeConfirmed(e.target.checked)}
                    className="rounded border-white/40 text-brand-cyan focus:ring-brand-cyan"
                  />
                  <span>
                    {t("manifest.confirmUpdatedPrice", {
                      amount: formatPrice(Math.max(0, subtotal - discount)),
                    })}
                  </span>
                </label>
              </div>
            )}

            {/* Promo Code Input Box */}
            {selectedProduct && (
              <div className="mb-6 pb-6 border-b border-white/10">
                <label htmlFor="checkout-couponCode" className="text-[10px] uppercase font-bold text-white/50 tracking-widest block mb-2">
                  {t("manifest.couponCode")}
                </label>
                <div className="flex gap-2">
                  <input
                    id="checkout-couponCode"
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
                      {t("manifest.removeCoupon")}
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
                  <span>{t("lens." + type + ".label", { defaultValue: lensLabelByType[type] ?? type })}</span>
                  <span>{formatPrice(lensPriceByType[type] ?? 0)}</span>
                </div>
              ))}
              <div className="flex justify-between text-white/70 pt-2 border-t border-white/5 font-medium">
                <span>{t("manifest.subtotal")}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-emerald-300 font-medium">
                  <span>
                    {t("manifest.discount")} ({appliedCoupon})
                  </span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-brand-cyan/80">
                <span>
                  {(deliveryEstimate?.shippingFee ?? 0) > 0
                    ? t("manifest.remoteShippingFee")
                    : t("manifest.complimentaryShipping")}
                </span>
                <span>{formatPrice(deliveryEstimate?.shippingFee ?? 0)}</span>
              </div>
            </div>

            <div className="mb-6 rounded-2xl bg-white/8 px-4 py-4 text-xs text-slate-200 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/50">{t("manifest.readiness")}</p>
              <p>{completionScore >= 4 ? t("manifest.nearlyComplete") : t("manifest.stillInProgress")}</p>
              <p className="text-white/70 pt-1 border-t border-white/10">{t("manifest.deliveryPromise")}</p>
              <p className="text-white/70">{t("manifest.afterSalesPromise")}</p>
              <p className="text-white/80 pt-1 border-t border-white/10">{tCommon("support.preSalesHint")}</p>
            </div>

            {user ? (
              <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/50">{t("manifest.accountIdentity")}</p>
                <p className="mt-2 font-medium text-white">{accountDisplayName}</p>
                <p className="text-white/60">{user.email}</p>
              </div>
            ) : null}
            {prepayReviewPreviewKey && (
              <div
                role="status"
                aria-live="polite"
                className="mb-6 rounded-2xl border border-amber-300/60 bg-amber-400/15 px-4 py-3.5 text-xs text-amber-100 space-y-1.5"
              >
                <p className="font-semibold text-amber-200 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{t("manifest.prepayReviewNoticeTitle")}</span>
                </p>
                <p className="text-amber-100/90 leading-relaxed">{t(prepayReviewPreviewKey)}</p>
              </div>
            )}

            <div className="flex justify-between items-end mb-8 pt-6 border-t border-white/10">
              <span className="text-white/50 text-xs font-medium uppercase tracking-widest">{t("manifest.totalCommission")}</span>
              <span className="text-3xl font-light tracking-tight">
                {formatPrice(Math.max(0, subtotal - discount) + (deliveryEstimate?.shippingFee ?? 0))}
              </span>
            </div>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !selectedProduct ||
                isLoadingProduct ||
                Boolean(lensError) ||
                !hasSelectedBaseLens ||
                !checkoutSystemStatus.checkoutEnabled ||
                Boolean(deliveryEstimate && !deliveryEstimate.deliverable)
              }
              className="w-full bg-white text-brand-primary hover:bg-slate-100 text-xs group"
            >
              {isSubmitting
                ? submitStage === "creatingOrder"
                  ? t("submitStage.creatingOrder")
                  : submitStage === "preparingGateway"
                    ? t("submitStage.preparingGateway")
                    : submitStage === "redirecting"
                      ? t("submitStage.redirecting")
                      : t("manifest.authorizing")
                : prepayReviewPreviewKey || deliveryEstimate?.manualReviewRequired
                  ? t("manifest.submitForReview")
                  : t("manifest.authorizePayment")}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <div className="mt-6 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-semibold tracking-widest justify-center">
                <CheckCircle2 className="w-3 h-3" />
                <span>{t("manifest.encryptedTransaction")}</span>
              </div>
              <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-semibold tracking-widest justify-center">
                <ShieldCheck className="w-3 h-3" />
                <span>{t("manifest.swissDataPrivacy")}</span>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* WeChat QR Cashier Modal */}
      {showCashierModal && createdOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="relative w-full max-w-md overflow-hidden bg-white/95 border border-white/20 shadow-2xl rounded-3xl p-8 backdrop-blur-xl transition-all transform duration-300 scale-100 flex flex-col items-center text-center">
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
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md">
                    微
                  </div>
                  <span className="text-base font-semibold text-slate-800">{t("cashier.wechatPay")}</span>
                </div>

                <p className="text-xs text-slate-500 mb-6 font-medium">
                  {t("cashier.scanInstructions")}
                </p>

                {/* Self-contained SVG QR Code Data URI (satisfies strict img-src 'self' data: blob: CSP) */}
                <div className="relative p-4 bg-white border border-slate-100 rounded-3xl shadow-lg mb-6 flex items-center justify-center">
                  <img
                    src={generateQrCodeDataUrl(createdOrder.payData ?? "", 200)}
                    alt={t("cashier.qrAlt")}
                    className="w-48 h-48 object-contain rounded-xl"
                    loading="lazy"
                  />
                  <div
                    className="absolute left-6 right-6 h-0.5 bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                    style={{ animation: "scan 2s ease-in-out infinite" }}
                  />
                </div>

                <div className="mb-4">
                  <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase mb-1">{t("cashier.amountDue")}</p>
                  <p className="text-3xl font-light text-slate-800 font-mono tracking-tight">
                    {formatPrice(createdOrder.totalAmount)}
                  </p>
                </div>

                <div className="w-full h-px bg-slate-100 mb-5" />

                {/* Simulation Trigger Option (strictly Dev Mode Only) */}
                {isDevMode && (
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
                )}

                <div className="flex items-center gap-1.5 justify-center text-slate-400 text-[11px]">
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                  <span>{t("cashier.polling")}</span>
                </div>
              </>
            ) : (
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
