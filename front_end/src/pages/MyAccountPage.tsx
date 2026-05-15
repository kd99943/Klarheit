import { CalendarDays, CheckCircle2, CreditCard, MapPin, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useOrders } from "../hooks/useOrders";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { Button } from "../components/ui/Button";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function MyAccountPage() {
  const { user } = useAuth();
  const { orders, isLoading: isLoadingOrders, error: ordersError } = useOrders();

  return (
    <div className="flex-1 w-full bg-surface-offwhite px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        <PageIntro eyebrow="Verified Account" title="My Account" description="Manage your Klarheit identity, optical profile, and recent order activity from one secure workspace." actions={<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm min-w-44"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Profile Status</p><p className="mt-2 flex items-center gap-2 text-lg font-display font-medium text-brand-primary"><ShieldCheck className="h-5 w-5 text-brand-cyan" />Verified</p></div>} />
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-8">
            <SectionCard eyebrow="Identity" title="Account Overview" description="Primary contact details used for secure access, order correspondence, and prescription records.">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-sm font-bold uppercase tracking-[0.2em] text-white">{user ? `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`.toUpperCase() : "KA"}</div>
                    <div><p className="text-xl font-display font-medium text-brand-primary">{user ? `${user.firstName} ${user.lastName}` : "Klarheit Client"}</p><p className="text-sm text-slate-500">{user?.email ?? "client@klarheit.com"}</p></div>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white px-4 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Member Since</p><p className="mt-2 text-sm font-medium text-brand-primary">April 2026</p></div>
                    <div className="rounded-xl bg-white px-4 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Account Tier</p><p className="mt-2 text-sm font-medium text-brand-primary">Verified Optical Client</p></div>
                  </div>
                </div>
                <div className="rounded-2xl bg-brand-primary p-5 text-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/55">Secure Access</p>
                  <p className="mt-3 text-lg font-display font-medium">Account health is stable.</p>
                  <p className="mt-2 text-sm text-white/70 leading-6">Profile data, saved prescriptions, and checkout identity are aligned across the current session.</p>
                  <div className="mt-5 rounded-2xl bg-white/8 px-4 py-4"><p className="text-[10px] uppercase tracking-[0.2em] text-brand-cyan font-semibold">Session</p><p className="mt-2 text-sm">FX-4920 secure channel active</p></div>
                </div>
              </div>
            </SectionCard>

            <SectionCard eyebrow="Order Activity" title="Recent Orders" description="Track current production status and revisit recent commissions.">
              {isLoadingOrders ? (
                <p className="text-sm text-slate-500">Loading orders...</p>
              ) : ordersError ? (
                <p className="text-sm text-red-500">{ordersError}</p>
              ) : orders.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
                  <p className="text-sm text-slate-500">No orders yet.</p>
                  <Link to="/collections" className="mt-3 inline-block"><Button variant="outline-light" className="text-xs">Browse Collections</Button></Link>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {orders.map((order) => (
                    <div key={order.orderNumber} className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.3)]">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{order.orderNumber}</p>
                          <h3 className="mt-2 text-lg font-display font-medium text-brand-primary">{order.productName}</h3>
                          <p className="mt-1 text-sm text-slate-500">{new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                          <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Status</p><p className="mt-2 text-sm font-medium text-brand-primary">{order.status}</p></div>
                          <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Total</p><p className="mt-2 text-sm font-medium text-brand-primary">{currencyFormatter.format(order.totalAmount)}</p></div>
                          <div className="rounded-xl bg-slate-50 px-4 py-3 col-span-2 sm:col-span-1"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Options</p><p className="mt-2 text-sm font-medium text-brand-primary">{order.lensOptionTypes.length} lens option{order.lensOptionTypes.length !== 1 ? "s" : ""}</p></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="flex flex-col gap-6">
            <SectionCard eyebrow="Quick Actions" title="Account Controls" description="Use the most common account actions without leaving the current workspace." className="xl:sticky xl:top-28">
              <div className="flex flex-col gap-3">
                {[
                  { icon: UserRound, label: "Profile Details", meta: "Identity" },
                  { icon: CreditCard, label: "Billing & Checkout", meta: "Orders", to: "/checkout" },
                  { icon: CalendarDays, label: "Appointments & Timeline", meta: "Schedule" },
                  { icon: MapPin, label: "Saved Addresses", meta: "Delivery" },
                ].map((item) => {
                  const content = (
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left transition-colors hover:bg-slate-50">
                      <span className="flex items-center gap-3 text-sm text-brand-primary"><item.icon className="h-4 w-4" strokeWidth={1.5} />{item.label}</span>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{item.meta}</span>
                    </div>
                  );
                  return item.to ? <Link key={item.label} to={item.to}>{content}</Link> : <div key={item.label}>{content}</div>;
                })}
              </div>
              <div className="mt-5 rounded-2xl bg-brand-primary px-4 py-4 text-white">
                <div className="flex items-center gap-2 text-brand-cyan"><Sparkles className="h-4 w-4" /><span className="text-[10px] uppercase tracking-[0.2em] font-semibold">Recommendation</span></div>
                <p className="mt-3 text-sm leading-6 text-white/80">Refresh your prescription profile before placing a new optical commission to keep checkout aligned with your latest measurements.</p>
              </div>
            </SectionCard>
            <SectionCard eyebrow="Compliance" title="Security & Privacy" description="Core safeguards visible to the client account.">
              <div className="flex flex-col gap-3 text-sm text-slate-600">
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4"><CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-cyan" /><span>Authenticated session is active and tied to your verified email identity.</span></div>
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4"><ShieldCheck className="mt-0.5 h-4 w-4 text-brand-cyan" /><span>Prescription and order data stay within the secure Klarheit account workspace.</span></div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
