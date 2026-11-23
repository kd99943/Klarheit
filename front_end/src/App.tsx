/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { lazy, Suspense, useEffect } from "react";
import { AuthProvider } from "./auth/AuthProvider";
import { CartProvider } from "./hooks/useCart";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/layout/Layout";
import { normalizeRoutePath, track } from "./services/analytics";
import { clearCatalogNavState, readCatalogNavState } from "./lib/selection";

// Lazy-loaded pages for code-splitting
const LandingPage = lazy(() => import("./pages/LandingPage").then(m => ({ default: m.LandingPage })));
const CollectionsPage = lazy(() => import("./pages/CollectionsPage").then(m => ({ default: m.CollectionsPage })));
const ARVirtualStudio = lazy(() => import("./pages/ARVirtualStudio").then(m => ({ default: m.ARVirtualStudio })));
const ConfigLab = lazy(() => import("./pages/ConfigLab").then(m => ({ default: m.ConfigLab })));
const Checkout = lazy(() => import("./pages/Checkout").then(m => ({ default: m.Checkout })));
const MyAccountPage = lazy(() => import("./pages/MyAccountPage").then(m => ({ default: m.MyAccountPage })));
const MyOrdersPage = lazy(() => import("./pages/MyOrdersPage").then(m => ({ default: m.MyOrdersPage })));
const ProfileDetailsPage = lazy(() => import("./pages/ProfileDetailsPage").then(m => ({ default: m.ProfileDetailsPage })));
const OrderConfirmationPage = lazy(() => import("./pages/OrderConfirmationPage").then(m => ({ default: m.OrderConfirmationPage })));
const ProductDetailsPage = lazy(() => import("./pages/ProductDetailsPage").then(m => ({ default: m.ProductDetailsPage })));
const AddressesPage = lazy(() => import("./pages/AddressesPage").then(m => ({ default: m.AddressesPage })));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage").then(m => ({ default: m.OrderDetailPage })));
const AppointmentsPage = lazy(() => import("./pages/AppointmentsPage").then(m => ({ default: m.AppointmentsPage })));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const CartPage = lazy(() => import("./pages/CartPage").then(m => ({ default: m.CartPage })));

function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    track("page_viewed", {
      path: normalizeRoutePath(location.pathname),
      referrer: document.referrer ? new URL(document.referrer, window.location.origin).origin : "",
    });
  }, [location.pathname]);

  useEffect(() => {
    const isCatalogFlowRoute =
      location.pathname === "/collections" ||
      location.pathname.startsWith("/product/") ||
      location.pathname === "/virtual-studio";

    if (!isCatalogFlowRoute) {
      clearCatalogNavState();
    }

    const shouldKeepCatalogRestore =
      location.pathname === "/collections" && Boolean(readCatalogNavState());

    if (navigationType !== "POP" && !shouldKeepCatalogRestore) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [location.pathname, navigationType]);

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <AuthProvider>
        <CartProvider>
          <Suspense fallback={
            <div className="min-h-screen bg-surface-offwhite flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400">
                {t("common.loading", { defaultValue: "Loading Klarheit..." })}
              </span>
            </div>
          }>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<LandingPage />} />
                <Route path="collections" element={<CollectionsPage />} />
                <Route path="cart" element={<CartPage />} />
                <Route path="virtual-studio" element={<ARVirtualStudio />} />
                <Route
                  path="config-lab"
                  element={
                    <ProtectedRoute message={t("nav.signInMessage")}>
                      <ConfigLab />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="checkout"
                  element={
                    <ProtectedRoute message={t("auth.defaultMessage")}>
                      <Checkout />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="my-account"
                  element={
                    <ProtectedRoute message={t("nav.signInMessage")}>
                      <MyAccountPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="my-orders"
                  element={
                    <ProtectedRoute message={t("nav.signInMessage")}>
                      <MyOrdersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="profile-details"
                  element={
                    <ProtectedRoute message={t("nav.signInMessage")}>
                      <ProfileDetailsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="product/:id" element={<ProductDetailsPage />} />
                <Route
                  path="addresses"
                  element={
                    <ProtectedRoute message={t("nav.signInMessage")}>
                      <AddressesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="order/:orderNumber"
                  element={
                    <ProtectedRoute message={t("nav.signInMessage")}>
                      <OrderDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/orders/:orderNumber"
                  element={
                    <ProtectedRoute message={t("nav.signInMessage")} adminOnly={true}>
                      <OrderDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="appointments"
                  element={
                    <ProtectedRoute message={t("nav.signInMessage")}>
                      <AppointmentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin"
                  element={
                    <ProtectedRoute message={t("nav.signInMessage")} adminOnly={true}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="order-confirmation"
                  element={
                    <ProtectedRoute message={t("auth.defaultMessage")}>
                      <OrderConfirmationPage />
                    </ProtectedRoute>
                  }
                />
              </Route>
            </Routes>
          </Suspense>
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
