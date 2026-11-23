import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, HelpCircle, Sparkles, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getFrameConfigForProduct } from "../ar/frameCatalog";
import {
  getDefaultFinishId,
  getDistinctSizeSpecsForProduct,
  isProductOrderable,
  isSkuOrderable,
  markFreshCheckoutHandoff,
  resolveSkuForSelection,
} from "../lib/selection";
import { readTaggedTryOnSnapshot } from "../lib/privacy";
import { useAuth } from "../auth/AuthProvider";
import { useCart } from "../hooks/useCart";
import { useProducts } from "../hooks/useProducts";
import { useLensOptions } from "../hooks/useLensOptions";
import { fetchLatestPrescription } from "../services/api";
import { FormField } from "../components/ui/FormField";
import { cn, formatPrice } from "../lib/utils";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { track, type PrescriptionValidationErrorCode } from "../services/analytics";

type Step = 1 | 2 | 3;

type PrescriptionForm = {
  sphOd: string;
  sphOs: string;
  cylOd: string;
  cylOs: string;
  axisOd: string;
  axisOs: string;
  pd: string;
};

type PrescriptionFieldKey = keyof PrescriptionForm;

type ConfigLabLocationState = {
  productId?: number;
  finishId?: string;
  sizeSpec?: string;
  skuId?: number;
  cartItemId?: string;
  prescription?: {
    sphOd: number;
    sphOs: number;
    cylOd: number;
    cylOs: number;
    axisOd: number;
    axisOs: number;
    pd: number;
  };
  lensOptionTypes?: string[];
  tryOnSnapshot?: string | null;
  wearerName?: string;
  savePrescriptionToProfile?: boolean;
};

type ValidationFailure = {
  code: PrescriptionValidationErrorCode;
  message: string;
};

type PrescriptionErrors = Partial<Record<PrescriptionFieldKey, ValidationFailure>>;

const PRESCRIPTION_RANGES = {
  sphOd: { min: -20, max: 20, label: "SPH OD" },
  sphOs: { min: -20, max: 20, label: "SPH OS" },
  cylOd: { min: -10, max: 10, label: "CYL OD" },
  cylOs: { min: -10, max: 10, label: "CYL OS" },
  axisOd: { min: 0, max: 180, label: "Axis OD" },
  axisOs: { min: 0, max: 180, label: "Axis OS" },
  pd: { min: 40, max: 80, label: "PD" },
} as const;

const FIELD_ORDER: PrescriptionFieldKey[] = [
  "sphOd",
  "cylOd",
  "axisOd",
  "sphOs",
  "cylOs",
  "axisOs",
  "pd",
];

const SAMPLE_FIELD_KEY_MAP: Record<PrescriptionFieldKey, string> = {
  sphOd: "samplePartOdSph",
  cylOd: "samplePartOdCyl",
  axisOd: "samplePartOdAxis",
  sphOs: "samplePartOsSph",
  cylOs: "samplePartOsCyl",
  axisOs: "samplePartOsAxis",
  pd: "samplePartPd",
};

