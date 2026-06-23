/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthProvider } from "./auth/AuthProvider";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/layout/Layout";
import { LandingPage } from "./pages/LandingPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { ARVirtualStudio } from "./pages/ARVirtualStudio";
import { ConfigLab } from "./pages/ConfigLab";
import { Checkout } from "./pages/Checkout";
import { MyAccountPage } from "./pages/MyAccountPage";
import { ProfileDetailsPage } from "./pages/ProfileDetailsPage";
import { OrderConfirmationPage } from "./pages/OrderConfirmationPage";

export default function App() {
  const { t } = useTranslation();
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<LandingPage />} />
              <Route path="collections" element={<CollectionsPage />} />
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
                path="profile-details"
                element={
                  <ProtectedRoute message={t("nav.signInMessage")}>
                    <ProfileDetailsPage />
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
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
