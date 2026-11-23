import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, RotateCcw, ShoppingCart, Sliders, Trash2, X } from "lucide-react";
import { useCart, type CartItem } from "../hooks/useCart";
import { useAuth } from "../auth/AuthProvider";
import { Button, buttonClassName } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { cn, formatPrice } from "../lib/utils";
import { markFreshCheckoutHandoff } from "../lib/selection";
import { track } from "../services/analytics";

function itemTotal(item: CartItem) {
  return item.basePrice + item.lensPrice;
}

export function CartPage() {
  const { t } = useTranslation("cart");
  const { t: tAr } = useTranslation("ar-studio");
  const { items, subtotal, removeItem, restoreItem, clearPrivateData, clear } = useCart();
  const { user, requireAuth } = useAuth();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const [deletedBackup, setDeletedBackup] = useState<{ item: CartItem; index: number } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    track("cart_viewed", { item_count: items.length });
  }, [items.length]);

  useEffect(() => {
    if (!selectedId && items.length > 0) {
      setSelectedId(items[0].id);
    }
    if (selectedId && !items.some((i) => i.id === selectedId)) {
      setSelectedId(items[0]?.id ?? null);
    }
  }, [items, selectedId]);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );

  const getFinishLabel = (finishId?: string) => {
    if (!finishId) return t("defaultFinish");
    return tAr("color." + finishId, { defaultValue: finishId });
  };

  function handleRemoveWithUndo(item: CartItem, index: number) {
    removeItem(item.id);
    setDeletedBackup({ item, index });
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => {
      setDeletedBackup(null);
      undoTimerRef.current = null;
    }, 9000);
  }

  function handleUndoRemove() {
    if (!deletedBackup) return;
    restoreItem(deletedBackup.item, deletedBackup.index);
    setSelectedId(deletedBackup.item.id);
    setDeletedBackup(null);
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }

  function handleConfigureItem(item: CartItem) {
    if (item.finishId) {
      try {
        sessionStorage.setItem("savedFinishId", item.finishId);
      } catch {
        /* ignore */
      }
    }
    navigate("/config-lab", {
      state: {
        productId: item.productId,
        finishId: item.finishId,
        sizeSpec: item.sizeSpec,
        skuId: item.skuId,
        cartItemId: item.id,
        prescription: item.prescription,
        lensOptionTypes: item.lensOptionTypes,
        tryOnSnapshot: item.tryOnSnapshot,
        wearerName: item.wearerName,
        savePrescriptionToProfile: item.savePrescriptionToProfile,
      },
    });
  }

  function handleCheckoutSelected() {
    if (!selected) return;
    if (!selected.lensOptionTypes || selected.lensOptionTypes.length === 0) {
      handleConfigureItem(selected);
      return;
    }
    const checkoutState = {
      product: {
        id: selected.productId,
        name: selected.productName,
        imageUrl: selected.productImageUrl,
        basePrice: selected.basePrice,
        material: "",
        nameEn: selected.productName,
        nameZh: selected.productName,
        materialEn: "",
        materialZh: "",
        shape: "",
        specsSize: selected.sizeSpec ?? "",
        detailImages: null,
      },
      prescription: selected.prescription,
      lensOptionTypes: selected.lensOptionTypes,
      finishId: selected.finishId,
      sizeSpec: selected.sizeSpec,
      skuId: selected.skuId,
      cartItemId: selected.id,
      quotedTotal: itemTotal(selected),
      wearerName: selected.wearerName,
      savePrescriptionToProfile: selected.savePrescriptionToProfile,
      accountEmail: user?.email ?? undefined,
    };
    if (!requireAuth({ path: "/checkout", state: checkoutState })) return;
    try {
      sessionStorage.setItem("klarheit_checkout_state", JSON.stringify(checkoutState));
    } catch {
      /* ignore */
    }
    track("checkout_from_cart", {
      item_count: 1,
      total_amount: itemTotal(selected),
    });
    markFreshCheckoutHandoff();
    navigate("/checkout", { state: checkoutState });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col w-full px-5 sm:px-8 lg:px-12 max-w-[1000px] mx-auto py-16 gap-10">
        <PageIntro eyebrow={t("eyebrow")} title={t("title")} description={t("emptyDesc")} />
        {deletedBackup && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-slate-800 bg-brand-primary text-white px-5 py-3.5 flex items-center justify-between gap-3"
          >
            <span className="text-xs font-semibold">
              {t("removedToast", { name: deletedBackup.item.productName })}
            </span>
            <button
              type="button"
              onClick={handleUndoRemove}
              className="inline-flex items-center gap-1 rounded-xl bg-white text-brand-primary px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t("undoRemove")}
            </button>
          </div>
        )}
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 flex flex-col items-center gap-4 text-center">
          <ShoppingCart className="w-10 h-10 text-slate-300" />
          <p className="text-sm text-slate-500">{t("empty")}</p>
          <Link
            to="/collections"
            className={buttonClassName({ variant: "primary", className: "mt-2" })}
          >
            {t("browse")}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>
    );
  }

  const selectedNeedsLenses = Boolean(selected && (!selected.lensOptionTypes || selected.lensOptionTypes.length === 0));
  const selectedFinishLabel = selected ? getFinishLabel(selected.finishId) : "";

  return (
    <div className="flex flex-col w-full px-5 sm:px-8 lg:px-12 max-w-[1200px] mx-auto py-12 sm:py-16 gap-10">
      <PageIntro
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
              {t("countLabel")}
            </p>
            <p className="mt-2 text-2xl font-display font-medium text-brand-primary">{items.length}</p>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
        <div className="flex flex-col gap-4" role="radiogroup" aria-label={t("selectRadioLabel")}>
          {items.map((item, idx) => {
            const isSelected = selected?.id === item.id;
            const needsLenses = !item.lensOptionTypes || item.lensOptionTypes.length === 0;
            const finishLbl = getFinishLabel(item.finishId);
            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-2xl border bg-white p-5 flex flex-col sm:flex-row gap-5 transition-all",
                  isSelected
                    ? "border-brand-primary ring-2 ring-brand-primary/25 shadow-sm"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="w-24 h-24 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-3 shrink-0"
                >
                  <img
                    src={item.productImageUrl}
                    alt={item.productName}
                    className="max-w-full max-h-full object-contain mix-blend-multiply"
                  />
                </button>
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold tracking-tight text-brand-primary">{item.productName}</p>
                        {needsLenses && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            {t("pendingLensBadge")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {t("finishTag", { finish: finishLbl })}
                        {item.sizeSpec ? ` · ${t("sizeTag", { size: item.sizeSpec })}` : ""}
                        {item.lensOptionTypes.length > 0
                          ? ` · ${item.lensOptionTypes.length} ${t("lensOptions")}`
                          : ` · ${t("noLenses")}`}
                      </p>
                      {item.prescription && (
                        <p className="text-[11px] text-slate-400 font-mono mt-1">
                          PD {item.prescription.pd} · SPH {item.prescription.sphOd}/{item.prescription.sphOs}
                        </p>
                      )}
                      {(item.wearerName || item.savePrescriptionToProfile) && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {item.wearerName && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              {t("wearerTag", { name: item.wearerName })}
                            </span>
                          )}
                          {item.savePrescriptionToProfile && (
                            <span className="rounded-full bg-brand-cyan/10 px-2 py-0.5 text-[10px] font-medium text-brand-primary">
                              {t("saveRxTag")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleConfigureItem(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-primary hover:bg-slate-50 transition-colors"
                      >
                        <Sliders className="w-3 h-3" />
                        {needsLenses ? t("configureLenses") : t("editLenses")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveWithUndo(item, idx)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1.5"
                        aria-label={t("remove")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                        isSelected
                          ? "border-brand-primary bg-brand-primary text-white"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-primary/40"
                      )}
                    >
                      <span
                        className={cn(
                          "w-3 h-3 rounded-full border flex items-center justify-center",
                          isSelected ? "border-white bg-white" : "border-slate-400 bg-white"
                        )}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />}
                      </span>
                      <span>{t("selectRadioLabel")}</span>
                    </button>
                    <span className="text-sm font-mono font-semibold text-brand-primary">
                      {formatPrice(itemTotal(item))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {deletedBackup && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl border border-slate-800 bg-brand-primary text-white px-4 py-3 flex items-center justify-between gap-3 shadow-lg"
            >
              <span className="text-xs font-semibold truncate">
                {t("removedToast", { name: deletedBackup.item.productName })}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleUndoRemove}
                  className="inline-flex items-center gap-1 rounded-xl bg-white text-brand-primary px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t("undoRemove")}
                </button>
                <button
                  type="button"
                  aria-label={t("dismissToast")}
                  onClick={() => setDeletedBackup(null)}
                  className="p-1 text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {privacyNotice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
              {privacyNotice}
            </div>
          )}

          <div className="flex flex-wrap justify-between items-center gap-3 pt-2">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={clear}
                className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-red-500 font-semibold"
              >
                {t("clearAll")}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearPrivateData();
                  setPrivacyNotice(t("privateDataCleared"));
                }}
                className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-brand-primary font-semibold"
              >
                {t("clearPrivateData")}
              </button>
            </div>
            <Link to="/collections" className="text-[10px] uppercase tracking-widest text-brand-primary font-semibold">
              {t("continueShopping")}
            </Link>
          </div>
        </div>

        <aside className="rounded-3xl border border-brand-primary/10 bg-brand-primary text-white p-6 shadow-xl lg:sticky lg:top-24">
          <h3 className="text-lg font-display font-medium text-white mb-2">{t("summary")}</h3>
          <p className="text-xs text-brand-cyan/90 font-medium mb-5">{t("singlePairNotice")}</p>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between text-white/70">
              <span>{t("items")}</span>
              <span>{items.length}</span>
            </div>
            <div className="flex justify-between gap-2 text-white/90">
              <span className="text-white/70 shrink-0">{t("selected")}</span>
              <span className="truncate text-right font-medium">
                {selected ? `${selected.productName} · ${selectedFinishLabel}` : "—"}
              </span>
            </div>
            <div className="h-px bg-white/15 my-2" />
            <div className="flex justify-between items-end">
              <span className="text-white/70 text-sm">{t("subtotal")}</span>
              <span className="text-2xl font-display font-light">
                {formatPrice(selected ? itemTotal(selected) : subtotal)}
              </span>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed mt-1">
              {selectedNeedsLenses ? t("configureLensesHint") : t("checkoutHint")}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={handleCheckoutSelected}
            disabled={!selected}
            className="w-full mt-6 bg-white text-brand-primary hover:bg-slate-100 border-0 py-4 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2"
          >
            {selectedNeedsLenses ? t("continueConfigure") : t("checkoutSelected")}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </aside>
      </div>
    </div>
  );
}