export function ConfigLab() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as ConfigLabLocationState | null) ?? null;
  const { t, i18n } = useTranslation("config-lab");
  const { t: tAr } = useTranslation("ar-studio");
  const { user } = useAuth();
  const { products } = useProducts();
  const { addItem: addCartItem, updateItem: updateCartItem } = useCart();
  const { options: lensOptions, isLoading: isLoadingLens } = useLensOptions();

  const cartItemId = routeState?.cartItemId;

  const [persistedSelection] = useState<{
    productId?: number;
    finishId?: string | null;
    sizeSpec?: string | null;
    skuId?: number | null;
  }>(() => {
    if (routeState?.productId !== undefined) {
      return {
        productId: routeState.productId,
        finishId: routeState.finishId ?? null,
        sizeSpec: routeState.sizeSpec ?? null,
        skuId: routeState.skuId ?? null,
      };
    }
    try {
      const raw = sessionStorage.getItem("klarheit_selected_selection");
      if (raw) {
        const parsed = JSON.parse(raw) as {
          productId?: number;
          finishId?: string | null;
          sizeSpec?: string | null;
          skuId?: number | null;
        };
        return {
          productId: parsed.productId,
          finishId: routeState?.finishId ?? parsed.finishId ?? null,
          sizeSpec: routeState?.sizeSpec ?? parsed.sizeSpec ?? null,
          skuId: routeState?.skuId ?? parsed.skuId ?? null,
        };
      }
      return {
        finishId: routeState?.finishId ?? sessionStorage.getItem("savedFinishId"),
        sizeSpec: routeState?.sizeSpec ?? null,
        skuId: routeState?.skuId ?? null,
      };
    } catch {
      return {
        finishId: routeState?.finishId ?? null,
        sizeSpec: routeState?.sizeSpec ?? null,
        skuId: routeState?.skuId ?? null,
      };
    }
  });

  const [overrideProductId, setOverrideProductId] = useState<number | null>(null);
  const [overrideFinishId, setOverrideFinishId] = useState<string | null>(null);
  const [overrideSizeSpec, setOverrideSizeSpec] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<Step>(1);
  const [rxHelpMode, setRxHelpMode] = useState<"have" | "help">("have");
  const [highlightedSampleField, setHighlightedSampleField] = useState<PrescriptionFieldKey | null>(null);
  const [wearerName, setWearerName] = useState(() => routeState?.wearerName ?? "");
  const [saveToProfile, setSaveToProfile] = useState(() => Boolean(routeState?.savePrescriptionToProfile));
  const [savedRxNotice, setSavedRxNotice] = useState<string | null>(null);
  const [isLoadingSavedRx, setIsLoadingSavedRx] = useState(false);
  const [priceDeltaNotice, setPriceDeltaNotice] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const fieldRefs = useRef<Partial<Record<PrescriptionFieldKey, HTMLDivElement | null>>>({});
  const sampleCardRef = useRef<HTMLDivElement | null>(null);

  const [prescription, setPrescription] = useState<PrescriptionForm>(() => {
    if (routeState?.prescription) {
      const p = routeState.prescription;
      return {
        sphOd: String(p.sphOd),
        sphOs: String(p.sphOs),
        cylOd: String(p.cylOd),
        cylOs: String(p.cylOs),
        axisOd: String(p.axisOd),
        axisOs: String(p.axisOs),
        pd: String(p.pd),
      };
    }
    return {
      sphOd: "",
      sphOs: "",
      cylOd: "",
      cylOs: "",
      axisOd: "",
      axisOs: "",
      pd: "",
    };
  });
  const [errors, setErrors] = useState<PrescriptionErrors>({});
  const [selectedLensTypes, setSelectedLensTypes] = useState<string[]>(() =>
    routeState?.lensOptionTypes && routeState.lensOptionTypes.length > 0
      ? routeState.lensOptionTypes
      : []
  );

  const [initialFinishId] = useState<string | null>(() => persistedSelection.finishId ?? null);
  const finishId = overrideFinishId ?? initialFinishId;
  const requestedSizeSpec = overrideSizeSpec ?? persistedSelection.sizeSpec ?? null;
  const requestedSkuId = overrideProductId !== null ? null : (persistedSelection.skuId ?? null);

  const [snapshotMeta] = useState<{ productId?: number | null; productName?: string | null } | null>(() => {
    const tagged = readTaggedTryOnSnapshot();
    if (!tagged) return null;
    return { productId: tagged.productId, productName: tagged.productName };
  });

  const [tryOnSnapshot, setTryOnSnapshot] = useState<string | null>(() => {
    if (routeState?.tryOnSnapshot) return routeState.tryOnSnapshot;
    const tagged = readTaggedTryOnSnapshot();
    return tagged?.dataUrl ?? null;
  });

  const { selectedProduct, selectionFallbackWarn } = useMemo(() => {
    if (!products.length) return { selectedProduct: null, selectionFallbackWarn: false };
    const targetId = overrideProductId ?? persistedSelection.productId;
    if (targetId !== undefined && targetId !== null) {
      const byId = products.find((p) => p.id === Number(targetId));
      if (byId && isProductOrderable(byId)) {
        const matchedSku = resolveSkuForSelection(byId, {
          skuId: requestedSkuId,
          finishId,
          sizeSpec: requestedSizeSpec,
        });
        if (!matchedSku || isSkuOrderable(matchedSku)) {
          return { selectedProduct: byId, selectionFallbackWarn: false };
        }
      }
      // Section 4 P0: NEVER silently substitute another product when the user's requested frame/SKU is unavailable.
      // Preserve their prescription & lens draft and require explicit replacement selection.
      return { selectedProduct: null, selectionFallbackWarn: true };
    }
    if (finishId) {
      const match = products.find((p) => {
        const slug = p.name.toLowerCase().replace(/\s+/g, "-");
        const matchesArFinish = p.arConfigs?.some((cfg) => cfg.id === finishId);
        return matchesArFinish || p.name.toLowerCase() === finishId.toLowerCase() || slug === finishId.toLowerCase();
      });
      if (match && isProductOrderable(match)) {
        return { selectedProduct: match, selectionFallbackWarn: false };
      }
      return { selectedProduct: null, selectionFallbackWarn: true };
    }
    const firstAvailable = products.find((p) => isProductOrderable(p));
    return { selectedProduct: firstAvailable ?? null, selectionFallbackWarn: !firstAvailable };
  }, [products, overrideProductId, persistedSelection.productId, finishId, requestedSizeSpec, requestedSkuId]);

  const activeSku = useMemo(
    () =>
      resolveSkuForSelection(selectedProduct, {
        skuId: requestedSkuId,
        finishId,
        sizeSpec: requestedSizeSpec,
      }),
    [selectedProduct, requestedSkuId, finishId, requestedSizeSpec]
  );

  const effectiveSizeSpec = activeSku?.sizeSpec ?? requestedSizeSpec ?? selectedProduct?.specsSize ?? undefined;
  const effectiveFinishId = activeSku?.finishId ?? finishId ?? (selectedProduct ? getDefaultFinishId(selectedProduct) ?? null : null);

  const selectedFinishConfig = useMemo(() => {
    if (!selectedProduct) return null;
    return getFrameConfigForProduct(selectedProduct, effectiveFinishId as never);
  }, [selectedProduct, effectiveFinishId]);

  const isZh = i18n.language === "zh";
  const productName = selectedProduct ? (isZh ? selectedProduct.nameZh : selectedProduct.nameEn) : "";
  const productMaterial = selectedProduct ? (isZh ? selectedProduct.materialZh : selectedProduct.materialEn) : "";
  const finishLabel = effectiveFinishId && selectedFinishConfig
    ? tAr("color." + effectiveFinishId, {
        defaultValue: tAr(selectedFinishConfig.finishLabelKey, { defaultValue: effectiveFinishId }),
      })
    : null;
  const isSnapshotFromAnotherFrame = Boolean(
    tryOnSnapshot &&
      selectedProduct &&
      snapshotMeta?.productId &&
      snapshotMeta.productId !== selectedProduct.id
  );

  const steps = [
    { id: 1 as Step, label: t("steps.prescription.label"), description: t("steps.prescription.description") },
    { id: 2 as Step, label: t("steps.surface.label"), description: t("steps.surface.description") },
    { id: 3 as Step, label: t("steps.review.label"), description: t("steps.review.description") },
  ];

  const stepStartedAtRef = useRef(Date.now());

  const lensOptionsByCategory = useMemo(
    () => ({
      LENS: [...lensOptions.filter((o) => o.category === "LENS")].sort(
        (a, b) => (a.indexValue || 0) - (b.indexValue || 0) || a.additionalPrice - b.additionalPrice
      ),
      COATING: [...lensOptions.filter((o) => o.category === "COATING")].sort(
        (a, b) => a.additionalPrice - b.additionalPrice
      ),
    }),
    [lensOptions]
  );

  // Ensure exactly 1 base lens is selected when lensOptions load (defaults to lowest index / included lens)
  useEffect(() => {
    if (lensOptions.length === 0) return;
    setSelectedLensTypes((prev) => {
      const baseLenses = [...lensOptions.filter((o) => o.category === "LENS")].sort(
        (a, b) => (a.indexValue || 0) - (b.indexValue || 0) || a.additionalPrice - b.additionalPrice
      );
      if (baseLenses.length === 0) {
        return prev.length > 0 ? prev : [lensOptions[0].type];
      }
      const existingBase = prev.find((type) => baseLenses.some((b) => b.type === type));
      const existingCoatings = prev.filter((type) =>
        lensOptions.some((o) => o.category === "COATING" && o.type === type)
      );
      const defaultBase = existingBase ?? baseLenses[0].type;
      const next = [defaultBase, ...existingCoatings];
      if (next.length === prev.length && next.every((value, idx) => value === prev[idx])) {
        return prev;
      }
      return next;
    });
  }, [lensOptions]);

  useEffect(() => {
    track("config_lab_entered", {});
  }, []);

  useEffect(() => {
    stepStartedAtRef.current = Date.now();
  }, [activeStep]);

  function validatePrescriptionForm(form: PrescriptionForm): PrescriptionErrors {
    const nextErrors: PrescriptionErrors = {};
    for (const [key, range] of Object.entries(PRESCRIPTION_RANGES)) {
      const field = key as PrescriptionFieldKey;
      const val = form[field];
      if (!val.trim()) {
        nextErrors[field] = {
          code: "required",
          message: t("validation.required", { field: range.label }),
        };
        continue;
      }
      const num = Number(val);
      if (!Number.isFinite(num)) {
        nextErrors[field] = {
          code: "invalid_number",
          message: t("validation.invalidNumber", { field: range.label }),
        };
      } else if (num < range.min || num > range.max) {
        nextErrors[field] = {
          code: "out_of_range",
          message: t("validation.outOfRange", { field: range.label, min: range.min, max: range.max }),
        };
      } else if (["sphOd", "sphOs", "cylOd", "cylOs"].includes(key)) {
        const isMultipleOf025 = Math.abs(Math.round(num * 4) - num * 4) < 1e-9;
        if (!isMultipleOf025) {
          nextErrors[field] = {
            code: "invalid_step",
            message: t("validation.invalidStep", { field: range.label }),
          };
        }
      }
    }
    return nextErrors;
  }

  function handlePrescriptionChange(field: PrescriptionFieldKey, value: string) {
    setPrescription((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handleOpenFieldSample(field: PrescriptionFieldKey) {
    setRxHelpMode("help");
    setHighlightedSampleField(field);
    window.setTimeout(() => {
      sampleCardRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }, 50);
  }

  async function handleLoadSavedRx() {
    setIsLoadingSavedRx(true);
    setSavedRxNotice(null);
    try {
      const saved = await fetchLatestPrescription();
      if (saved) {
        setPrescription({
          sphOd: String(saved.sphOd),
          sphOs: String(saved.sphOs),
          cylOd: String(saved.cylOd),
          cylOs: String(saved.cylOs),
          axisOd: String(saved.axisOd),
          axisOs: String(saved.axisOs),
          pd: String(saved.pd),
        });
        if (saved.wearerName) {
          setWearerName(saved.wearerName);
        }
        setErrors({});
        setSavedRxNotice(t("savedRxLoaded"));
      } else {
        setSavedRxNotice(t("noSavedRx"));
      }
    } catch {
      setSavedRxNotice(t("noSavedRx"));
    } finally {
      setIsLoadingSavedRx(false);
    }
  }

  function computeLensSum(types: string[]): number {
    return lensOptions
      .filter((o) => types.includes(o.type))
      .reduce((sum, o) => sum + o.additionalPrice, 0);
  }

  function announceLensPriceDelta(prevTypes: string[], nextTypes: string[]) {
    const prevSum = computeLensSum(prevTypes);
    const nextSum = computeLensSum(nextTypes);
    const diff = nextSum - prevSum;
    const nextTotal = (selectedProduct?.basePrice ?? 0) + nextSum;
    const deltaText =
      diff === 0
        ? `+${formatPrice(0)}`
        : diff > 0
          ? `+${formatPrice(diff)}`
          : `-${formatPrice(Math.abs(diff))}`;
    setPriceDeltaNotice(
      t("priceDeltaBanner", {
        delta: deltaText,
        total: formatPrice(nextTotal),
      })
    );
  }

  function selectBaseLens(type: string) {
    setSelectedLensTypes((prev) => {
      const coatings = prev.filter((item) =>
        lensOptionsByCategory.COATING.some((c) => c.type === item)
      );
      const next = [type, ...coatings];
      announceLensPriceDelta(prev, next);
      return next;
    });
  }

  function toggleCoating(type: string) {
    setSelectedLensTypes((prev) => {
      const next = prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type];
      announceLensPriceDelta(prev, next);
      return next;
    });
  }

  function focusFirstInvalidField(validationErrors: PrescriptionErrors) {
    const firstKey = FIELD_ORDER.find((k) => Boolean(validationErrors[k]));
    if (!firstKey) return;
    window.setTimeout(() => {
      const wrapper = fieldRefs.current[firstKey];
      if (wrapper) {
        wrapper.scrollIntoView?.({ behavior: "smooth", block: "center" });
        const input = wrapper.querySelector("input");
        input?.focus();
      }
    }, 30);
  }

  function validateStep1OrReport(): boolean {
    const validationErrors = validatePrescriptionForm(prescription);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      for (const field of Object.keys(validationErrors) as PrescriptionFieldKey[]) {
        const failure = validationErrors[field];
        if (failure) {
          track("config_prescription_validation_failed", {
            field: PRESCRIPTION_RANGES[field].label,
            error_code: failure.code,
          });
        }
      }
      focusFirstInvalidField(validationErrors);
      return false;
    }
    return true;
  }

  function handleStepJump(target: Step) {
    if (target > 1 && !validateStep1OrReport()) {
      setActiveStep(1);
      return;
    }
    setActiveStep(target);
  }

  function handleNextStep() {
    if (activeStep === 1 && !validateStep1OrReport()) {
      return;
    }
    if (activeStep < 3) {
      const completedStep = activeStep === 1 ? "prescription" : "lens";
      track("config_step_completed", {
        step: completedStep,
        duration_sec: Math.round((Date.now() - stepStartedAtRef.current) / 1000),
      });
      setActiveStep((s) => (s + 1) as Step);
    }
  }

  function handlePrevStep() {
    if (activeStep > 1) {
      setActiveStep((s) => (s - 1) as Step);
    }
  }

  const maxAbsSph = useMemo(() => {
    const od = Math.abs(Number(prescription.sphOd));
    const os = Math.abs(Number(prescription.sphOs));
    if (!Number.isFinite(od) && !Number.isFinite(os)) return null;
    return Math.max(Number.isFinite(od) ? od : 0, Number.isFinite(os) ? os : 0);
  }, [prescription.sphOd, prescription.sphOs]);

  const maxAbsCyl = useMemo(() => {
    const od = Math.abs(Number(prescription.cylOd));
    const os = Math.abs(Number(prescription.cylOs));
    return Math.max(Number.isFinite(od) ? od : 0, Number.isFinite(os) ? os : 0);
  }, [prescription.cylOd, prescription.cylOs]);

  const recommendedIndex = useMemo(() => {
    if (maxAbsSph === null) return null;
    if (maxAbsSph <= 3) return "1.56";
    if (maxAbsSph <= 5) return "1.61";
    if (maxAbsSph <= 7) return "1.67";
    return "1.74";
  }, [maxAbsSph]);

  const isComplexRx = (maxAbsSph !== null && maxAbsSph > 8) || maxAbsCyl > 4;

  const effectiveLensTypes =
    selectedLensTypes.length > 0
      ? selectedLensTypes
      : lensOptionsByCategory.LENS.length > 0
        ? [lensOptionsByCategory.LENS[0].type]
        : lensOptions.length > 0
          ? [lensOptions[0].type]
          : [];

  const lensTotal = lensOptions
    .filter((o) => effectiveLensTypes.includes(o.type))
    .reduce((sum, o) => sum + o.additionalPrice, 0);
  const totalPrice = (selectedProduct?.basePrice ?? 0) + lensTotal;

  function buildNumericPrescription() {
    return {
      sphOd: Number(prescription.sphOd),
      sphOs: Number(prescription.sphOs),
      cylOd: Number(prescription.cylOd),
      cylOs: Number(prescription.cylOs),
      axisOd: Number(prescription.axisOd),
      axisOs: Number(prescription.axisOs),
      pd: Number(prescription.pd),
    };
  }

  function handleClearSnapshot() {
    setTryOnSnapshot(null);
    try {
      sessionStorage.removeItem("klarheit_tryon_snapshot");
    } catch {
      /* ignore */
    }
  }

  function handleInitializeOrder() {
    if (!validateStep1OrReport()) {
      setActiveStep(1);
      return;
    }
    if (!selectedProduct) return;
    const numericPrescription = buildNumericPrescription();
    const trimmedWearer = wearerName.trim() || undefined;
    if (cartItemId) {
      updateCartItem(cartItemId, {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productImageUrl: selectedProduct.imageUrl,
        basePrice: selectedProduct.basePrice,
        finishId: effectiveFinishId || undefined,
        sizeSpec: effectiveSizeSpec,
        skuId: activeSku?.id,
        prescription: numericPrescription,
        lensOptionTypes: effectiveLensTypes,
        lensPrice: lensTotal,
        wearerName: trimmedWearer,
        savePrescriptionToProfile: saveToProfile,
      });
    }
    track("config_step_completed", {
      step: "review",
      duration_sec: Math.round((Date.now() - stepStartedAtRef.current) / 1000),
    });
    track("config_proceed_to_checkout_clicked", {});
    const checkoutState = {
      product: selectedProduct,
      prescription: numericPrescription,
      lensOptionTypes: effectiveLensTypes,
      finishId: effectiveFinishId || undefined,
      sizeSpec: effectiveSizeSpec,
      skuId: activeSku?.id,
      cartItemId: cartItemId || undefined,
      quotedTotal: totalPrice,
      wearerName: trimmedWearer,
      savePrescriptionToProfile: saveToProfile,
      accountEmail: user?.email ?? undefined,
    };
    try {
      sessionStorage.setItem("klarheit_checkout_state", JSON.stringify(checkoutState));
    } catch (e) {
      console.error("Failed to save checkout state to sessionStorage", e);
    }
    markFreshCheckoutHandoff();
    navigate("/checkout", { state: checkoutState });
  }

  function handleAddToCart() {
    if (!selectedProduct) return;
    if (!validateStep1OrReport()) {
      setActiveStep(1);
      return;
    }
    const numericPrescription = buildNumericPrescription();
    const trimmedWearer = wearerName.trim() || undefined;
    if (cartItemId) {
      updateCartItem(cartItemId, {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productImageUrl: selectedProduct.imageUrl,
        basePrice: selectedProduct.basePrice,
        finishId: effectiveFinishId || undefined,
        sizeSpec: effectiveSizeSpec,
        skuId: activeSku?.id,
        prescription: numericPrescription,
        lensOptionTypes: effectiveLensTypes,
        lensPrice: lensTotal,
        tryOnSnapshot: tryOnSnapshot,
        wearerName: trimmedWearer,
        savePrescriptionToProfile: saveToProfile,
      });
      navigate("/cart");
      return;
    }
    addCartItem({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productImageUrl: selectedProduct.imageUrl,
      basePrice: selectedProduct.basePrice,
      finishId: effectiveFinishId || undefined,
      sizeSpec: effectiveSizeSpec,
      skuId: activeSku?.id,
      prescription: numericPrescription,
      lensOptionTypes: effectiveLensTypes,
      lensPrice: lensTotal,
      tryOnSnapshot: tryOnSnapshot,
      wearerName: trimmedWearer,
      savePrescriptionToProfile: saveToProfile,
    });
    track("config_added_to_cart", { product_name: selectedProduct.name });
    navigate("/cart");
  }

  function handleSelectReplacementProduct(nextProductId: number) {
    const replacement = products.find((p) => p.id === nextProductId);
    if (!replacement) return;
    const firstOrderableSku = replacement.skus?.find((s) => isSkuOrderable(s));
    const nextFinish = firstOrderableSku?.finishId ?? getDefaultFinishId(replacement) ?? null;
    const nextSizes = getDistinctSizeSpecsForProduct(replacement, nextFinish);
    const nextSize = firstOrderableSku?.sizeSpec ?? nextSizes[0] ?? replacement.specsSize ?? null;
    setOverrideProductId(replacement.id);
    setOverrideFinishId(nextFinish);
    setOverrideSizeSpec(nextSize);
  }

  const availableProducts = products.filter((p) => isProductOrderable(p));

  const renderRxField = (field: PrescriptionFieldKey) => (
    <div
      key={field}
      ref={(el) => {
        fieldRefs.current[field] = el;
      }}
      className="flex flex-col gap-1 h-full"
    >
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => handleOpenFieldSample(field)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-cyan hover:text-brand-primary transition-colors whitespace-nowrap"
        >
          <HelpCircle className="w-3 h-3" />
          {t("seeFieldExample")}
        </button>
      </div>
      <FormField
        className="flex-1 justify-between"
        label={t("fieldLabels." + field, { defaultValue: PRESCRIPTION_RANGES[field].label })}
        type="number"
        step={field.startsWith("axis") ? "1" : field === "pd" ? "0.5" : "0.25"}
        min={String(PRESCRIPTION_RANGES[field].min)}
        max={String(PRESCRIPTION_RANGES[field].max)}
        value={prescription[field]}
        onChange={(e) => handlePrescriptionChange(field, e.target.value)}
        hint={field === "pd" ? t("step1.pdHint") : undefined}
      />
      {errors[field] && (
        <p className="text-xs text-red-500 mt-1" role="alert">
          {errors[field]?.message}
        </p>
      )}
    </div>
  );

  return (
    <div
      className="flex-1 flex overflow-hidden bg-surface-offwhite"
      onFocusCapture={(e) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const tag = target.tagName;
        const inputType = (target as HTMLInputElement).type;
        if (
          (tag === "INPUT" && inputType !== "checkbox" && inputType !== "radio") ||
          tag === "TEXTAREA"
        ) {
          setIsInputFocused(true);
        }
      }}
      onBlurCapture={() => {
        setIsInputFocused(false);
      }}
    >
      <aside className="hidden lg:flex w-24 border-r border-slate-200 flex-col items-center py-8 gap-8 shrink-0 bg-white/50">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => handleStepJump(step.id)}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-mono transition-colors",
              activeStep === step.id
                ? "bg-brand-primary text-white shadow-sm"
                : "border border-slate-200 text-slate-400 hover:border-brand-primary hover:text-brand-primary bg-white"
            )}
          >
            {String(step.id).padStart(2, "0")}
          </button>
        ))}
        <div className="mt-auto mb-4">
          <div className="w-[1px] h-24 bg-slate-200" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-y-auto w-full pb-28 lg:pb-0">
        <div className="p-5 sm:p-8 lg:p-12 pb-4">
          <PageIntro eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

          {selectionFallbackWarn && (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{t("productUnavailableWarn")}</span>
              </div>
              {availableProducts.length > 0 && (
                <select
                  aria-label={t("selectReplacementFrame")}
                  value={selectedProduct?.id ?? ""}
                  onChange={(e) => {
                    const nextId = Number(e.target.value);
                    if (nextId > 0) handleSelectReplacementProduct(nextId);
                  }}
                  className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-brand-primary"
                >
                  <option value="">{t("selectReplacementFrame")}</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(isZh ? p.nameZh : p.nameEn)} · {formatPrice(p.basePrice)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3 lg:hidden">
            {steps.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepJump(step.id)}
                className={cn(
                  "rounded-2xl border px-3 py-3 text-left transition-colors",
                  activeStep === step.id ? "border-brand-primary bg-white shadow-xs" : "border-slate-200 bg-white/70"
                )}
              >
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
                  {String(step.id).padStart(2, "0")}
                </p>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-brand-primary truncate">{step.label}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 p-5 sm:p-8 lg:p-12 pt-4">
          <div className="lg:col-span-8 flex flex-col gap-8">
            {activeStep === 1 && (
              <SectionCard
                eyebrow={t("step1.eyebrow")}
                title={t("step1.title")}
                description={t("step1.description")}
              >
                {/* Prescription Guidance Toggle + Load Saved Rx */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRxHelpMode("have")}
                      className={cn(
                        "rounded-full px-4 py-2 text-xs font-semibold border transition-colors whitespace-nowrap",
                        rxHelpMode === "have"
                          ? "bg-brand-primary text-white border-brand-primary"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {t("modeHasRx")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRxHelpMode("help")}
                      className={cn(
                        "rounded-full px-4 py-2 text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap",
                        rxHelpMode === "help"
                          ? "bg-brand-primary text-white border-brand-primary"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {t("modeNeedHelp")}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleLoadSavedRx}
                    disabled={isLoadingSavedRx}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-brand-primary hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t("loadSavedRx")}
                  </button>
                </div>

                {savedRxNotice && (
                  <div className="mb-5 rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 px-4 py-3 text-xs text-brand-primary">
                    {savedRxNotice}
                  </div>
                )}

                {rxHelpMode === "help" && (
                  <div
                    ref={sampleCardRef}
                    className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3 text-xs text-slate-600 leading-relaxed"
                  >
                    <p className="font-semibold text-brand-primary">{t("sampleTitle")}</p>
                    <p>{t("sampleDesc")}</p>
                    <div className="flex flex-wrap gap-2">
                      {FIELD_ORDER.map((fieldKey) => {
                        const isHighlighted = highlightedSampleField === fieldKey;
                        return (
                          <span
                            key={fieldKey}
                            className={cn(
                              "rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
                              isHighlighted
                                ? "border-brand-primary bg-brand-primary text-white font-semibold ring-2 ring-brand-cyan/40"
                                : "border-slate-200 bg-white text-brand-primary"
                            )}
                          >
                            {t(SAMPLE_FIELD_KEY_MAP[fieldKey])}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-slate-500">{t("fillExampleHint")}</p>
                  </div>
                )}

                {/* Eye-Grouped Prescription Fields (OD / OS / PD) */}
                <div className="flex flex-col gap-5">
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-brand-primary mb-4">
                      {t("rightEyeGroup")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {(["sphOd", "cylOd", "axisOd"] as const).map(renderRxField)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-brand-primary mb-4">
                      {t("leftEyeGroup")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {(["sphOs", "cylOs", "axisOs"] as const).map(renderRxField)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-brand-primary mb-4">
                      {t("pdGroup")}
                    </p>
                    <div className="max-w-sm">{renderRxField("pd")}</div>
                  </div>
                </div>

                {/* Wearer & Save-to-profile controls */}
                <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                      {t("wearerNameLabel")}
                    </label>
                    <input
                      type="text"
                      value={wearerName}
                      onChange={(e) => setWearerName(e.target.value)}
                      placeholder={t("wearerNamePlaceholder")}
                      className="w-full max-w-md bg-transparent border-0 border-b border-slate-200 py-2 text-sm text-brand-primary focus:ring-0 focus:border-brand-primary outline-none"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveToProfile}
                      onChange={(e) => setSaveToProfile(e.target.checked)}
                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                    />
                    <span>{t("saveRxToProfile")}</span>
                  </label>
                </div>

                {isComplexRx && (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    {t("complexRxNotice")}
                  </div>
                )}
              </SectionCard>
            )}

            {activeStep === 2 && (
              <SectionCard
                eyebrow={t("step2.eyebrow")}
                title={t("step2.title")}
                description={t("step2.description")}
              >
                {recommendedIndex && maxAbsSph !== null && (
                  <div className="mb-4 rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 px-4 py-3 text-xs text-brand-primary">
                    {t("recommendedIndex", { maxSph: maxAbsSph.toFixed(2), index: recommendedIndex })}
                  </div>
                )}

                {priceDeltaNotice && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800"
                  >
                    {priceDeltaNotice}
                  </div>
                )}

                <p className="text-xs text-slate-500 mb-5">{t("baseLensRequiredHint")}</p>

                {isLoadingLens ? (
                  <p className="text-sm text-slate-500">{t("step2.loadingLens")}</p>
                ) : (
                  <div className="flex flex-col gap-6">
                    {lensOptionsByCategory.LENS.length > 0 && (
                      <div role="radiogroup" aria-label={t("step2.lensType")}>
                        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">
                          {t("step2.lensType")}
                        </p>
                        {lensOptionsByCategory.LENS.map((option) => {
                          const isSelected = effectiveLensTypes.includes(option.type);
                          return (
                            <button
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              key={option.id}
                              onClick={() => {
                                if (!isSelected) {
                                  track("config_lens_selected", { lens_option_id: String(option.id) });
                                }
                                selectBaseLens(option.type);
                              }}
                              className={cn(
                                "w-full text-left flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors mb-2",
                                isSelected
                                  ? "border-brand-primary bg-slate-50 ring-1 ring-brand-primary/20"
                                  : "border-slate-200 hover:border-slate-300"
                              )}
                            >
                              <div>
                                <p className="text-sm font-semibold text-brand-primary">
                                  {t("lens." + option.type + ".label", { defaultValue: option.label })}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {t("lens." + option.type + ".description", { defaultValue: option.description })}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-4">
                                <span className="text-sm font-mono text-slate-600">
                                  +{formatPrice(option.additionalPrice)}
                                </span>
                                <div
                                  className={cn(
                                    "w-5 h-5 rounded-full border bg-white transition-all",
                                    isSelected ? "border-[5px] border-brand-primary" : "border border-slate-300"
                                  )}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {lensOptionsByCategory.COATING.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">
                          {t("step2.coatings")}
                        </p>
                        {lensOptionsByCategory.COATING.map((option) => {
                          const isSelected = effectiveLensTypes.includes(option.type);
                          return (
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={isSelected}
                              key={option.id}
                              onClick={() => {
                                if (!isSelected) {
                                  track("config_lens_selected", { lens_option_id: String(option.id) });
                                }
                                toggleCoating(option.type);
                              }}
                              className={cn(
                                "w-full text-left flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors mb-2",
                                isSelected
                                  ? "border-brand-primary/60 bg-slate-50"
                                  : "border-slate-200 hover:border-slate-300"
                              )}
                            >
                              <div>
                                <p className="text-sm font-semibold text-brand-primary">
                                  {t("lens." + option.type + ".label", { defaultValue: option.label })}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {t("lens." + option.type + ".description", { defaultValue: option.description })}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-4">
                                <span className="text-sm font-mono text-slate-600">
                                  +{formatPrice(option.additionalPrice)}
                                </span>
                                <div
                                  className={cn(
                                    "w-5 h-5 rounded-md border bg-white transition-all flex items-center justify-center",
                                    isSelected ? "bg-brand-primary border-brand-primary" : "border-slate-300"
                                  )}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            )}

            {activeStep === 3 && (
              <SectionCard
                eyebrow={t("step3.eyebrow")}
                title={t("step3.title")}
                description={t("step3.description")}
              >
                <div className="flex flex-col gap-6">
                  {/* Explicit Wearer & Save-to-Profile Verification Box */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
                      {t("step3.wearerAndSaveTitle")}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500">{t("wearerNameLabel")}</span>
                      <span className="font-semibold text-brand-primary">
                        {wearerName.trim() || t("step3.wearerDefault")}
                      </span>
                    </div>
                    <label className="flex items-center justify-between gap-3 text-xs cursor-pointer pt-2 border-t border-slate-200/70">
                      <span className="text-slate-600">
                        {saveToProfile ? t("step3.saveStatusYes") : t("step3.saveStatusNo")}
                      </span>
                      <input
                        type="checkbox"
                        checked={saveToProfile}
                        onChange={(e) => setSaveToProfile(e.target.checked)}
                        className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                      />
                    </label>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">
                      {t("step3.prescription")}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {FIELD_ORDER.map((field) => (
                        <div key={field} className="rounded-xl bg-slate-50 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
                            {PRESCRIPTION_RANGES[field].label}
                          </p>
                          <p className="mt-2 text-lg font-mono font-medium text-brand-primary">
                            {prescription[field]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">
                      {t("step3.selectedOptions")}
                    </p>
                    <div className="flex flex-col gap-2">
                      {lensOptions
                        .filter((o) => effectiveLensTypes.includes(o.type))
                        .map((option) => (
                          <div key={option.id} className="flex justify-between items-center rounded-xl bg-slate-50 px-4 py-3">
                            <span className="text-sm font-medium text-brand-primary">
                              {t("lens." + option.type + ".label", { defaultValue: option.label })}
                            </span>
                            <span className="text-sm font-mono text-slate-600">
                              {formatPrice(option.additionalPrice)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6">
            {tryOnSnapshot && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
                    {tAr("capture.title")}
                  </p>
                  <button
                    type="button"
                    onClick={handleClearSnapshot}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t("clearSnapshot")}
                  </button>
                </div>
                <img src={tryOnSnapshot} alt={tAr("capture.title")} className="w-full rounded-xl border border-slate-100" />
                {isSnapshotFromAnotherFrame && (
                  <p className="mt-2 text-[11px] font-medium text-amber-700">
                    {t("snapshotDifferentFrame")}
                  </p>
                )}
              </div>
            )}
            <div className="rounded-2xl border border-brand-primary/10 bg-brand-primary text-white p-6 sm:p-8 h-full flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h2 className="text-2xl font-display font-medium text-white mb-1 tracking-wide">
                      {productName || t("frameNotSelectedYet")}
                    </h2>
                    <p className="text-[10px] text-brand-cyan/80 uppercase tracking-widest font-semibold mt-2">
                      {productMaterial || "—"}
                    </p>
                  </div>
                  <div className="bg-white/10 px-2 py-1 rounded text-[9px] font-mono tracking-widest border border-white/20 whitespace-nowrap shrink-0">
                    {t("summary.premium")}
                  </div>
                </div>
                <ul className="space-y-6 text-sm">
                  <li className="flex flex-col gap-1 border-b border-white/10 pb-4">
                    <span className="text-white/50 text-xs font-medium">{t("summary.frame")}</span>
                    <span className="font-semibold tracking-wide">
                      {productName || t("frameNotSelectedYet")}
                    </span>
                  </li>
                  {finishLabel && (
                    <li className="flex flex-col gap-1 border-b border-white/10 pb-4">
                      <span className="text-white/50 text-xs font-medium">{t("summary.finish")}</span>
                      <span className="font-semibold tracking-wide">{finishLabel}</span>
                    </li>
                  )}
                  {effectiveSizeSpec && selectedProduct && (
                    <li className="flex flex-col gap-1 border-b border-white/10 pb-4">
                      <span className="text-white/50 text-xs font-medium">{t("summary.size")}</span>
                      <span className="font-semibold font-mono tracking-wide">{effectiveSizeSpec}</span>
                    </li>
                  )}
                  <li className="flex flex-col gap-1 border-b border-white/10 pb-4">
                    <span className="text-white/50 text-xs font-medium">{t("summary.selectedOptions")}</span>
                    <span className="font-semibold tracking-wide">
                      {t("summary.optionCount", { count: effectiveLensTypes.length })}
                    </span>
                  </li>
                </ul>
                <div className="mt-8 rounded-2xl bg-white/8 px-4 py-4 text-sm text-slate-200">
                  <div className="flex items-center gap-2 text-brand-cyan">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">
                      {t("summary.activeStage")}
                    </span>
                  </div>
                  <p className="mt-2">{steps.find((step) => step.id === activeStep)?.description}</p>
                </div>
              </div>
              <div className="mt-12 relative z-10">
                <div className="flex justify-between items-end mb-8 font-display">
                  <span className="text-sm text-white/60 font-medium">{t("summary.totalValue")}</span>
                  <span className="text-3xl font-light tracking-tight text-white">{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {activeStep > 1 && (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="w-full border border-white/25 text-white py-3 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition-colors rounded-sm flex items-center justify-center gap-1.5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      {t("prevStep")}
                    </button>
                  )}
                  {activeStep < 3 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full bg-white text-brand-primary py-4 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-slate-100 transition-colors rounded-sm flex items-center justify-center gap-2"
                    >
                      {t("nextStep")}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleInitializeOrder}
                        disabled={!selectedProduct}
                        className="w-full bg-white text-brand-primary py-4 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-slate-100 transition-colors rounded-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {t("initializeOrder")}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={!selectedProduct}
                        className="w-full border border-white/40 text-white py-3 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition-colors rounded-sm disabled:opacity-50"
                      >
                        {cartItemId ? t("saveToCart") : t("addToCart")}
                      </button>
                    </>
                  )}
                  <Link
                    to="/collections"
                    className="w-full text-center text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white pt-2"
                  >
                    {t("summary.changeFrame")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Configuration Bar (hidden while typing so keyboard never collides) */}
      {!isInputFocused && (
        <div
          data-testid="config-mobile-bar"
          className="fixed bottom-0 inset-x-0 z-30 lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)]"
        >
          <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-brand-primary truncate">
                {finishLabel ? `${productName} · ${finishLabel}` : productName || "—"}
              </p>
              <p className="text-xs font-mono text-slate-600 mt-0.5" aria-live="polite">
                {t("mobileEstimatedTotal", { total: formatPrice(totalPrice) })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-brand-primary"
                >
                  {t("prevStep")}
                </button>
              )}
              {activeStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-semibold text-white"
                >
                  {t("nextStep")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!selectedProduct}
                  onClick={handleInitializeOrder}
                  className="rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {t("initializeOrder")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
