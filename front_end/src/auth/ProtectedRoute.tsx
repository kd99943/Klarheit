import { type ReactElement, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute({ children, message }: { children: ReactElement; message: string }) {
  const location = useLocation();
  const { isAuthenticated, isAuthReady, requireAuth } = useAuth();
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
