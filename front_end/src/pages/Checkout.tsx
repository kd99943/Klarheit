import { CheckCircle2, ChevronRight, ShieldCheck } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useProducts } from "../hooks/useProducts";
import { checkoutOrder, isApiErrorWithStatus, type Product } from "../services/api";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type CheckoutLocationState = {
  product?: Product;
  prescription?: { sphOd: number; sphOs: number; cylOd: number; cylOs: number; axisOd: number; axisOs: number; pd: number };
  lensOptionTypes?: string[];
};

type CustomerForm = { firstName: string; lastName: string; email: string; shippingAddress: string };
type PrescriptionForm = { sphOd: string; sphOs: string; cylOd: string; cylOs: string; axisOd: string; axisOs: string; pd: string };
type PaymentForm = { cardNumber: string; expiry: string; cvc: string };

const LENS_LABELS: Record<string, string> = { HIGH_INDEX_174: "Custom Lenses (High-Index)", AR_ONYX: "Onyx AR Coating", HEV_BLUE: "HEV Filter" };
const LENS_PRICES: Record<string, number> = { HIGH_INDEX_174: 215, AR_ONYX: 60, HEV_BLUE: 30 };

export function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as CheckoutLocationState | null;
  const { user, openAuthModal } = useAuth();
  const { products, isLoading: isLoadingProducts, error: catalogError } = useProducts();

  const selectedProduct = routeState?.product ?? products[0] ?? null;
  const isLoadingProduct = !routeState?.product && isLoadingProducts;
  const prescriptionFromConfig = routeState?.prescription;
  const lensOptionTypesFromConfig = routeState?.lensOptionTypes;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerForm>({ firstName: "", lastName: "", email: user?.email ?? "", shippingAddress: "" });
  const [prescription, setPrescription] = useState<PrescriptionForm>({
    sphOd: prescriptionFromConfig ? String(prescriptionFromConfig.sphOd) : "",
    sphOs: prescriptionFromConfig ? String(prescriptionFromConfig.sphOs) : "",
    cylOd: prescriptionFromConfig ? String(prescriptionFromConfig.cylOd) : "",
    cylOs: prescriptionFromConfig ? String(prescriptionFromConfig.cylOs) : "",
    axisOd: prescriptionFromConfig ? String(prescriptionFromConfig.axisOd) : "",
    axisOs: prescriptionFromConfig ? String(prescriptionFromConfig.axisOs) : "",
    pd: prescriptionFromConfig ? String(prescriptionFromConfig.pd) : "",
  });
  const [payment, setPayment] = useState<PaymentForm>({ cardNumber: "", expiry: "", cvc: "" });

  const activeLensTypes = lensOptionTypesFromConfig ?? ["HIGH_INDEX_174", "AR_ONYX", "HEV_BLUE"];

  useEffect(() => {
    if (user) {
      setCustomer((c) => ({ ...c, firstName: c.firstName || user.firstName, lastName: c.lastName || user.lastName, email: user.email }));
    }
  }, [user]);

  const lensTotal = useMemo(() => activeLensTypes.reduce((t, type) => t + (LENS_PRICES[type] ?? 0), 0), [activeLensTypes]);
  const subtotal = (selectedProduct?.basePrice ?? 0) + lensTotal;
  const completionScore = [customer.firstName, customer.lastName, customer.email, customer.shippingAddress, payment.cardNumber, payment.expiry, payment.cvc].filter((v) => v.trim()).length;
  const accountDisplayName = user ? `${user.firstName} ${user.lastName}`.trim() : "";

  function handleCustomerChange(e: ChangeEvent<HTMLInputElement>) { const { name, value } = e.target; setCustomer((c) => ({ ...c, [name]: value })); }
  function handlePrescriptionChange(e: ChangeEvent<HTMLInputElement>) { const { name, value } = e.target; setPrescription((c) => ({ ...c, [name]: value })); }
  function handlePaymentChange(e: ChangeEvent<HTMLInputElement>) { const { name, value } = e.target; setPayment((c) => ({ ...c, [name]: value })); }

  function getNumericPrescription() {
    const np = { sphOd: Number(prescription.sphOd), sphOs: Number(prescription.sphOs), cylOd: Number(prescription.cylOd), cylOs: Number(prescription.cylOs), axisOd: Number(prescription.axisOd), axisOs: Number(prescription.axisOs), pd: Number(prescription.pd) };
    return Object.values(np).some((v) => !Number.isFinite(v)) ? null : np;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProduct) { setSubmitError("Select a product before submitting checkout."); return; }
    const numericPrescription = getNumericPrescription();
    if (!numericPrescription) { setSubmitError("Prescription values must all be valid numbers."); return; }
    setIsSubmitting(true); setSubmitError(null);
    try {
      const response = await checkoutOrder({ productId: selectedProduct.id, lensOptionTypes: activeLensTypes, customer: { firstName: customer.firstName, lastName: customer.lastName, email: customer.email, shippingAddress: customer.shippingAddress }, prescription: numericPrescription });
      navigate("/order-confirmation", { state: { orderNumber: response.orderNumber, status: response.status, totalAmount: response.totalAmount, productName: response.productName, lensOptionTypes: response.lensOptionTypes, customer: { firstName: customer.firstName, lastName: customer.lastName, email: customer.email, shippingAddress: customer.shippingAddress } } });
    } catch (error) {
      if (isApiErrorWithStatus(error, 401) || isApiErrorWithStatus(error, 403)) { openAuthModal({ mode: "signin", message: "Your session expired before checkout completed. Sign in again to submit this order.", pendingNavigation: { path: "/checkout", state: { product: selectedProduct } } }); }
      setSubmitError(error instanceof Error ? error.message : "Checkout failed.");
    } finally { setIsSubmitting(false); }
  }

  return (
    <div className="flex-1 w-full bg-surface-offwhite py-10 lg:py-16 px-5 sm:px-8">
      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-7 flex flex-col gap-10">
          <PageIntro eyebrow="Secure Order" title="Finalize Commission" description="Confirm customer information, validate prescription values, and authorize payment for the current optical build." actions={<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm min-w-40"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Form Status</p><p className="mt-2 text-2xl font-display font-medium text-brand-primary">{completionScore}/7</p></div>} />
          <SectionCard title="Client Details" eyebrow="Step 01" description="Identity and delivery fields are required for the existing checkout request.">
            {user ? <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Account on file</p><div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-brand-primary">{accountDisplayName}</p><p className="text-sm text-slate-500">{user.email}</p></div><div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-brand-cyan">Synced to checkout identity</div></div></div> : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6"><div className="flex flex-col gap-2"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">First Name</label><input name="firstName" value={customer.firstName} onChange={handleCustomerChange} required type="text" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" /></div><div className="flex flex-col gap-2"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Last Name</label><input name="lastName" value={customer.lastName} onChange={handleCustomerChange} required type="text" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" /></div></div>
            <div className="flex flex-col gap-2 mb-6"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Email Address</label><input name="email" value={customer.email} onChange={handleCustomerChange} required type="email" readOnly className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" /></div>
            <div className="flex flex-col gap-2"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Shipping Address</label><input name="shippingAddress" value={customer.shippingAddress} onChange={handleCustomerChange} required type="text" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" /></div>
          </SectionCard>
          <SectionCard title="Prescription Details" eyebrow="Step 02" description={prescriptionFromConfig ? "Prescription loaded from Config Lab. Values are pre-filled." : "All values remain mapped to the current backend order contract."}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{(["sphOd", "sphOs", "cylOd", "cylOs", "axisOd", "axisOs"] as const).map((field) => (<div key={field} className="flex flex-col gap-2"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{field.replace(/([A-Z])/g, " $1").toUpperCase()}</label><input name={field} value={prescription[field]} onChange={handlePrescriptionChange} required step={field.startsWith("axis") ? "1" : "0.25"} type="number" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" /></div>))}</div>
            <div className="flex flex-col gap-2 mt-6"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Pupillary Distance (PD)</label><input name="pd" value={prescription.pd} onChange={handlePrescriptionChange} required min="40" max="80" step="0.5" type="number" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" /></div>
          </SectionCard>
          <SectionCard title="Payment Method" eyebrow="Step 03" description="Card fields stay client-side only here; no checkout protocol changes were introduced.">
            <div className="border border-brand-primary rounded-lg p-4 bg-slate-50 relative overflow-hidden mb-6"><div className="flex justify-between items-center z-10 relative"><div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full border-4 border-brand-primary bg-white"></div><span className="text-sm font-semibold text-brand-primary">Credit Card</span></div><div className="flex gap-2"><div className="w-8 h-5 bg-slate-200 rounded shrink-0"></div><div className="w-8 h-5 bg-slate-200 rounded shrink-0"></div></div></div></div>
            <div className="flex flex-col gap-2 mb-6"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Card Number</label><input name="cardNumber" value={payment.cardNumber} onChange={handlePaymentChange} required type="text" placeholder="0000 0000 0000 0000" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-lg font-mono text-brand-primary" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6"><div className="flex flex-col gap-2 relative"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Expiry</label><input name="expiry" value={payment.expiry} onChange={handlePaymentChange} required type="text" placeholder="MM/YY" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-lg font-mono text-brand-primary" /></div><div className="flex flex-col gap-2 relative"><label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">CVC</label><input name="cvc" value={payment.cvc} onChange={handlePaymentChange} required type="text" placeholder="123" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-lg font-mono text-brand-primary" /></div></div>
          </SectionCard>
          {submitError ? <div className="border border-red-200 bg-red-50 text-red-700 px-6 py-4 rounded-xl text-sm">{submitError}</div> : null}
        </div>
        <div className="lg:col-span-5">
          <div className="bg-brand-primary text-white rounded-2xl p-6 sm:p-8 shadow-xl sticky top-28">
            <h2 className="text-lg font-display font-medium tracking-wide mb-8 border-b border-white/10 pb-4">Manifest</h2>
            {isLoadingProduct ? <div className="text-sm text-white/70 pb-6 mb-6 border-b border-white/10">Loading selected product...</div> : null}
            {catalogError ? <div className="text-sm text-red-200 pb-6 mb-6 border-b border-white/10">{catalogError}</div> : null}
            {selectedProduct ? (
              <div className="flex gap-4 sm:gap-6 items-center border-b border-white/10 pb-6 mb-6"><div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center p-2 shrink-0 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.8)]"><img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-contain mix-blend-multiply" /></div><div className="flex-1"><h3 className="font-display font-medium text-lg">{selectedProduct.name}</h3><p className="text-[10px] text-brand-cyan uppercase tracking-widest font-semibold mt-1">{selectedProduct.material}</p><p className="text-white/60 text-xs mt-2 font-mono">ID: PR-{String(selectedProduct.id).padStart(4, "0")}</p></div><div className="text-right"><span className="font-mono text-sm">{currencyFormatter.format(selectedProduct.basePrice)}</span></div></div>
            ) : (
              <div className="border border-white/10 rounded-lg p-5 text-sm text-white/70 mb-6">No product selected. Return to the <Link to="/collections" className="underline underline-offset-4 text-white">collection</Link> and choose a frame first.</div>
            )}
            <div className="space-y-3 mb-8 text-sm">{activeLensTypes.map((type) => (<div key={type} className="flex justify-between text-white/70"><span>{LENS_LABELS[type] ?? type}</span><span>{currencyFormatter.format(LENS_PRICES[type] ?? 0)}</span></div>))}<div className="flex justify-between text-white/70 pt-2 border-t border-white/5"><span>Subtotal</span><span>{currencyFormatter.format(subtotal)}</span></div><div className="flex justify-between text-brand-cyan/80"><span>Complimentary Shipping</span><span>{currencyFormatter.format(0)}</span></div></div>
            <div className="mb-8 rounded-2xl bg-white/8 px-4 py-4 text-sm text-slate-200"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/50">Readiness</p><p className="mt-2">Customer and payment fields are {completionScore >= 6 ? "nearly complete" : "still in progress"}.</p></div>
            {user ? <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/50">Account Identity</p><p className="mt-2 font-medium text-white">{accountDisplayName}</p><p className="text-white/60">{user.email}</p></div> : null}
            <div className="flex justify-between items-end mb-8 pt-6 border-t border-white/10"><span className="text-white/50 text-xs font-medium uppercase tracking-widest">Total Commission</span><span className="text-3xl font-light tracking-tight">{currencyFormatter.format(subtotal)}</span></div>
            <Button type="submit" disabled={isSubmitting || !selectedProduct || isLoadingProduct} className="w-full bg-white text-brand-primary hover:bg-slate-100 text-xs group">{isSubmitting ? "AUTHORIZING..." : "AUTHORIZE PAYMENT"}<ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></Button>
            <div className="mt-6 flex flex-col gap-2"><div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-semibold tracking-widest justify-center"><CheckCircle2 className="w-3 h-3" /><span>Encrypted Transaction</span></div><div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-semibold tracking-widest justify-center"><ShieldCheck className="w-3 h-3" /><span>Swiss Data Privacy Active</span></div></div>
          </div>
        </div>
      </form>
    </div>
  );
}
