import { type FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../auth/AuthProvider";
import { useTranslation } from "react-i18next";
import { ForgotPasswordFlow } from "./ForgotPasswordFlow";
import { track } from "../../services/analytics";

type SignInForm = {
  email: string;
  password: string;
};

type RegisterForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

const EMPTY_SIGN_IN_FORM: SignInForm = {
  email: "",
  password: "",
};

const EMPTY_REGISTER_FORM: RegisterForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AuthDrawer() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authMode,
    setAuthMode,
    login,
    register,
    authError,
    authMessage,
    isSubmittingAuth,
  } = useAuth();
  const { t } = useTranslation("common");

  const [signInForm, setSignInForm] = useState<SignInForm>(EMPTY_SIGN_IN_FORM);
  const [registerForm, setRegisterForm] = useState<RegisterForm>(EMPTY_REGISTER_FORM);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setSignInForm({ ...EMPTY_SIGN_IN_FORM });
    setRegisterForm({ ...EMPTY_REGISTER_FORM });
    setShowForgotPassword(false);
  }, [isAuthModalOpen]);

  useEffect(() => {
    if (isAuthModalOpen) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      track("auth_drawer_opened", {
        mode: authMode === "signin" ? "signin" : "signup",
      });
      const focusTimer = window.setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 0);
      return () => {
        window.clearTimeout(focusTimer);
      };
    } else if (previousFocusRef.current) {
      const target = previousFocusRef.current;
      previousFocusRef.current = null;
      if (target.isConnected) {
        target.focus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthModalOpen]);

  useEffect(() => {
    if (!isAuthModalOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAuthModal();
        return;
      }
      if (event.key === "Tab" && drawerRef.current) {
        const focusables = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first || !drawerRef.current.contains(document.activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last || !drawerRef.current.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAuthModalOpen, closeAuthModal]);

  async function handleSignInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await login(signInForm);
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await register(registerForm);
  }

  if (!isAuthModalOpen) {
    return null;
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[60] bg-brand-primary/20 backdrop-blur-sm transition-opacity duration-300 opacity-100 pointer-events-auto"
        onClick={closeAuthModal}
      />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-drawer-title"
        className="fixed top-0 right-0 h-full w-full max-w-md z-[70] bg-white/95 backdrop-blur-2xl border-l border-white/40 shadow-[-20px_0_40px_rgba(11,32,70,0.1)] p-8 sm:p-12 overflow-y-auto flex flex-col"
      >
        <div className="flex justify-between items-center mb-10">
          <h2 id="auth-drawer-title" className="text-xl font-display tracking-tight text-brand-primary">
            {t("auth.authentication")}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            aria-label={t("auth.closeDrawer")}
            onClick={closeAuthModal}
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-500"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex gap-2 p-1 bg-slate-100 rounded-full mb-8">
          <button
            type="button"
            onClick={() => setAuthMode("signin")}
            className={cn(
              "flex-1 rounded-full py-3 text-[10px] uppercase tracking-[0.2em] font-semibold transition-colors",
              authMode === "signin" ? "bg-white text-brand-primary shadow-sm" : "text-slate-500"
            )}
          >
            {t("auth.signIn")}
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("register")}
            className={cn(
              "flex-1 rounded-full py-3 text-[10px] uppercase tracking-[0.2em] font-semibold transition-colors",
              authMode === "register" ? "bg-white text-brand-primary shadow-sm" : "text-slate-500"
            )}
          >
            {t("auth.register")}
          </button>
        </div>

        {showForgotPassword ? (
          <ForgotPasswordFlow onBack={() => setShowForgotPassword(false)} />
        ) : (
        <>
        <div className="mb-8">
          <h3 className="text-3xl font-display font-light text-brand-primary mb-3">
            {authMode === "signin" ? t("auth.welcomeBack") : t("auth.createAccount")}
          </h3>
          <p className="text-sm text-slate-500 font-light">
            {authMessage ?? t("auth.defaultMessage")}
          </p>
        </div>

        {authError ? (
          <div role="alert" className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
            {authError}
          </div>
        ) : null}

        {authMode === "signin" ? (
          <form className="flex flex-col gap-6" onSubmit={handleSignInSubmit}>
            <div className="flex flex-col gap-2 relative group">
              <label
                htmlFor="auth-signin-email"
                className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors"
              >
                {t("auth.emailAddress")}
              </label>
              <input
                id="auth-signin-email"
                value={signInForm.email}
                onChange={(event) => setSignInForm((current) => ({ ...current, email: event.target.value }))}
                type="email"
                required
                placeholder={t("auth.emailPlaceholder")}
                className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              />
            </div>

            <div className="flex flex-col gap-2 relative group mb-4">
              <label
                htmlFor="auth-signin-password"
                className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors"
              >
                {t("auth.password")}
              </label>
              <input
                id="auth-signin-password"
                value={signInForm.password}
                onChange={(event) => setSignInForm((current) => ({ ...current, password: event.target.value }))}
                type="password"
                required
                placeholder="••••••••"
                className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              />
            </div>

            <div className="text-right -mt-2 mb-2">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-slate-400 hover:text-brand-primary transition-colors"
              >
                {t("auth.forgotPassword")}
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmittingAuth}
              className="w-full bg-brand-primary text-white py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-colors rounded-sm shadow-[0_10px_20px_rgba(11,32,70,0.15)] flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isSubmittingAuth ? t("auth.signingIn") : t("auth.continue")}
            </button>
          </form>
        ) : (
          <form className="flex flex-col gap-6" onSubmit={handleRegisterSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 relative group">
                <label
                  htmlFor="auth-register-firstName"
                  className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors"
                >
                  {t("auth.firstName")}
                </label>
                <input
                  id="auth-register-firstName"
                  value={registerForm.firstName}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, firstName: event.target.value }))}
                  type="text"
                  required
                  className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary"
                />
              </div>
              <div className="flex flex-col gap-2 relative group">
                <label
                  htmlFor="auth-register-lastName"
                  className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors"
                >
                  {t("auth.lastName")}
                </label>
                <input
                  id="auth-register-lastName"
                  value={registerForm.lastName}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, lastName: event.target.value }))}
                  type="text"
                  required
                  className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 relative group">
              <label
                htmlFor="auth-register-email"
                className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors"
              >
                {t("auth.emailAddress")}
              </label>
              <input
                id="auth-register-email"
                value={registerForm.email}
                onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                type="email"
                required
                placeholder={t("auth.emailPlaceholder")}
                className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              />
            </div>
            <div className="flex flex-col gap-2 relative group mb-4">
              <label
                htmlFor="auth-register-password"
                className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors"
              >
                {t("auth.password")}
              </label>
              <input
                id="auth-register-password"
                value={registerForm.password}
                onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                type="password"
                required
                minLength={8}
                placeholder={t("auth.minimumChars")}
                className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingAuth}
              className="w-full bg-brand-primary text-white py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-colors rounded-sm shadow-[0_10px_20px_rgba(11,32,70,0.15)] flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isSubmittingAuth ? t("auth.creatingAccount") : t("auth.createAccount")}
            </button>
          </form>
        )}
        </>
        )}
      </div>
    </>
  );
}
