import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getStoredAuthToken,
  loginUser,
  logoutStoredAuthToken,
  registerUser,
  setStoredAuthToken,
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
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(getStoredAuthToken());
  const [isAuthReady, setIsAuthReady] = useState(!getStoredAuthToken());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsAuthReady(true);
      return;
    }

    let isCancelled = false;

    async function loadCurrentUser() {
      try {
        const currentUser = await fetchCurrentUser();
        if (!isCancelled) {
          setUser(currentUser);
          setIsAuthReady(true);
        }
      } catch {
        if (!isCancelled) {
          logoutStoredAuthToken();
          setToken(null);
          setUser(null);
          setIsAuthReady(true);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  function applyAuthResponse(response: AuthResponse) {
    setStoredAuthToken(response.token);
    setToken(response.token);
    setUser(response.user);
    setIsAuthReady(true);
    setAuthError(null);
    setIsAuthModalOpen(false);
    if (pendingNavigation) {
      navigate(pendingNavigation.path, { state: pendingNavigation.state });
      setPendingNavigation(null);
      return;
    }

    navigate(location.pathname, { replace: true, state: location.state });
  }

  function openAuthModal(options?: {
    mode?: AuthMode;
    message?: string;
    pendingNavigation?: PendingNavigation;
  }) {
    setAuthMode(options?.mode ?? "signin");
    setAuthError(null);
    setAuthMessage(options?.message ?? null);
    if (options?.pendingNavigation) {
      setPendingNavigation(options.pendingNavigation);
    }
    setIsAuthModalOpen(true);
  }

  function closeAuthModal() {
    setIsAuthModalOpen(false);
    setAuthError(null);
    setAuthMessage(null);
  }

  function requireAuth(pending?: PendingNavigation, message?: string) {
    if (token && user) {
      return true;
    }

    openAuthModal({
      mode: "signin",
      message: message ?? "Sign in to continue your custom order.",
      pendingNavigation: pending,
    });
    return false;
  }

  async function login(payload: LoginRequest) {
    setIsSubmittingAuth(true);
    setAuthError(null);
    try {
      const response = await loginUser(payload);
      applyAuthResponse(response);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to sign in.");
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
      setAuthError(error instanceof Error ? error.message : "Unable to create your account.");
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  function logout() {
    logoutStoredAuthToken();
    setUser(null);
    setToken(null);
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
    isAuthenticated: Boolean(user && token),
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
