import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  loginUser,
  logoutUser,
  registerUser,
  fetchCurrentUser,
  markSessionActive,
  setStoredAuthToken,
  logoutStoredAuthToken,
  getStoredAuthToken,
  type AuthResponse,
  type LoginRequest,
  type RegisterRequest,
  type UserProfile,
} from "../services/api";
import { setUserContext, track } from "../services/analytics";
import {
  ACTIVE_ACCOUNT_OWNER_KEY,
  getStoredAccountOwner,
  normalizeOwnerKey,
  purgeAllSensitiveBrowserData,
  setStoredAccountOwner,
  syncAccountIdentityOrPurge,
} from "../lib/privacy";

type AuthMode = "signin" | "register";

type PendingNavigation = {
  path: string;
  state?: unknown;
};

type AuthContextValue = {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  isAuthModalOpen: boolean;
  authMode: AuthMode;
  authError: string | null;
  authMessage: string | null;
  isSubmittingAuth: boolean;
  openAuthModal: (options?: {
    mode?: AuthMode;
    message?: string;
    pendingNavigation?: PendingNavigation;
  }) => void;
  closeAuthModal: () => void;
  setAuthMode: (mode: AuthMode) => void;
  requireAuth: (pendingNavigation?: PendingNavigation, message?: string) => boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PROTECTED_EXACT_PATHS = new Set([
  "/checkout",
  "/config-lab",
  "/my-account",
  "/my-orders",
  "/profile-details",
  "/addresses",
  "/appointments",
  "/order-confirmation",
  "/admin",
]);

function isProtectedRoutePath(pathname: string): boolean {
  return (
    PROTECTED_EXACT_PATHS.has(pathname) ||
    pathname.startsWith("/order/") ||
    pathname.startsWith("/admin/")
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(getStoredAuthToken());
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const isSigningOutRef = useRef(false);

  useEffect(() => {
    if (!isProtectedRoutePath(location.pathname)) {
      isSigningOutRef.current = false;
    }
  }, [location.pathname]);

  useEffect(() => {
    let isCancelled = false;

    async function loadCurrentUser() {
      try {
        const currentUser = await fetchCurrentUser({ suppressSessionExpired: true });
        if (!isCancelled) {
          markSessionActive(true);
          syncAccountIdentityOrPurge(normalizeOwnerKey(currentUser));
          setUser(currentUser);
          setUserContext(String(currentUser.id));
        }
      } catch {
        if (!isCancelled) {
          const hadPreviousIdentity = Boolean(getStoredAuthToken() || getStoredAccountOwner());
          markSessionActive(false);
          setUser(null);
          // Only purge local state & cart when an existing authenticated session expired;
          // a fresh guest receiving 401 on bootstrap keeps their local guest cart intact.
          if (getStoredAuthToken()) {
            logoutStoredAuthToken();
          }
          if (hadPreviousIdentity) {
            purgeAllSensitiveBrowserData({
              clearCart: true,
              dispatchEventName: "klarheit:session-expired",
            });
            setStoredAccountOwner(null);
          }
          setToken(null);
        }
      } finally {
        if (!isCancelled) {
          setIsAuthReady(true);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      isCancelled = true;
    };
  }, []);

  // P0-09: React immediately to 401 session expiration or cross-tab logout / account switching
  useEffect(() => {
    function clearSessionState() {
      markSessionActive(false);
      purgeAllSensitiveBrowserData({ clearCart: true });
      setStoredAccountOwner(null);
      setToken(null);
      setUserContext();
      setUser(null);
      setPendingNavigation(null);
      if (isProtectedRoutePath(location.pathname)) {
        navigate("/collections", { replace: true });
      }
    }
    function handleSessionExpired() {
      clearSessionState();
    }
    function handleCrossTabStorage(event: StorageEvent) {
      if (
        (event.key === ACTIVE_ACCOUNT_OWNER_KEY && event.oldValue !== event.newValue) ||
        (event.key === "klarheit_auth_token" && event.oldValue && !event.newValue)
      ) {
        if (!event.newValue) {
          clearSessionState();
        } else {
          // Another tab signed into a different account — clear local drafts & reload current user
          purgeAllSensitiveBrowserData({ clearCart: true, dispatchEventName: "klarheit:account-switched" });
          void fetchCurrentUser({ suppressSessionExpired: true })
            .then((u) => {
              markSessionActive(true);
              setUser(u);
              setUserContext(String(u.id));
              if (isProtectedRoutePath(location.pathname)) {
                navigate("/collections", { replace: true });
              }
            })
            .catch(() => clearSessionState());
        }
      }
    }
    window.addEventListener("klarheit:session-expired", handleSessionExpired);
    window.addEventListener("storage", handleCrossTabStorage);
    return () => {
      window.removeEventListener("klarheit:session-expired", handleSessionExpired);
      window.removeEventListener("storage", handleCrossTabStorage);
    };
  }, [location.pathname, navigate]);

  const applyAuthResponse = useCallback((response: AuthResponse) => {
    const switchedAccount = syncAccountIdentityOrPurge(normalizeOwnerKey(response.user));
    markSessionActive(true);
    if (response.token) {
      setStoredAuthToken(response.token);
      setToken(response.token);
    }
    setUser(response.user);
    setIsAuthReady(true);
    setAuthError(null);
    setAuthMessage(null);
    setIsAuthModalOpen(false);
    if (pendingNavigation) {
      if (
        switchedAccount &&
        (pendingNavigation.path === "/checkout" || pendingNavigation.path === "/config-lab")
      ) {
        setPendingNavigation(null);
        navigate("/collections", { replace: true });
        return;
      }
      navigate(pendingNavigation.path, { replace: true, state: pendingNavigation.state });
      setPendingNavigation(null);
      return;
    }

    navigate(location.pathname, { replace: true, state: switchedAccount ? null : location.state });
  }, [location.pathname, location.state, navigate, pendingNavigation]);

  const openAuthModal = useCallback((options?: {
    mode?: AuthMode;
    message?: string;
    pendingNavigation?: PendingNavigation;
  }) => {
    setAuthMode(options?.mode ?? "signin");
    setAuthError(null);
    setAuthMessage(options?.message ?? null);
    setPendingNavigation(options?.pendingNavigation ?? null);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setAuthError(null);
    setAuthMessage(null);
  }, []);

  const requireAuth = useCallback((pending?: PendingNavigation, message?: string) => {
    if (user) {
      return true;
    }
    if (isSigningOutRef.current) {
      return false;
    }

    openAuthModal({
      mode: "signin",
      message: message ?? t("auth.defaultMessage"),
      pendingNavigation: pending,
    });
    return false;
  }, [openAuthModal, t, user]);

  async function login(payload: LoginRequest) {
    setIsSubmittingAuth(true);
    setAuthError(null);
    try {
      const response = await loginUser(payload);
      applyAuthResponse(response);
      setUserContext(String(response.user.id));
      track("auth_signin_succeeded", {});
    } catch (error) {
      const reason = error instanceof Error ? error.message : t("auth.unableToSignIn");
      setAuthError(reason);
      track("auth_signin_failed", { reason_code: "signin_error" });
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function register(payload: RegisterRequest) {
    setIsSubmittingAuth(true);
    setAuthError(null);
    try {
      const response = await registerUser(payload);
      applyAuthResponse(response);
      setUserContext(String(response.user.id));
      track("auth_signup_succeeded", {});
    } catch (error) {
      const reason = error instanceof Error ? error.message : t("auth.unableToCreateAccount");
      setAuthError(reason);
      track("auth_signup_failed", { reason_code: "signup_error" });
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function logout() {
    const leavingProtected = isProtectedRoutePath(location.pathname);
    if (leavingProtected) {
      isSigningOutRef.current = true;
    }
    try {
      await logoutUser();
    } catch (error) {
      console.error("Logout failed on backend", error);
    }
    logoutStoredAuthToken();
    markSessionActive(false);
    // P0-09: Clear all user-sensitive local & session drafts (prescriptions, try-on photos,
    // checkout drafts, idempotency keys, and account ownership marker) on shared devices.
    purgeAllSensitiveBrowserData({
      clearCart: true,
      dispatchEventName: "klarheit:logout",
    });
    setStoredAccountOwner(null);
    setToken(null);
    setUserContext();
    setUser(null);
    setIsAuthReady(true);
    setPendingNavigation(null);
    setIsAuthModalOpen(false);
    if (leavingProtected) {
      navigate("/collections", { replace: true });
    }
  }

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
    } catch {
      // silent — user may have logged out
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    isAuthenticated: Boolean(user),
    isAuthReady,
    isAuthModalOpen,
    authMode,
    authError,
    authMessage,
    isSubmittingAuth,
    openAuthModal,
    closeAuthModal,
    setAuthMode,
    requireAuth,
    login,
    register,
    logout,
    refreshUser,
  }), [
    user,
    token,
    isAuthReady,
    isAuthModalOpen,
    authMode,
    authError,
    authMessage,
    isSubmittingAuth,
    openAuthModal,
    closeAuthModal,
    requireAuth,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
