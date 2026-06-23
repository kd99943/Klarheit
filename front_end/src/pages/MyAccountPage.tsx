import { CalendarDays, CheckCircle2, CreditCard, MapPin, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import { useOrders } from "../hooks/useOrders";
import { formatPrice, formatDate } from "../lib/utils";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { Button } from "../components/ui/Button";

export function MyAccountPage() {
  const { t } = useTranslation("account");
  const { user } = useAuth();
  const { orders, isLoading: isLoadingOrders, error: ordersError } = useOrders();

  return (
    <div className="flex-1 w-full bg-surface-offwhite px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        <PageIntro eyebrow={t("eyebrow")} title={t("title")} description={t("description")} actions={<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm min-w-44"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("profileStatus")}</p><p className="mt-2 flex items-center gap-2 text-lg font-display font-medium text-brand-primary"><ShieldCheck className="h-5 w-5 text-brand-cyan" />{t("verified")}</p></div>} />
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-8">
            <SectionCard eyebrow={t("identity.eyebrow")} title={t("identity.title")} description={t("identity.description")}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-sm font-bold uppercase tracking-[0.2em] text-white">{user ? `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`.toUpperCase() : "KA"}</div>
                    <div><p className="text-xl font-display font-medium text-brand-primary">{user ? `${user.firstName} ${user.lastName}` : t("identity.defaultName")}</p><p className="text-sm text-slate-500">{user?.email ?? t("identity.defaultEmail")}</p></div>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white px-4 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("identity.memberSince")}</p><p className="mt-2 text-sm font-medium text-brand-primary">{t("identity.memberSinceValue")}</p></div>
                    <div className="rounded-xl bg-white px-4 py-4"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("identity.accountTier")}</p><p className="mt-2 text-sm font-medium text-brand-primary">{t("identity.accountTierValue")}</p></div>
                  </div>
                </div>
                <div className="rounded-2xl bg-brand-primary p-5 text-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/55">{t("secureAccess.title")}</p>
                  <p className="mt-3 text-lg font-display font-medium">{t("secureAccess.healthStable")}</p>
                  <p className="mt-2 text-sm text-white/70 leading-6">{t("secureAccess.profileAligned")}</p>
                  <div className="mt-5 rounded-2xl bg-white/8 px-4 py-4"><p className="text-[10px] uppercase tracking-[0.2em] text-brand-cyan font-semibold">{t("secureAccess.session")}</p><p className="mt-2 text-sm">{t("secureAccess.sessionValue")}</p></div>
                </div>
              </div>
            </SectionCard>

            <SectionCard eyebrow={t("orders.eyebrow")} title={t("orders.title")} description={t("orders.description")}>
              {isLoadingOrders ? (
                <p className="text-sm text-slate-500">{t("orders.loading")}</p>
              ) : ordersError ? (
                <p className="text-sm text-red-500">{ordersError}</p>
              ) : orders.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
                  <p className="text-sm text-slate-500">{t("orders.noOrders")}</p>
                  <Link to="/collections" className="mt-3 inline-block"><Button variant="outline-light" className="text-xs">{t("orders.browseCollections")}</Button></Link>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {orders.map((order) => (
                    <div key={order.orderNumber} className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.3)]">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{order.orderNumber}</p>
                          <h3 className="mt-2 text-lg font-display font-medium text-brand-primary">{order.productName}</h3>
                          <p className="mt-1 text-sm text-slate-500">{formatDate(order.createdAt)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                          <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("orders.status")}</p><p className="mt-2 text-sm font-medium text-brand-primary">{order.status}</p></div>
                          <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("orders.total")}</p><p className="mt-2 text-sm font-medium text-brand-primary">{formatPrice(order.totalAmount)}</p></div>
                          <div className="rounded-xl bg-slate-50 px-4 py-3 col-span-2 sm:col-span-1"><p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("orders.options")}</p><p className="mt-2 text-sm font-medium text-brand-primary">{t("orders.lensOptionCount", { count: order.lensOptionTypes.length })}</p></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="flex flex-col gap-6">
            <SectionCard eyebrow={t("quickActions.eyebrow")} title={t("quickActions.title")} description={t("quickActions.description")} className="xl:sticky xl:top-28">
              <div className="flex flex-col gap-3">
                {[
                  { icon: UserRound, label: t("quickActions.profileDetails"), meta: t("quickActions.profileDetailsMeta"), to: "/profile-details" },
                  { icon: CreditCard, label: t("quickActions.billingCheckout"), meta: t("quickActions.billingCheckoutMeta"), to: "/checkout" },
                  { icon: CalendarDays, label: t("quickActions.appointments"), meta: t("quickActions.appointmentsMeta") },
                  { icon: MapPin, label: t("quickActions.savedAddresses"), meta: t("quickActions.savedAddressesMeta") },
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
                <div className="flex items-center gap-2 text-brand-cyan"><Sparkles className="h-4 w-4" /><span className="text-[10px] uppercase tracking-[0.2em] font-semibold">{t("quickActions.recommendation")}</span></div>
                <p className="mt-3 text-sm leading-6 text-white/80">{t("quickActions.recommendationText")}</p>
              </div>
            </SectionCard>
            <SectionCard eyebrow={t("compliance.eyebrow")} title={t("compliance.title")} description={t("compliance.description")}>
              <div className="flex flex-col gap-3 text-sm text-slate-600">
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4"><CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-cyan" /><span>{t("compliance.sessionBullet")}</span></div>
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4"><ShieldCheck className="mt-0.5 h-4 w-4 text-brand-cyan" /><span>{t("compliance.dataBullet")}</span></div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
