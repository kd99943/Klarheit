import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute({ children, message }: { children: JSX.Element; message: string }) {
  const location = useLocation();
  const { isAuthenticated, isAuthReady, requireAuth } = useAuth();

  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      requireAuth(
        { path: location.pathname, state: location.state },
        message
      );
    }
  }, [isAuthenticated, isAuthReady, location.pathname, location.state, message, requireAuth]);

  if (!isAuthReady) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 py-24">
        <div className="text-sm uppercase tracking-[0.2em] text-slate-400">
          Restoring secure session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 py-24">
        <div className="max-w-xl w-full border border-slate-200 bg-white rounded-2xl p-10 text-center shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-4">
            Account Required
          </p>
          <h1 className="text-3xl font-display font-light text-brand-primary mb-4">
            Sign in to continue
          </h1>
          <p className="text-slate-500 font-light leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    );
  }

  return children;
}
