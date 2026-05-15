import { CheckCircle2, Package, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { formatPrice } from "../lib/utils";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";

type OrderConfirmationState = {
  orderNumber?: string;
  status?: string;
  totalAmount?: number;
  productName?: string;
  lensOptionTypes?: string[];
  customer?: { firstName: string; lastName: string; email: string; shippingAddress: string };
};

export function OrderConfirmationPage() {
  const { t } = useTranslation("confirmation");
  const location = useLocation();
  const state = location.state as OrderConfirmationState | null;

  if (!state?.orderNumber) {
    return (
      <div className="flex-1 w-full bg-surface-offwhite py-10 lg:py-16 px-5 sm:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-slate-500">{t("noOrderInfo")}</p>
          <Link to="/collections" className="mt-4 inline-block"><Button variant="outline-light">{t("browseCollections")}</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-surface-offwhite py-10 lg:py-16 px-5 sm:px-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <PageIntro eyebrow={t("eyebrow")} title={t("title")} description={t("description")} actions={<div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><p className="text-sm font-semibold text-emerald-700">{t("orderPlacedSuccess")}</p></div></div>} />
        <SectionCard eyebrow={t("details.eyebrow")} title={state.orderNumber} description={t("details.description")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-slate-50 px-5 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("details.product")}</p><p className="mt-2 text-lg font-display font-medium text-brand-primary">{state.productName}</p></div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("details.status")}</p><p className="mt-2 text-lg font-display font-medium text-brand-primary">{state.status}</p></div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("details.total")}</p><p className="mt-2 text-lg font-display font-medium text-brand-primary">{formatPrice(state.totalAmount ?? 0)}</p></div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("details.shippingTo")}</p><p className="mt-2 text-sm text-brand-primary">{state.customer?.shippingAddress}</p></div>
          </div>
          {state.lensOptionTypes && state.lensOptionTypes.length > 0 && (
            <div className="mt-6"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">{t("details.lensConfiguration")}</p><div className="flex flex-col gap-2">{state.lensOptionTypes.map((type) => (<div key={type} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-brand-primary">{t("lensLabels." + type, { defaultValue: type })}</div>))}</div></div>
          )}
        </SectionCard>
        <SectionCard eyebrow={t("timeline.eyebrow")} title={t("timeline.title")} description={t("timeline.description")}>
          <div className="flex flex-col gap-4">
            {[
              { icon: CheckCircle2, label: t("timeline.orderConfirmed"), description: t("timeline.orderConfirmedDesc"), active: true },
              { icon: Package, label: t("timeline.lensCrafting"), description: t("timeline.lensCraftingDesc"), active: false },
              { icon: Truck, label: t("timeline.shipped"), description: t("timeline.shippedDesc"), active: false },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${step.active ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-400"}`}><step.icon className="w-5 h-5" /></div>
                <div><p className="text-sm font-semibold text-brand-primary">{step.label}</p><p className="text-sm text-slate-500 mt-1">{step.description}</p></div>
              </div>
            ))}
          </div>
        </SectionCard>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/my-account" className="w-full sm:w-auto"><Button variant="outline-light" className="w-full">{t("viewMyOrders")}</Button></Link>
          <Link to="/collections" className="w-full sm:w-auto"><Button variant="outline-light" className="w-full">{t("continueShopping")}</Button></Link>
        </div>
      </div>
    </div>
  );
}
