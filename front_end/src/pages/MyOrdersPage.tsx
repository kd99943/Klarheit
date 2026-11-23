import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "../hooks/useCart";
import { useOrders } from "../hooks/useOrders";
import { formatPrice, formatDate } from "../lib/utils";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { Button } from "../components/ui/Button";
import { track } from "../services/analytics";

export function MyOrdersPage() {
  const { t } = useTranslation("account");
  const { t: tOrder } = useTranslation("order");
  const [searchParams] = useSearchParams();
  const { completeOrderCartCleanup } = useCart();
  const { orders, isLoading: isLoadingOrders, error: ordersError } = useOrders();

  const returnedOrderNumber = searchParams.get("out_trade_no") || searchParams.get("orderNumber");

  useEffect(() => {
    track("orders_list_viewed", {});
  }, []);

  useEffect(() => {
    for (const order of orders) {
      if (order.status === "PAID" || order.status === "SHIPPED" || order.status === "DELIVERED") {
        completeOrderCartCleanup(order.orderNumber);
      }
    }
  }, [orders, completeOrderCartCleanup]);

  return (
    <div className="flex-1 w-full bg-surface-offwhite px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        <Link
          to="/my-account"
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 hover:text-brand-primary transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t("ordersPage.backToAccount")}
        </Link>

        <PageIntro
          eyebrow={t("ordersPage.eyebrow")}
          title={t("ordersPage.title")}
          description={t("ordersPage.description")}
          actions={
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm min-w-44">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
                {t("ordersPage.orderCount")}
              </p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-display font-medium text-brand-primary">
                <ShoppingBag className="h-5 w-5 text-brand-cyan" strokeWidth={1.5} />
                {isLoadingOrders ? "—" : orders.length}
              </p>
            </div>
          }
        />

        {returnedOrderNumber && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-sky-900 font-medium">
              {t("orders.returnBanner", { orderNumber: returnedOrderNumber })}
            </p>
            <Link to={`/order/${returnedOrderNumber}`} className="shrink-0">
              <Button size="sm">{t("orders.openReturnedOrder")}</Button>
            </Link>
          </div>
        )}

        <SectionCard
          eyebrow={t("orders.eyebrow")}
          title={t("orders.title")}
          description={t("orders.description")}
        >
          {isLoadingOrders ? (
            <p className="text-sm text-slate-500">{t("orders.loading")}</p>
          ) : ordersError ? (
            <p className="text-sm text-red-500">{ordersError}</p>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
              <p className="text-sm text-slate-500">{t("orders.noOrders")}</p>
              <Link to="/collections" className="mt-3 inline-block">
                <Button variant="outline-light" className="text-xs">
                  {t("orders.browseCollections")}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {orders.map((order) => (
                <div
                  key={order.orderNumber}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.3)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <Link
                      to={`/order/${order.orderNumber}`}
                      className="group hover:opacity-85 transition-opacity"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 group-hover:text-brand-cyan transition-colors">
                          {order.orderNumber}
                        </p>
                        {order.fulfillmentStatus &&
                          (order.status === "PAID" ||
                            order.status === "SHIPPED" ||
                            order.status === "DELIVERED") && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-brand-primary">
                              {tOrder("fulfillment." + order.fulfillmentStatus, {
                                defaultValue: order.fulfillmentStatus,
                              })}
                            </span>
                          )}
                      </div>
                      <h3 className="mt-2 text-lg font-display font-medium text-brand-primary group-hover:text-brand-cyan transition-colors">
                        {order.productName}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">{formatDate(order.createdAt)}</p>
                    </Link>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                      <div className="rounded-xl bg-slate-50 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
                          {t("orders.status")}
                        </p>
                        <p className="mt-2 text-sm font-medium text-brand-primary">
                          {t("orders.statusLabels." + order.status.toUpperCase(), {
                            defaultValue: order.status,
                          })}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
                          {t("orders.total")}
                        </p>
                        <p className="mt-2 text-sm font-medium text-brand-primary">
                          {formatPrice(order.totalAmount)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-4 py-3 col-span-2 sm:col-span-1">
                        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
                          {t("orders.options")}
                        </p>
                        <p className="mt-2 text-sm font-medium text-brand-primary">
                          {t("orders.lensOptionCount", { count: order.lensOptionTypes.length })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
