import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  loginUser,
  logoutUser,
  registerUser,
  fetchCurrentUser,
  type AuthResponse,
  type LoginRequest,
  type RegisterRequest,
  type UserProfile,
} from "../services/api";

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
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);

  const token = user ? "cookie-authenticated" : null;

  useEffect(() => {
    let isCancelled = false;

    async function loadCurrentUser() {
      try {
        const currentUser = await fetchCurrentUser();
        if (!isCancelled) {
          setUser(currentUser);
        }
      } catch {
        if (!isCancelled) {
          setUser(null);
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

  const applyAuthResponse = useCallback((response: AuthResponse) => {
    setUser(response.user);
    setIsAuthReady(true);
    setAuthError(null);
    setAuthMessage(null);
    setIsAuthModalOpen(false);
    if (pendingNavigation) {
      navigate(pendingNavigation.path, { replace: true, state: pendingNavigation.state });
      setPendingNavigation(null);
      return;
    }

    navigate(location.pathname, { replace: true, state: location.state });
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
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t("auth.unableToSignIn"));
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
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t("auth.unableToCreateAccount"));
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function logout() {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Logout failed on backend", error);
    }
    setUser(null);
    setIsAuthReady(true);
    setPendingNavigation(null);
    setIsAuthModalOpen(false);
    if (location.pathname === "/checkout" || location.pathname === "/config-lab") {
      navigate("/collections");
    }
  }

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
