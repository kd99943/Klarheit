import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Box, CreditCard, DollarSign, Package, ShoppingBag, Truck, Users, X, Loader2, Plus, Edit, Trash2 } from "lucide-react";
import {
  adminFetchOrders,
  adminFetchStats,
  adminShipOrder,
  adminCancelOrder,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminFetchUsers,
  fetchProductsFiltered,
  type AdminStats,
  type OrderSummary,
  type Product,
  type UserProfile
} from "../services/api";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { formatPrice, formatDate } from "../lib/utils";

export function AdminDashboard() {
  const { t, i18n } = useTranslation("admin");
  const isZh = i18n.language === "zh";

  // Tab State
  const [activeTab, setActiveTab] = useState<"orders" | "products" | "users">("orders");

  // Orders State
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Ship Dialog State
  const [shippingOrderNum, setShippingOrderNum] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isSubmittingShip, setIsSubmittingShip] = useState(false);
  const [shipError, setShipError] = useState<string | null>(null);

  // Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Product Form State
  const [prodNameEn, setProdNameEn] = useState("");
  const [prodNameZh, setProdNameZh] = useState("");
  const [prodMaterialEn, setProdMaterialEn] = useState("");
  const [prodMaterialZh, setProdMaterialZh] = useState("");
  const [prodBasePrice, setProdBasePrice] = useState<number>(0);
  const [prodImageUrl, setProdImageUrl] = useState("");
  const [prodShape, setProdShape] = useState("ROUND");
  const [prodSpecsSize, setProdSpecsSize] = useState("52-18-145");
  const [prodDetailImages, setProdDetailImages] = useState("");
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);

  // Users State
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(0);
  const [usersTotalPages, setUsersTotalPages] = useState(1);

  async function loadDashboardData() {
    setIsLoading(true);
    setError(null);
    try {
      const [ordersData, statsData] = await Promise.all([
        adminFetchOrders(page, 20),
        adminFetchStats(),
      ]);
      setOrders(ordersData.content);
      setTotalPages(ordersData.totalPages);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadProducts() {
    setIsProductsLoading(true);
    setError(null);
    try {
      const data = await fetchProductsFiltered({});
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products.");
    } finally {
      setIsProductsLoading(false);
    }
  }

  async function loadUsers() {
    setIsUsersLoading(true);
    setError(null);
    try {
      const usersData = await adminFetchUsers(usersPage, 20);
      setUsersList(usersData.content);
      setUsersTotalPages(usersData.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setIsUsersLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "orders") {
      void loadDashboardData();
    } else if (activeTab === "products") {
      void loadProducts();
    } else if (activeTab === "users") {
      void loadUsers();
    }
  }, [activeTab, page, usersPage]);

  async function handleCancel(orderNumber: string) {
    if (confirm(t("cancelOrderConfirm", { orderNumber }))) {
      try {
        await adminCancelOrder(orderNumber);
        void loadDashboardData();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to cancel order.");
      }
    }
  }

  function handleOpenShip(orderNumber: string) {
    setShippingOrderNum(orderNumber);
    setCarrier(t("defaultCarrier"));
    setTrackingNumber("");
    setShipError(null);
  }

  async function handleShipSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shippingOrderNum) return;
    if (!carrier.trim() || !trackingNumber.trim()) {
      setShipError(t("shipErrorRequired"));
      return;
    }

    setIsSubmittingShip(true);
    setShipError(null);
    try {
      await adminShipOrder(shippingOrderNum, carrier.trim(), trackingNumber.trim());
      setShippingOrderNum(null);
      void loadDashboardData();
    } catch (err) {
      setShipError(err instanceof Error ? err.message : "Failed to ship order.");
    } finally {
      setIsSubmittingShip(false);
    }
  }

  // Product Actions
  function handleOpenCreateProduct() {
    setEditingProduct(null);
    setProdNameEn("");
    setProdNameZh("");
    setProdMaterialEn("");
    setProdMaterialZh("");
    setProdBasePrice(0);
    setProdImageUrl("");
    setProdShape("ROUND");
    setProdSpecsSize("52-18-145");
    setProdDetailImages("");
    setProdError(null);
    setIsProductModalOpen(true);
  }

  function handleOpenEditProduct(p: Product) {
    setEditingProduct(p);
    setProdNameEn(p.nameEn);
    setProdNameZh(p.nameZh);
    setProdMaterialEn(p.materialEn);
    setProdMaterialZh(p.materialZh);
    setProdBasePrice(p.basePrice);
    setProdImageUrl(p.imageUrl);
    setProdShape(p.shape || "ROUND");
    setProdSpecsSize(p.specsSize || "52-18-145");
    setProdDetailImages(p.detailImages || "");
    setProdError(null);
    setIsProductModalOpen(true);
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!prodNameEn.trim() || !prodNameZh.trim() || !prodMaterialEn.trim() || !prodMaterialZh.trim() || !prodImageUrl.trim()) {
      setProdError(t("productErrorRequiredFields"));
      return;
    }
    if (prodBasePrice <= 0) {
      setProdError(t("productErrorPricePositive"));
      return;
    }

    setIsSavingProduct(true);
    setProdError(null);
    try {
      const payload = {
        nameEn: prodNameEn.trim(),
        nameZh: prodNameZh.trim(),
        materialEn: prodMaterialEn.trim(),
        materialZh: prodMaterialZh.trim(),
        basePrice: prodBasePrice,
        imageUrl: prodImageUrl.trim(),
        shape: prodShape,
        specsSize: prodSpecsSize,
        detailImages: prodDetailImages.trim() || null,
      };

      if (editingProduct) {
        await adminUpdateProduct(editingProduct.id, payload);
      } else {
        await adminCreateProduct(payload);
      }
      setIsProductModalOpen(false);
      void loadProducts();
    } catch (err) {
      setProdError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handleDeleteProduct(id: number) {
    if (confirm(t("deleteProductConfirm"))) {
      try {
        await adminDeleteProduct(id);
        void loadProducts();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to delete product.");
      }
    }
  }

  return (
    <div className="flex-1 w-full bg-surface-offwhite px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        <PageIntro
          eyebrow={t("pageEyebrow")}
          title={t("pageTitle")}
          description={t("pageDescription")}
        />

        {error && (
          <SectionCard className="border-red-200 bg-red-50/70" title={t("errorTitle")}>
            <p className="text-sm text-red-700">{error}</p>
          </SectionCard>
        )}

        {/* Stats Summary Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: DollarSign, label: t("totalRevenue"), value: formatPrice(stats.totalSales), color: "text-brand-cyan bg-brand-cyan/10" },
              { icon: ShoppingBag, label: t("totalOrders"), value: stats.totalOrders.toString(), color: "text-amber-500 bg-amber-500/10" },
              { icon: Users, label: t("totalCustomers"), value: stats.totalUsers.toString(), color: "text-indigo-500 bg-indigo-500/10" },
              { icon: CreditCard, label: t("averageTicket"), value: formatPrice(stats.averageOrderValue), color: "text-emerald-500 bg-emerald-500/10" },
            ].map((card, idx) => (
              <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    {card.label}
                  </span>
                  <span className="text-xl font-display font-semibold text-brand-primary mt-1 block">
                    {card.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 gap-6 mt-4">
          <button
            onClick={() => setActiveTab("orders")}
            className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "orders" ? "border-brand-cyan text-brand-cyan" : "border-transparent text-slate-400 hover:text-brand-primary"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            {t("ordersFulfillmentsTab")}
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "products" ? "border-brand-cyan text-brand-cyan" : "border-transparent text-slate-400 hover:text-brand-primary"
            }`}
          >
            <Package className="w-4 h-4" />
            {t("productCatalogTab")}
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "users" ? "border-brand-cyan text-brand-cyan" : "border-transparent text-slate-400 hover:text-brand-primary"
            }`}
          >
            <Users className="w-4 h-4" />
            {t("userDirectoryTab")}
          </button>
        </div>

        {/* Tab 1: Orders Fulfillment */}
        {activeTab === "orders" && (
          <SectionCard
            title={t("ordersSectionTitle")}
            eyebrow={t("ordersSectionEyebrow")}
            description={t("ordersSectionDescription")}
          >
            {isLoading ? (
              <p className="text-center text-sm text-slate-500 py-10">{t("loading")}</p>
            ) : orders.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">
                {t("noOrders")}
              </p>
            ) : (
              <div className="w-full overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="px-6 py-4">{t("orderNumberCol")}</th>
                      <th className="px-6 py-4">{t("productCol")}</th>
                      <th className="px-6 py-4">{t("amountCol")}</th>
                      <th className="px-6 py-4">{t("createdAtCol")}</th>
                      <th className="px-6 py-4">{t("statusCol")}</th>
                      <th className="px-6 py-4 text-right">{t("actionsCol")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-brand-primary">
                    {orders.map((order) => {
                      const statusColors: Record<string, string> = {
                        CREATED: "text-slate-400 bg-slate-100",
                        PENDING_PAYMENT: "text-amber-600 bg-amber-50",
                        PAID: "text-brand-cyan bg-brand-cyan/15",
                        SHIPPED: "text-indigo-600 bg-indigo-50",
                        DELIVERED: "text-emerald-600 bg-emerald-50",
                        CANCELLED: "text-red-500 bg-red-50",
                      };

                      const statusText: Record<string, string> = {
                        CREATED: t("statusCreated"),
                        PENDING_PAYMENT: t("statusPendingPayment"),
                        PAID: t("statusPaid"),
                        SHIPPED: t("statusShipped"),
                        DELIVERED: t("statusDelivered"),
                        CANCELLED: t("statusCancelled"),
                      };

                      return (
                        <tr key={order.orderNumber} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-mono font-medium">
                            <Link to={`/order/${order.orderNumber}`} className="hover:underline text-brand-cyan">
                              {order.orderNumber}
                            </Link>
                          </td>
                          <td className="px-6 py-4 font-medium">{order.productName}</td>
                          <td className="px-6 py-4 font-semibold">{formatPrice(order.totalAmount)}</td>
                          <td className="px-6 py-4 text-xs text-slate-500">{formatDate(order.createdAt)}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[9px] uppercase tracking-wider font-semibold ${
                              statusColors[order.status.toUpperCase()] || "text-slate-500 bg-slate-100"
                            }`}>
                              {statusText[order.status.toUpperCase()] || order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right flex justify-end gap-2">
                            {order.status.toUpperCase() === "PAID" && (
                              <button
                                onClick={() => handleOpenShip(order.orderNumber)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-brand-cyan text-brand-cyan hover:bg-brand-cyan hover:text-white rounded-xl text-xs font-semibold transition-all"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                {t("shipAction")}
                              </button>
                            )}

                            {["PAID", "PENDING_PAYMENT", "CREATED"].includes(order.status.toUpperCase()) && (
                              <button
                                onClick={() => handleCancel(order.orderNumber)}
                                className="px-3 py-1.5 border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl text-xs font-semibold transition-all"
                              >
                                {t("cancelAction")}
                              </button>
                            )}

                            <Link
                              to={`/order/${order.orderNumber}`}
                              className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-brand-primary rounded-xl text-xs font-semibold transition-all inline-block"
                            >
                              {t("detailsAction")}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <span className="text-xs text-slate-400">
                      {t("pageIndicator", { current: page + 1, total: totalPages })}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        {t("previousPage")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        {t("nextPage")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* Tab 2: Products Catalog Management */}
        {activeTab === "products" && (
          <SectionCard
            title={t("productsSectionTitle")}
            eyebrow={t("productsSectionEyebrow")}
            description={t("productsSectionDescription")}
            actions={
              <button
                onClick={handleOpenCreateProduct}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white hover:bg-brand-primary/90 rounded-2xl text-xs font-bold transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                {t("addFrameProduct")}
              </button>
            }
          >
            {isProductsLoading ? (
              <p className="text-center text-sm text-slate-500 py-10">{t("loading")}</p>
            ) : products.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">
                {t("noProducts")}
              </p>
            ) : (
              <div className="w-full overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="px-6 py-4">{t("imageCol")}</th>
                      <th className="px-6 py-4">{t("productNameCol")}</th>
                      <th className="px-6 py-4">{t("materialCol")}</th>
                      <th className="px-6 py-4">{t("shapeCol")}</th>
                      <th className="px-6 py-4">{t("sizeSpecCol")}</th>
                      <th className="px-6 py-4">{t("basePriceCol")}</th>
                      <th className="px-6 py-4 text-right">{t("actionsCol")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-brand-primary">
                    {products.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-10 h-10 object-contain rounded border border-slate-100 bg-slate-50/50"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?q=80&w=120";
                            }}
                            loading="lazy"
                          />
                        </td>
                        <td className="px-6 py-4 font-medium">
                          <div className="font-semibold">{isZh ? prod.nameZh : prod.nameEn}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{isZh ? prod.nameEn : prod.nameZh}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div>{isZh ? prod.materialZh : prod.materialEn}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{isZh ? prod.materialEn : prod.materialZh}</div>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono">{prod.shape}</td>
                        <td className="px-6 py-4 text-xs font-mono">{prod.specsSize}</td>
                        <td className="px-6 py-4 font-semibold">{formatPrice(prod.basePrice)}</td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2 items-center">
                          <button
                            onClick={() => handleOpenEditProduct(prod)}
                            className="p-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-brand-primary rounded-xl transition-all"
                            title={t("editAction")}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(prod.id)}
                            className="p-1.5 border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                            title={t("deleteAction")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {/* Tab 3: Users Directory */}
        {activeTab === "users" && (
          <SectionCard
            title={t("usersSectionTitle")}
            eyebrow={t("usersSectionEyebrow")}
            description={t("usersSectionDescription")}
          >
            {isUsersLoading ? (
              <p className="text-center text-sm text-slate-500 py-10">{t("loading")}</p>
            ) : usersList.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">
                {t("noUsers")}
              </p>
            ) : (
              <div className="w-full overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">{t("fullNameCol")}</th>
                      <th className="px-6 py-4">{t("emailCol")}</th>
                      <th className="px-6 py-4">{t("phoneCol")}</th>
                      <th className="px-6 py-4">{t("roleCol")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-brand-primary">
                    {usersList.map((userItem) => (
                      <tr key={userItem.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-semibold text-slate-400">{userItem.id}</td>
                        <td className="px-6 py-4 font-medium">{`${userItem.firstName} ${userItem.lastName}`}</td>
                        <td className="px-6 py-4">{userItem.email}</td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {userItem.phone ? (
                            <span className="flex items-center gap-1.5">
                              {userItem.phone}
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                userItem.phoneVerified ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"
                              }`}>
                                {userItem.phoneVerified ? t("verified") : t("unverified")}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400">{t("phoneNotBound")}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-semibold ${
                            userItem.role === "ADMIN" ? "text-red-700 bg-red-50" : "text-slate-500 bg-slate-100"
                          }`}>
                            {userItem.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Users Pagination controls */}
                {usersTotalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <span className="text-xs text-slate-400">
                      {t("pageIndicator", { current: usersPage + 1, total: usersTotalPages })}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={usersPage === 0}
                        onClick={() => setUsersPage((p) => p - 1)}
                      >
                        {t("previousPage")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline-light"
                        className="text-xs py-1 px-3"
                        disabled={usersPage >= usersTotalPages - 1}
                        onClick={() => setUsersPage((p) => p + 1)}
                      >
                        {t("nextPage")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* Product Modal Overlay (Add & Edit) */}
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-primary/40 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
              <div className="bg-brand-primary px-6 py-5 text-white flex justify-between items-center">
                <h3 className="font-display font-medium text-base tracking-wide">
                  {editingProduct
                    ? t("editFrameTitle", { name: editingProduct.name })
                    : t("addFrameTitle")}
                </h3>
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
                {prodError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl p-3">{prodError}</p>}

                {/* Two-column names */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("englishNameLabel")}
                    </label>
                    <input
                      type="text"
                      value={prodNameEn}
                      onChange={(e) => setProdNameEn(e.target.value)}
                      required
                      placeholder="e.g. AERO X2"
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("chineseNameLabel")}
                    </label>
                    <input
                      type="text"
                      value={prodNameZh}
                      onChange={(e) => setProdNameZh(e.target.value)}
                      required
                      placeholder="例如：御风系列 X2"
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Two-column materials */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("englishMaterialLabel")}
                    </label>
                    <input
                      type="text"
                      value={prodMaterialEn}
                      onChange={(e) => setProdMaterialEn(e.target.value)}
                      required
                      placeholder="e.g. Beta Titanium"
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("chineseMaterialLabel")}
                    </label>
                    <input
                      type="text"
                      value={prodMaterialZh}
                      onChange={(e) => setProdMaterialZh(e.target.value)}
                      required
                      placeholder="例如：钛合金/极轻板材"
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Price, shape, specs */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("basePriceLabel")}
                    </label>
                    <input
                      type="number"
                      value={prodBasePrice || ""}
                      onChange={(e) => setProdBasePrice(Number(e.target.value))}
                      required
                      min="1"
                      step="0.01"
                      placeholder="e.g. 850"
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("frameShapeLabel")}
                    </label>
                    <select
                      value={prodShape}
                      onChange={(e) => setProdShape(e.target.value)}
                      required
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    >
                      <option value="ROUND">ROUND</option>
                      <option value="SQUARE">SQUARE</option>
                      <option value="RECTANGLE">RECTANGLE</option>
                      <option value="AVIATOR">AVIATOR</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("sizeSpecLabel")}
                    </label>
                    <input
                      type="text"
                      value={prodSpecsSize}
                      onChange={(e) => setProdSpecsSize(e.target.value)}
                      required
                      placeholder="e.g. 52-18-145"
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Image URLs */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {t("primaryImageUrlLabel")}
                  </label>
                  <input
                    type="text"
                    value={prodImageUrl}
                    onChange={(e) => setProdImageUrl(e.target.value)}
                    required
                    placeholder="e.g. /images/aero_x1.png"
                    className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {t("detailImageUrlsLabel")}
                  </label>
                  <textarea
                    value={prodDetailImages}
                    onChange={(e) => setProdDetailImages(e.target.value)}
                    placeholder="e.g. /images/aero_side.png, /images/aero_front.png"
                    rows={2}
                    className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50 resize-none"
                  />
                </div>

                <div className="flex gap-3 justify-end mt-4 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline-light" onClick={() => setIsProductModalOpen(false)}>
                    {t("cancelAction")}
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSavingProduct}>
                    {isSavingProduct ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t("saveChanges")
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Simulated Ship Modal Overlay */}
        {shippingOrderNum && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-primary/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-brand-primary px-6 py-6 text-white flex justify-between items-center">
                <h3 className="font-display font-medium text-lg tracking-wide">
                  {t("shipModalTitle")}
                </h3>
                <button
                  onClick={() => setShippingOrderNum(null)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleShipSubmit} className="p-6 flex flex-col gap-4">
                {shipError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl p-3">{shipError}</p>}

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {t("fulfillingOrderLabel")}
                  </span>
                  <span className="text-sm font-mono font-bold text-brand-primary">{shippingOrderNum}</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {t("carrierLabel")}
                  </label>
                  <input
                    type="text"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    required
                    placeholder={t("carrierPlaceholder")}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {t("trackingNumberLabel")}
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    required
                    placeholder={t("trackingNumberPlaceholder")}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary bg-slate-50/50"
                  />
                </div>

                <div className="flex gap-3 justify-end mt-4 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline-light" onClick={() => setShippingOrderNum(null)}>
                    {t("cancelAction")}
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSubmittingShip}>
                    {isSubmittingShip ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t("confirmShip")
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
