import { type ReactElement, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { isStaffRole } from "../services/api";
import { Button } from "../components/ui/Button";

export function ProtectedRoute({ children, message, adminOnly }: { children: ReactElement; message: string; adminOnly?: boolean }) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const { isAuthenticated, isAuthReady, requireAuth, user } = useAuth();
  const attemptedPathRef = useRef<string | null>(null);
  const nextPath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (isAuthReady && !isAuthenticated && attemptedPathRef.current !== nextPath) {
      attemptedPathRef.current = nextPath;
      requireAuth(
        { path: nextPath, state: location.state },
        message
      );
    }
    if (isAuthenticated) {
      attemptedPathRef.current = null;
    }
  }, [isAuthenticated, isAuthReady, location.state, message, nextPath, requireAuth]);

  if (!isAuthReady) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 py-24">
        <div className="text-sm uppercase tracking-[0.2em] text-slate-400">
          {t("protected.restoringSession")}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 py-24">
        <div className="max-w-xl w-full border border-slate-200 bg-white rounded-2xl p-10 text-center shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-4">
            {t("protected.accountRequired")}
          </p>
          <h1 className="text-3xl font-display font-light text-brand-primary mb-4">
            {t("protected.signInToContinue")}
          </h1>
          <p className="text-slate-500 font-light leading-relaxed">
            {message}
          </p>
          <Button
            type="button"
            className="mt-6"
            onClick={() => { requireAuth({ path: nextPath, state: location.state }, message); }}
          >
            {t("auth.signIn")}
          </Button>
        </div>
      </div>
    );
  }

  if (adminOnly && !isStaffRole(user?.role)) {
    return (
      <div className="flex-1 flex items-center justify-center px-5 py-24">
        <div className="max-w-xl w-full border border-red-200 bg-red-50/10 rounded-[32px] p-10 text-center shadow-xl backdrop-blur-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 font-bold text-2xl">
            !
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-red-500 font-semibold mb-4">
            {t("protected.accessDenied")}
          </p>
          <h1 className="text-3xl font-display font-light text-brand-primary mb-4">
            {t("protected.adminRequired")}
          </h1>
          <p className="text-slate-500 font-light leading-relaxed mb-6">
            {t("protected.adminRequiredDesc")}
          </p>
        </div>
      </div>
    );
  }

  return children;
}
