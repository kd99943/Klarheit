/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/layout/Layout";
import { LandingPage } from "./pages/LandingPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { ARVirtualStudio } from "./pages/ARVirtualStudio";
import { ConfigLab } from "./pages/ConfigLab";
import { Checkout } from "./pages/Checkout";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<LandingPage />} />
            <Route path="collections" element={<CollectionsPage />} />
            <Route path="virtual-studio" element={<ARVirtualStudio />} />
            <Route
              path="config-lab"
              element={
                <ProtectedRoute message="Create an account to access the Config Lab and save your prescription.">
                  <ConfigLab />
                </ProtectedRoute>
              }
            />
            <Route
              path="checkout"
              element={
                <ProtectedRoute message="Sign in to continue to checkout and finalize your custom order.">
                  <Checkout />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
