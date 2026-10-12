import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, Clock, Sparkles } from "lucide-react";
import { useOrders } from "../hooks/useOrders";
import { formatDate } from "../lib/utils";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { Button } from "../components/ui/Button";

export function AppointmentsPage() {
  const { t } = useTranslation("account");
  const { orders, isLoading: isLoadingOrders } = useOrders();

  return (
    <div className="flex-1 w-full bg-surface-offwhite px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        <PageIntro
          eyebrow={t("appointments.eyebrow")}
          title={t("appointments.title")}
          description={t("appointments.description")}
        />

        {/* Coming Soon — Appointments booking */}
        <SectionCard
          eyebrow={t("appointments.booking.eyebrow")}
          title={t("appointments.booking.title")}
          description={t("appointments.booking.description")}
        >
          <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/5 border border-brand-cyan/30">
              <CalendarDays className="h-6 w-6 text-brand-cyan" strokeWidth={1.5} />
            </div>
            <div className="max-w-md">
              <p className="text-sm font-medium text-brand-primary">
                {t("appointments.booking.comingSoonTitle")}
              </p>
              <p className="mt-2 text-xs text-slate-500 leading-6">
                {t("appointments.booking.comingSoonBody")}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-brand-cyan font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              {t("appointments.booking.statusBadge")}
            </div>
            <Link to="/collections">
              <Button variant="outline-light" className="text-xs">
                {t("appointments.booking.browseCollections")}
              </Button>
            </Link>
          </div>
        </SectionCard>

        {/* Timeline — recent order activity */}
        <SectionCard
          eyebrow={t("appointments.timeline.eyebrow")}
          title={t("appointments.timeline.title")}
          description={t("appointments.timeline.description")}
        >
          {isLoadingOrders ? (
            <p className="text-sm text-slate-500">{t("orders.loading")}</p>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
              <p className="text-sm text-slate-500">{t("orders.noOrders")}</p>
              <Link to="/collections" className="mt-3 inline-block">
                <Button variant="outline-light" className="text-xs">{t("orders.browseCollections")}</Button>
              </Link>
            </div>
          ) : (
            <ol className="flex flex-col gap-4">
              {orders.map((order, index) => (
                <li key={order.orderNumber} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-[10px] font-bold text-white">
                      {orders.length - index}
                    </div>
                    {index < orders.length - 1 ? (
                      <div className="w-px flex-1 bg-slate-200 my-1" />
                    ) : null}
                  </div>
                  <Link
                    to={`/order/${order.orderNumber}`}
                    className="group flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 transition-colors hover:bg-slate-50 mb-1"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 group-hover:text-brand-cyan transition-colors">
                        {order.orderNumber}
                      </p>
                      <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-brand-primary group-hover:text-brand-cyan transition-colors">
                      {order.productName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("orders.status")}: <span className="font-medium text-brand-primary">{order.status}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
