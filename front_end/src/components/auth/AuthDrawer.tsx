import { type FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../auth/AuthProvider";

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

  const [signInForm, setSignInForm] = useState<SignInForm>(EMPTY_SIGN_IN_FORM);
  const [registerForm, setRegisterForm] = useState<RegisterForm>(EMPTY_REGISTER_FORM);

  useEffect(() => {
    setSignInForm({ ...EMPTY_SIGN_IN_FORM });
    setRegisterForm({ ...EMPTY_REGISTER_FORM });
  }, [isAuthModalOpen]);

  async function handleSignInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await login(signInForm);
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await register(registerForm);
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-brand-primary/20 backdrop-blur-sm transition-opacity duration-500",
          isAuthModalOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={closeAuthModal}
      />

      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-md z-[70] bg-white/85 backdrop-blur-2xl border-l border-white/40 shadow-[-20px_0_40px_rgba(11,32,70,0.1)] p-12 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col",
          isAuthModalOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-xl font-display tracking-tight text-brand-primary">Authentication</h2>
          <button
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
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("register")}
            className={cn(
              "flex-1 rounded-full py-3 text-[10px] uppercase tracking-[0.2em] font-semibold transition-colors",
              authMode === "register" ? "bg-white text-brand-primary shadow-sm" : "text-slate-500"
            )}
          >
            Register
          </button>
        </div>

        <div className="mb-8">
          <h3 className="text-3xl font-display font-light text-brand-primary mb-3">
            {authMode === "signin" ? "Welcome Back" : "Create Account"}
          </h3>
          <p className="text-sm text-slate-500 font-light">
            {authMessage ?? "Sign in to save your prescription and continue your custom order."}
          </p>
        </div>

        {authError ? (
          <div className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
            {authError}
          </div>
        ) : null}

        {authMode === "signin" ? (
          <form className="flex flex-col gap-6" onSubmit={handleSignInSubmit}>
            <div className="flex flex-col gap-2 relative group">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
                Email Address
              </label>
              <input
                value={signInForm.email}
                onChange={(event) => setSignInForm((current) => ({ ...current, email: event.target.value }))}
                type="email"
                required
                placeholder="client@example.com"
                className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              />
            </div>

            <div className="flex flex-col gap-2 relative group mb-4">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
                Password
              </label>
              <input
                value={signInForm.password}
                onChange={(event) => setSignInForm((current) => ({ ...current, password: event.target.value }))}
                type="password"
                required
                placeholder="••••••••"
                className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              />
            </div>

            <button
              disabled={isSubmittingAuth}
              className="w-full bg-brand-primary text-white py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-colors rounded-sm shadow-[0_10px_20px_rgba(11,32,70,0.15)] flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isSubmittingAuth ? "Signing In..." : "Continue"}
            </button>
          </form>
        ) : (
          <form className="flex flex-col gap-6" onSubmit={handleRegisterSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 relative group">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
                  First Name
                </label>
                <input
                  value={registerForm.firstName}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, firstName: event.target.value }))}
                  type="text"
                  required
                  className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary"
                />
              </div>
              <div className="flex flex-col gap-2 relative group">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
                  Last Name
                </label>
                <input
                  value={registerForm.lastName}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, lastName: event.target.value }))}
                  type="text"
                  required
                  className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 relative group">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
                Email Address
              </label>
              <input
                value={registerForm.email}
                onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                type="email"
                required
                placeholder="client@example.com"
                className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              />
            </div>
            <div className="flex flex-col gap-2 relative group mb-4">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
                Password
              </label>
              <input
                value={registerForm.password}
                onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                type="password"
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              />
            </div>

            <button
              disabled={isSubmittingAuth}
              className="w-full bg-brand-primary text-white py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-colors rounded-sm shadow-[0_10px_20px_rgba(11,32,70,0.15)] flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isSubmittingAuth ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
