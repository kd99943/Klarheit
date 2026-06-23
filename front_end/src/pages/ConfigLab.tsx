// front_end/src/pages/ConfigLab.tsx
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AR_FRAME_CATALOG, getFrameConfigForProduct } from "../ar/frameCatalog";
import { useAuth } from "../auth/AuthProvider";
import { useProducts } from "../hooks/useProducts";
import { useLensOptions } from "../hooks/useLensOptions";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { cn, formatPrice } from "../lib/utils";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";

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

type PrescriptionErrors = Partial<Record<keyof PrescriptionForm, string>>;

const PRESCRIPTION_RANGES = {
  sphOd: { min: -20, max: 20, label: "SPH OD" },
  sphOs: { min: -20, max: 20, label: "SPH OS" },
  cylOd: { min: -10, max: 10, label: "CYL OD" },
  cylOs: { min: -10, max: 10, label: "CYL OS" },
  axisOd: { min: 0, max: 180, label: "Axis OD" },
  axisOs: { min: 0, max: 180, label: "Axis OS" },
  pd: { min: 0, max: 80, label: "PD" },
} as const;

function validatePrescription(form: PrescriptionForm): PrescriptionErrors {
  const errors: PrescriptionErrors = {};
  for (const [key, range] of Object.entries(PRESCRIPTION_RANGES)) {
    const field = key as keyof PrescriptionForm;
    const val = form[field];
    if (!val.trim()) {
      errors[field] = `${range.label} is required`;
      continue;
    }
    const num = Number(val);
    if (!Number.isFinite(num)) {
      errors[field] = `${range.label} must be a number`;
    } else if (num < range.min || num > range.max) {
      errors[field] = `${range.label} must be between ${range.min} and ${range.max}`;
    } else if (["sphOd", "sphOs", "cylOd", "cylOs"].includes(key)) {
      const isMultipleOf025 = Math.abs(Math.round(num * 4) - num * 4) < 1e-9;
      if (!isMultipleOf025) {
        errors[field] = `${range.label} must be in 0.25 increments (e.g. -2.00, -2.25)`;
      }
    }
  }
  return errors;
}

