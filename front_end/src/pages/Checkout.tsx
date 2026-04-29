import { CheckCircle2, ChevronRight, ShieldCheck } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { checkoutOrder, fetchProducts, type Product } from "../services/api";

const LENS_PACKAGE = [
  { type: "HIGH_INDEX_174", label: "Custom Lenses (High-Index)", price: 215 },
  { type: "AR_ONYX", label: "Onyx AR Coating", price: 60 },
  { type: "HEV_BLUE", label: "HEV Filter", price: 30 },
] as const;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type CheckoutLocationState = {
  product?: Product;
};

type CustomerForm = {
  firstName: string;
  lastName: string;
  email: string;
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

type PaymentForm = {
  cardNumber: string;
  expiry: string;
  cvc: string;
};

export function Checkout() {
  const location = useLocation();
  const routeState = location.state as CheckoutLocationState | null;
  const { user } = useAuth();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(routeState?.product ?? null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(!routeState?.product);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerForm>({
    firstName: "",
    lastName: "",
    email: user?.email ?? "",
    shippingAddress: "",
  });
  const [prescription, setPrescription] = useState<PrescriptionForm>({
    sphOd: "-2.25",
    sphOs: "-2.00",
    cylOd: "-0.50",
    cylOs: "-0.25",
    axisOd: "180",
    axisOs: "175",
    pd: "63.50",
  });
  const [payment, setPayment] = useState<PaymentForm>({
    cardNumber: "",
    expiry: "",
    cvc: "",
  });

  useEffect(() => {
    if (routeState?.product) {
      setSelectedProduct(routeState.product);
      setIsLoadingProduct(false);
      return;
    }

    let isCancelled = false;

    async function loadFallbackProduct() {
      try {
        const products = await fetchProducts();
        if (!isCancelled) {
          setSelectedProduct(products[0] ?? null);
          setCatalogError(products.length ? null : "No products are available for checkout.");
        }
      } catch (error) {
        if (!isCancelled) {
          setCatalogError(error instanceof Error ? error.message : "Unable to load the selected product.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingProduct(false);
        }
      }
    }

    void loadFallbackProduct();

    return () => {
      isCancelled = true;
    };
  }, [routeState]);

  useEffect(() => {
    if (user) {
      setCustomer((current) => ({
        ...current,
        firstName: current.firstName || user.firstName,
        lastName: current.lastName || user.lastName,
        email: user.email,
      }));
    }
  }, [user]);

  const lensTotal = useMemo(
    () => LENS_PACKAGE.reduce((total, item) => total + item.price, 0),
    []
  );
  const subtotal = (selectedProduct?.basePrice ?? 0) + lensTotal;

  function handleCustomerChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setCustomer((current) => ({ ...current, [name]: value }));
  }

  function handlePrescriptionChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setPrescription((current) => ({ ...current, [name]: value }));
  }

  function handlePaymentChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setPayment((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProduct) {
      setSubmitError("Select a product before submitting checkout.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const response = await checkoutOrder({
        productId: selectedProduct.id,
        lensOptionTypes: LENS_PACKAGE.map((item) => item.type),
        customer: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          shippingAddress: customer.shippingAddress,
        },
        prescription: {
          sphOd: Number(prescription.sphOd),
          sphOs: Number(prescription.sphOs),
          cylOd: Number(prescription.cylOd),
          cylOs: Number(prescription.cylOs),
          axisOd: Number(prescription.axisOd),
          axisOs: Number(prescription.axisOs),
          pd: Number(prescription.pd),
        },
      });

      setSuccessMessage(`Order ${response.orderNumber} created successfully.`);
      setPayment({
        cardNumber: "",
        expiry: "",
        cvc: "",
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Checkout failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex-1 w-full bg-surface-offwhite py-12 lg:py-20 px-8">
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7 flex flex-col gap-10">
          <div>
            <h1 className="text-3xl lg:text-4xl font-display font-light text-brand-primary tracking-tight mb-2">
              Finalize Commission
            </h1>
            <p className="text-sm text-slate-500 font-light">Secure Checkout for the selected optical build.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
            <h2 className="text-xs uppercase font-bold text-brand-primary mb-6 tracking-widest border-b border-slate-100 pb-4">
              Client Details
            </h2>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">First Name</label>
                <input
                  name="firstName"
                  value={customer.firstName}
                  onChange={handleCustomerChange}
                  required
                  type="text"
                  className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Last Name</label>
                <input
                  name="lastName"
                  value={customer.lastName}
                  onChange={handleCustomerChange}
                  required
                  type="text"
                  className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Email Address</label>
              <input
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
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Shipping Address</label>
              <input
                name="shippingAddress"
                value={customer.shippingAddress}
                onChange={handleCustomerChange}
                required
                type="text"
                className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
            <h2 className="text-xs uppercase font-bold text-brand-primary mb-6 tracking-widest border-b border-slate-100 pb-4">
              Prescription Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">SPH OD</label>
                <input name="sphOd" value={prescription.sphOd} onChange={handlePrescriptionChange} required step="0.25" type="number" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">SPH OS</label>
                <input name="sphOs" value={prescription.sphOs} onChange={handlePrescriptionChange} required step="0.25" type="number" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">CYL OD</label>
                <input name="cylOd" value={prescription.cylOd} onChange={handlePrescriptionChange} required step="0.25" type="number" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">CYL OS</label>
                <input name="cylOs" value={prescription.cylOs} onChange={handlePrescriptionChange} required step="0.25" type="number" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Axis OD</label>
                <input name="axisOd" value={prescription.axisOd} onChange={handlePrescriptionChange} required min="0" max="180" type="number" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Axis OS</label>
                <input name="axisOs" value={prescription.axisOs} onChange={handlePrescriptionChange} required min="0" max="180" type="number" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" />
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-6">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Pupillary Distance (PD)</label>
              <input name="pd" value={prescription.pd} onChange={handlePrescriptionChange} required min="40" max="80" step="0.5" type="number" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
            <h2 className="text-xs uppercase font-bold text-brand-primary mb-6 tracking-widest border-b border-slate-100 pb-4">
              Payment Method
            </h2>
            <div className="border border-brand-primary rounded-lg p-4 bg-slate-50 relative overflow-hidden mb-6">
              <div className="flex justify-between items-center z-10 relative">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-4 border-brand-primary bg-white"></div>
                  <span className="text-sm font-semibold text-brand-primary">Credit Card</span>
                </div>
                <div className="flex gap-2">
                  <div className="w-8 h-5 bg-slate-200 rounded shrink-0"></div>
                  <div className="w-8 h-5 bg-slate-200 rounded shrink-0"></div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Card Number</label>
              <input
                name="cardNumber"
                value={payment.cardNumber}
                onChange={handlePaymentChange}
                required
                type="text"
                placeholder="0000 0000 0000 0000"
                className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-lg font-mono text-brand-primary"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-2 relative">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Expiry</label>
                <input
                  name="expiry"
                  value={payment.expiry}
                  onChange={handlePaymentChange}
                  required
                  type="text"
                  placeholder="MM/YY"
                  className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-lg font-mono text-brand-primary"
                />
              </div>
              <div className="flex flex-col gap-2 relative">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">CVC</label>
                <input
                  name="cvc"
                  value={payment.cvc}
                  onChange={handlePaymentChange}
                  required
                  type="text"
                  placeholder="123"
                  className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-lg font-mono text-brand-primary"
                />
              </div>
            </div>
          </div>

          {submitError ? (
            <div className="border border-red-200 bg-red-50 text-red-700 px-6 py-4 rounded-xl text-sm">
              {submitError}
            </div>
          ) : null}

          {successMessage ? (
            <div className="border border-emerald-200 bg-emerald-50 text-emerald-700 px-6 py-4 rounded-xl text-sm">
              {successMessage}
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-5">
          <div className="bg-brand-primary text-white rounded-xl p-8 shadow-xl sticky top-28">
            <h2 className="text-lg font-display font-medium tracking-wide mb-8 border-b border-white/10 pb-4">
              Manifest
            </h2>

            {isLoadingProduct ? (
              <div className="text-sm text-white/70 pb-6 mb-6 border-b border-white/10">Loading selected product...</div>
            ) : null}

            {catalogError ? (
              <div className="text-sm text-red-200 pb-6 mb-6 border-b border-white/10">{catalogError}</div>
            ) : null}

            {selectedProduct ? (
            <div className="flex gap-6 items-center border-b border-white/10 pb-6 mb-6">
              <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center p-2 shrink-0 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.8)]">
                <img 
                  src={selectedProduct.imageUrl} 
                  alt={selectedProduct.name} 
                  className="w-full h-full object-contain mix-blend-multiply"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-medium text-lg">{selectedProduct.name}</h3>
                <p className="text-[10px] text-brand-cyan uppercase tracking-widest font-semibold mt-1">{selectedProduct.material}</p>
                <p className="text-white/60 text-xs mt-2 font-mono">ID: PR-{String(selectedProduct.id).padStart(4, "0")}</p>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm">{currencyFormatter.format(selectedProduct.basePrice)}</span>
              </div>
            </div>
            ) : (
              <div className="border border-white/10 rounded-lg p-5 text-sm text-white/70 mb-6">
                No product selected. Return to the <Link to="/collections" className="underline underline-offset-4 text-white">collection</Link> and choose a frame first.
              </div>
            )}

            <div className="space-y-3 mb-8 text-sm">
              {LENS_PACKAGE.map((item) => (
                <div key={item.type} className="flex justify-between text-white/70">
                  <span>{item.label}</span>
                  <span>{currencyFormatter.format(item.price)}</span>
                </div>
              ))}
              <div className="flex justify-between text-white/70 pt-2 border-t border-white/5">
                <span>Subtotal</span>
                <span>{currencyFormatter.format(subtotal)}</span>
              </div>
              <div className="flex justify-between text-brand-cyan/80">
                <span>Complimentary Shipping</span>
                <span>{currencyFormatter.format(0)}</span>
              </div>
            </div>

            <div className="flex justify-between items-end mb-8 pt-6 border-t border-white/10">
              <span className="text-white/50 text-xs font-medium uppercase tracking-widest">Total Commission</span>
              <span className="text-3xl font-light tracking-tight">{currencyFormatter.format(subtotal)}</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedProduct || isLoadingProduct}
              className="w-full bg-white text-brand-primary py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-slate-100 transition-colors rounded-sm flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "AUTHORIZING..." : "AUTHORIZE PAYMENT"}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="mt-6 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-semibold tracking-widest justify-center">
                <CheckCircle2 className="w-3 h-3" />
                <span>Encrypted Transaction</span>
              </div>
              <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-semibold tracking-widest justify-center">
                <ShieldCheck className="w-3 h-3" />
                <span>Swiss Data Privacy Active</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
