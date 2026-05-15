import { CheckCircle2, Package, Truck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type OrderConfirmationState = {
  orderNumber?: string;
  status?: string;
  totalAmount?: number;
  productName?: string;
  lensOptionTypes?: string[];
  customer?: { firstName: string; lastName: string; email: string; shippingAddress: string };
};

const LENS_LABELS: Record<string, string> = { HIGH_INDEX_174: "Custom Lenses (High-Index)", AR_ONYX: "Onyx AR Coating", HEV_BLUE: "HEV Filter" };

export function OrderConfirmationPage() {
  const location = useLocation();
  const state = location.state as OrderConfirmationState | null;

  if (!state?.orderNumber) {
    return (
      <div className="flex-1 w-full bg-surface-offwhite py-10 lg:py-16 px-5 sm:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-slate-500">No order information found.</p>
          <Link to="/collections" className="mt-4 inline-block"><Button variant="outline-light">Browse Collections</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-surface-offwhite py-10 lg:py-16 px-5 sm:px-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <PageIntro eyebrow="Order Confirmed" title="Thank You!" description="Your Klarheit optical commission has been received and is being prepared." actions={<div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><p className="text-sm font-semibold text-emerald-700">Order Placed Successfully</p></div></div>} />
        <SectionCard eyebrow="Order Details" title={state.orderNumber} description="Your order has been confirmed and a confirmation email has been sent.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-slate-50 px-5 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Product</p><p className="mt-2 text-lg font-display font-medium text-brand-primary">{state.productName}</p></div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Status</p><p className="mt-2 text-lg font-display font-medium text-brand-primary">{state.status}</p></div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Total</p><p className="mt-2 text-lg font-display font-medium text-brand-primary">{currencyFormatter.format(state.totalAmount ?? 0)}</p></div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Shipping To</p><p className="mt-2 text-sm text-brand-primary">{state.customer?.shippingAddress}</p></div>
          </div>
          {state.lensOptionTypes && state.lensOptionTypes.length > 0 && (
            <div className="mt-6"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">Lens Configuration</p><div className="flex flex-col gap-2">{state.lensOptionTypes.map((type) => (<div key={type} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-brand-primary">{LENS_LABELS[type] ?? type}</div>))}</div></div>
          )}
        </SectionCard>
        <SectionCard eyebrow="What's Next" title="Order Timeline" description="Here's what to expect with your Klarheit commission.">
          <div className="flex flex-col gap-4">
            {[
              { icon: CheckCircle2, label: "Order Confirmed", description: "Your order has been received and payment is being processed.", active: true },
              { icon: Package, label: "Lens Crafting", description: "Your custom lenses will be precision-crafted to your prescription.", active: false },
              { icon: Truck, label: "Shipped", description: "Your finished glasses will be shipped with tracking information.", active: false },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${step.active ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-400"}`}><step.icon className="w-5 h-5" /></div>
                <div><p className="text-sm font-semibold text-brand-primary">{step.label}</p><p className="text-sm text-slate-500 mt-1">{step.description}</p></div>
              </div>
            ))}
          </div>
        </SectionCard>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/my-account" className="w-full sm:w-auto"><Button variant="outline-light" className="w-full">View My Orders</Button></Link>
          <Link to="/collections" className="w-full sm:w-auto"><Button variant="outline-light" className="w-full">Continue Shopping</Button></Link>
        </div>
      </div>
    </div>
  );
}