export function ConfigLab() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation("config-lab");
  const { t: tAr } = useTranslation("ar-studio");
  const { products } = useProducts();
  const { options: lensOptions, isLoading: isLoadingLens } = useLensOptions();

  const [activeStep, setActiveStep] = useState<Step>(1);
  const [prescription, setPrescription] = useState<PrescriptionForm>({
    sphOd: "", sphOs: "", cylOd: "", cylOs: "", axisOd: "", axisOs: "", pd: "",
  });
  const [errors, setErrors] = useState<PrescriptionErrors>({});
  const [selectedLensTypes, setSelectedLensTypes] = useState<string[]>([]);

  // Retrieve finishId from route state or sessionStorage
  const [finishId] = useState<string | null>(() => {
    const stateFinish = location.state?.finishId;
    if (stateFinish) return stateFinish;
    try {
      return sessionStorage.getItem("savedFinishId");
    } catch (e) {
      return null;
    }
  });

  const selectedProduct = useMemo(() => {
    if (!products.length) return null;
    if (!finishId) return products[0];
    const match = products.find(p => {
      const slug = p.name.toLowerCase().replace(/\s+/g, "-");
      return p.name.toLowerCase() === finishId.toLowerCase() || slug === finishId.toLowerCase();
    });
    return match || products[0];
  }, [products, finishId]);

  const selectedFinishConfig = useMemo(() => {
    if (!selectedProduct) return null;
    return getFrameConfigForProduct(selectedProduct);
  }, [selectedProduct]);

  const isZh = i18n.language === "zh";
  const productName = selectedProduct ? (isZh ? selectedProduct.nameZh : selectedProduct.nameEn) : "";
  const productMaterial = selectedProduct ? (isZh ? selectedProduct.materialZh : selectedProduct.materialEn) : "";

  const steps = [
    { id: 1 as Step, label: t("steps.prescription.label"), description: t("steps.prescription.description") },
    { id: 2 as Step, label: t("steps.surface.label"), description: t("steps.surface.description") },
    { id: 3 as Step, label: t("steps.review.label"), description: t("steps.review.description") },
  ];

  useEffect(() => {
    if (lensOptions.length > 0 && selectedLensTypes.length === 0) {
      setSelectedLensTypes([lensOptions[0].type]);
    }
  }, [lensOptions, selectedLensTypes.length]);

  function handlePrescriptionChange(field: keyof PrescriptionForm, value: string) {
    setPrescription((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function toggleLensType(type: string) {
    setSelectedLensTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function handleNextStep() {
    if (activeStep === 1) {
      const validationErrors = validatePrescription(prescription);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
    }
    if (activeStep < 3) {
      setActiveStep((s) => (s + 1) as Step);
    }
  }

  function handleInitializeOrder() {
    const validationErrors = validatePrescription(prescription);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setActiveStep(1);
      return;
    }
    const checkoutState = {
      product: selectedProduct,
      prescription: {
        sphOd: Number(prescription.sphOd),
        sphOs: Number(prescription.sphOs),
        cylOd: Number(prescription.cylOd),
        cylOs: Number(prescription.cylOs),
        axisOd: Number(prescription.axisOd),
        axisOs: Number(prescription.axisOs),
        pd: Number(prescription.pd),
      },
      lensOptionTypes: selectedLensTypes,
      finishId: finishId || undefined,
    };
    try {
      sessionStorage.setItem("klarheit_checkout_state", JSON.stringify(checkoutState));
    } catch (e) {
      console.error("Failed to save checkout state to sessionStorage", e);
    }
    navigate("/checkout", {
      state: checkoutState,
    });
  }

  const lensOptionsByCategory = {
    LENS: lensOptions.filter((o) => o.category === "LENS"),
    COATING: lensOptions.filter((o) => o.category === "COATING"),
  };

  const lensTotal = lensOptions
    .filter((o) => selectedLensTypes.includes(o.type))
    .reduce((sum, o) => sum + o.additionalPrice, 0);
  const totalPrice = (selectedProduct?.basePrice ?? 0) + lensTotal;

  return (
    <div className="flex-1 flex overflow-hidden bg-surface-offwhite">
      <aside className="hidden lg:flex w-24 border-r border-slate-200 flex-col items-center py-8 gap-8 shrink-0 bg-white/50">
        {steps.map((step) => (
          <button
            key={step.id}
            onClick={() => setActiveStep(step.id)}
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
          <div className="w-[1px] h-24 bg-slate-200"></div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-y-auto w-full">
        <div className="p-5 sm:p-8 lg:p-12 pb-4">
          <PageIntro
            eyebrow={t("eyebrow")}
            title={t("title")}
            description={t("description")}
            actions={
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("engine")}</p>
                <p className="mt-2 text-2xl font-display font-medium text-brand-primary">v2.4</p>
              </div>
            }
          />
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3 lg:hidden">
            {steps.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={cn(
                  "rounded-2xl border px-4 py-4 text-left transition-colors",
                  activeStep === step.id ? "border-brand-primary bg-white" : "border-slate-200 bg-white/70"
                )}
              >
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{String(step.id).padStart(2, "0")}</p>
                <p className="mt-2 text-sm font-semibold text-brand-primary">{step.label}</p>
                <p className="mt-1 text-xs text-slate-500">{step.description}</p>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {(["sphOd", "sphOs", "cylOd", "cylOs", "axisOd", "axisOs", "pd"] as const).map((field) => (
                    <div key={field}>
                      <FormField
                        label={PRESCRIPTION_RANGES[field].label}
                        type="number"
                        step={field.startsWith("axis") ? "1" : "0.25"}
                        min={String(PRESCRIPTION_RANGES[field].min)}
                        max={String(PRESCRIPTION_RANGES[field].max)}
                        value={prescription[field]}
                        onChange={(e) => handlePrescriptionChange(field, e.target.value)}
                        hint={field === "pd" ? t("step1.pdHint") : undefined}
                      />
                      {errors[field] && (
                        <p className="text-xs text-red-500 mt-1">{errors[field]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {activeStep === 2 && (
              <SectionCard
                eyebrow={t("step2.eyebrow")}
                title={t("step2.title")}
                description={t("step2.description")}
              >
                {isLoadingLens ? (
                  <p className="text-sm text-slate-500">{t("step2.loadingLens")}</p>
                ) : (
                  <div className="flex flex-col gap-6">
                    {lensOptionsByCategory.LENS.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">{t("step2.lensType")}</p>
                        {lensOptionsByCategory.LENS.map((option) => (
                          <div
                            key={option.id}
                            onClick={() => toggleLensType(option.type)}
                            className={cn(
                              "flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors mb-2",
                              selectedLensTypes.includes(option.type)
                                ? "border-brand-primary/50 bg-slate-50"
                                : "border-slate-200 hover:border-slate-300"
                            )}
                          >
                            <div>
                              <p className="text-sm font-semibold text-brand-primary">{t("lens." + option.type + ".label", { defaultValue: option.label })}</p>
                              <p className="text-xs text-slate-500 mt-1">{t("lens." + option.type + ".description", { defaultValue: option.description })}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-mono text-slate-600">{formatPrice(option.additionalPrice)}</span>
                              <div className={cn(
                                "w-5 h-5 rounded-full border bg-white transition-all",
                                selectedLensTypes.includes(option.type) ? "border-[5px] border-brand-primary" : "border border-slate-300"
                              )} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {lensOptionsByCategory.COATING.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">{t("step2.coatings")}</p>
                        {lensOptionsByCategory.COATING.map((option) => (
                          <div
                            key={option.id}
                            onClick={() => toggleLensType(option.type)}
                            className={cn(
                              "flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors mb-2",
                              selectedLensTypes.includes(option.type)
                                ? "border-brand-primary/50 bg-slate-50"
                                : "border-slate-200 hover:border-slate-300"
                            )}
                          >
                            <div>
                              <p className="text-sm font-semibold text-brand-primary">{t("lens." + option.type + ".label", { defaultValue: option.label })}</p>
                              <p className="text-xs text-slate-500 mt-1">{t("lens." + option.type + ".description", { defaultValue: option.description })}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-mono text-slate-600">{formatPrice(option.additionalPrice)}</span>
                              <div className={cn(
                                "w-5 h-5 rounded-full border bg-white transition-all",
                                selectedLensTypes.includes(option.type) ? "border-[5px] border-brand-primary" : "border border-slate-300"
                              )} />
                            </div>
                          </div>
                        ))}
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
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">{t("step3.prescription")}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(["sphOd", "sphOs", "cylOd", "cylOs", "axisOd", "axisOs", "pd"] as const).map((field) => (
                        <div key={field} className="rounded-xl bg-slate-50 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{PRESCRIPTION_RANGES[field].label}</p>
                          <p className="mt-2 text-lg font-mono font-medium text-brand-primary">{prescription[field]}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">{t("step3.selectedOptions")}</p>
                    <div className="flex flex-col gap-2">
                      {lensOptions.filter((o) => selectedLensTypes.includes(o.type)).map((option) => (
                        <div key={option.id} className="flex justify-between items-center rounded-xl bg-slate-50 px-4 py-3">
                          <span className="text-sm font-medium text-brand-primary">{t("lens." + option.type + ".label", { defaultValue: option.label })}</span>
                          <span className="text-sm font-mono text-slate-600">{formatPrice(option.additionalPrice)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="rounded-2xl border border-brand-primary/10 bg-brand-primary text-white p-6 sm:p-8 h-full flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h2 className="text-2xl font-display font-medium mb-1 tracking-wide">{productName || "AERO X1"}</h2>
                    <p className="text-[10px] text-brand-cyan/80 uppercase tracking-widest font-semibold mt-2">{productMaterial || "Titanium"}</p>
                  </div>
                  <div className="bg-white/10 px-2 py-1 rounded text-[9px] font-mono tracking-widest border border-white/20">{t("summary.premium")}</div>
                </div>
                <ul className="space-y-6 text-sm">
                  <li className="flex flex-col gap-1 border-b border-white/10 pb-4">
                    <span className="text-white/50 text-xs font-medium">{t("summary.frame")}</span>
                    <span className="font-semibold tracking-wide">{productName || "—"}</span>
                  </li>
                  {finishId && selectedFinishConfig && (
                    <li className="flex flex-col gap-1 border-b border-white/10 pb-4">
                      <span className="text-white/50 text-xs font-medium">{t("summary.finish")}</span>
                      <span className="font-semibold tracking-wide">
                        {tAr("color." + finishId, { defaultValue: selectedFinishConfig.finishLabelKey })}
                      </span>
                    </li>
                  )}
                  <li className="flex flex-col gap-1 border-b border-white/10 pb-4">
                    <span className="text-white/50 text-xs font-medium">{t("summary.selectedOptions")}</span>
                    <span className="font-semibold tracking-wide">{selectedLensTypes.length} option{selectedLensTypes.length !== 1 ? "s" : ""}</span>
                  </li>
                </ul>
                <div className="mt-8 rounded-2xl bg-white/8 px-4 py-4 text-sm text-slate-200">
                  <div className="flex items-center gap-2 text-brand-cyan">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">{t("summary.activeStage")}</span>
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
                    <button
                      type="button"
                      onClick={handleInitializeOrder}
                      className="w-full bg-white text-brand-primary py-4 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-slate-100 transition-colors rounded-sm flex items-center justify-center gap-2"
                    >
                      {t("initializeOrder")}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
