import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, ShoppingCart, Trash2 } from "lucide-react";
import { useCart, type CartItem } from "../hooks/useCart";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { formatPrice } from "../lib/utils";
import { track } from "../services/analytics";

function itemTotal(item: CartItem) {
  return item.basePrice + item.lensPrice;
}

export function CartPage() {
  const { t } = useTranslation("cart");
  const { items, subtotal, removeItem, clear } = useCart();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  function handleCheckoutSelected() {
    if (!selected) return;
    const checkoutState = {
      product: {
        id: selected.productId,
        name: selected.productName,
        imageUrl: selected.productImageUrl,
        basePrice: selected.basePrice,
        // minimal fields for Checkout; backend re-fetches full product
        material: "",
        nameEn: selected.productName,
        nameZh: selected.productName,
        materialEn: "",
        materialZh: "",
        shape: "",
        specsSize: "",
        detailImages: null,
      },
      prescription: selected.prescription,
      lensOptionTypes: selected.lensOptionTypes,
      finishId: selected.finishId,
      cartItemId: selected.id,
    };
    try {
      sessionStorage.setItem("klarheit_checkout_state", JSON.stringify(checkoutState));
    } catch {
      /* ignore */
    }
    track("checkout_from_cart", {
      item_count: 1,
      total_amount: itemTotal(selected),
    });
    // Remove after successful navigation intent; actual order confirm clears
    navigate("/checkout", { state: checkoutState });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col w-full px-5 sm:px-8 lg:px-12 max-w-[1000px] mx-auto py-16 gap-10">
        <PageIntro eyebrow={t("eyebrow")} title={t("title")} description={t("emptyDesc")} />
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 flex flex-col items-center gap-4 text-center">
          <ShoppingCart className="w-10 h-10 text-slate-300" />
          <p className="text-sm text-slate-500">{t("empty")}</p>
          <Link to="/collections">
            <Button variant="primary" className="mt-2">
              {t("browse")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        <div className="flex flex-col gap-4">
          {items.map((item) => {
            const isSelected = selected?.id === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border bg-white p-5 flex flex-col sm:flex-row gap-5 transition-colors ${
                  isSelected ? "border-brand-primary ring-1 ring-brand-primary/40" : "border-slate-200"
                }`}
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
                    <div>
                      <p className="text-sm font-semibold tracking-tight">{item.productName}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {item.finishId ? `${t("finish")}: ${item.finishId}` : t("defaultFinish")}
                        {item.lensOptionTypes.length > 0
                          ? ` · ${item.lensOptionTypes.length} ${t("lensOptions")}`
                          : ` · ${t("noLenses")}`}
                      </p>
                      {item.prescription && (
                        <p className="text-[11px] text-slate-400 font-mono mt-1">
                          PD {item.prescription.pd} · SPH {item.prescription.sphOd}/{item.prescription.sphOs}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      aria-label={t("remove")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400">
                      {isSelected ? t("selectedForCheckout") : t("clickToSelect")}
                    </span>
                    <span className="text-sm font-mono text-brand-primary">
                      {formatPrice(itemTotal(item))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={clear}
              className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-red-500 font-semibold"
            >
              {t("clearAll")}
            </button>
            <Link to="/collections" className="text-[10px] uppercase tracking-widest text-brand-primary font-semibold">
              {t("continueShopping")}
            </Link>
          </div>
        </div>

        <aside className="rounded-3xl border border-brand-primary/10 bg-brand-primary text-white p-6 shadow-xl sticky top-24">
          <h3 className="text-lg font-display font-medium mb-6">{t("summary")}</h3>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between text-white/70">
              <span>{t("items")}</span>
              <span>{items.length}</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>{t("selected")}</span>
              <span className="truncate max-w-[140px]">{selected?.productName ?? "—"}</span>
            </div>
            <div className="h-px bg-white/15 my-2" />
            <div className="flex justify-between items-end">
              <span className="text-white/70 text-sm">{t("subtotal")}</span>
              <span className="text-2xl font-display font-light">
                {formatPrice(selected ? itemTotal(selected) : subtotal)}
              </span>
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed mt-1">
              {t("checkoutHint")}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={handleCheckoutSelected}
            disabled={!selected}
            className="w-full mt-8 bg-white text-brand-primary hover:bg-slate-100 border-0 py-4 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2"
          >
            {t("checkoutSelected")}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </aside>
      </div>
    </div>
  );
}
