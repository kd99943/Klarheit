import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, LogOut, Menu, ShoppingBag, User, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../auth/AuthProvider";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, openAuthModal, requireAuth, logout } = useAuth();
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  // Dark mode overlay triggers on AR Studio
  const isDarkCanvas = location.pathname === "/virtual-studio";
  const accountName = user ? `${user.firstName} ${user.lastName}`.trim() : "";
  const accountInitials = user ? `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`.toUpperCase() : "";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const navItems: Array<{ to: string; label: string; requiresAuth?: boolean; message?: string }> = [
    { to: "/collections", label: "Collections" },
    { to: "/config-lab", label: "Config Lab", requiresAuth: true, message: "Create an account to access the Config Lab and save your prescription." },
    { to: "/virtual-studio", label: "AR Studio" },
  ];

  return (
    <>
      <header
      className={cn(
        "fixed top-0 w-full z-50 transition-all duration-500 flex justify-center items-center backdrop-blur-md h-20 border-b",
        scrolled || isDarkCanvas
          ? "bg-brand-primary/95 border-white/10"
          : "bg-white/80 border-slate-200",
        isDarkCanvas || scrolled ? "text-white" : "text-brand-primary"
      )}
    >
      <div className="flex justify-between items-center w-full px-8 lg:px-12 h-full max-w-[1440px] mx-auto">
        <Link
          to="/"
          className="font-sans font-bold tracking-tighter uppercase text-2xl z-20 hover:opacity-80 transition-opacity"
        >
          Klarheit
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex gap-8 items-center absolute left-1/2 -translate-x-1/2 z-10 text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-500">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={(event) => {
                if (item.requiresAuth && !requireAuth({ path: item.to }, item.message)) {
                  event.preventDefault();
                }
              }}
              className={cn(
                "transition-colors",
                isDarkCanvas || scrolled ? "hover:text-white" : "hover:text-brand-primary",
                location.pathname === item.to ? (isDarkCanvas || scrolled ? "text-white" : "text-brand-primary") : ""
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Global Actions */}
        <div className="flex items-center gap-3 sm:gap-4 z-20">
          <div className="hidden xl:block text-[10px] uppercase tracking-widest text-slate-400 font-mono mr-2">
            Session: {user ? `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}-4920` : "CH-4920"}
          </div>
          <button
            onClick={() => {
              if (requireAuth(
                { path: "/checkout" },
                "Sign in to continue to checkout and secure your custom order."
              )) {
                navigate("/checkout");
              }
            }}
            className={cn(
              "hidden md:block text-[10px] uppercase tracking-widest border px-4 lg:px-6 py-2 transition-colors duration-500 rounded-sm font-medium",
              isDarkCanvas || scrolled
                ? "border-white/50 hover:bg-white hover:text-brand-primary"
                : "border-slate-200 hover:bg-brand-primary hover:text-white"
            )}
          >
            Checkout
          </button>
          <div className="relative" ref={accountMenuRef}>
            {isAuthenticated && user ? (
              <>
                <button
                  onClick={() => setAccountMenuOpen((current) => !current)}
                  className={cn(
                    "flex items-center gap-3 rounded-full border px-2 py-2 transition-colors",
                    isDarkCanvas || scrolled ? "border-white/20 hover:bg-white/10" : "border-slate-200 hover:bg-slate-50"
                  )}
                  title="Open account"
                  aria-expanded={accountMenuOpen}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold uppercase tracking-widest",
                      isDarkCanvas || scrolled ? "bg-white text-brand-primary" : "bg-brand-primary text-white"
                    )}
                  >
                    {accountInitials}
                  </div>
                  <div className="hidden md:flex flex-col items-start pr-1">
                    <span className={cn("text-[11px] font-semibold leading-none", isDarkCanvas || scrolled ? "text-white" : "text-brand-primary")}>
                      {accountName}
                    </span>
                    <span className={cn("mt-1 text-[9px] uppercase tracking-[0.18em]", isDarkCanvas || scrolled ? "text-white/60" : "text-slate-400")}>
                      Verified Account
                    </span>
                  </div>
                  <ChevronDown className={cn("hidden md:block h-4 w-4 transition-transform", accountMenuOpen ? "rotate-180" : "", isDarkCanvas || scrolled ? "text-white/70" : "text-slate-400")} strokeWidth={1.5} />
                </button>

                <div
                  className={cn(
                    "absolute right-0 top-[calc(100%+12px)] w-80 rounded-2xl border p-4 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all",
                    accountMenuOpen ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-2 opacity-0 pointer-events-none",
                    isDarkCanvas || scrolled ? "border-white/10 bg-brand-primary/95 text-white" : "border-slate-200 bg-white/95 text-brand-primary"
                  )}
                >
                  <div className={cn("rounded-xl border p-4", isDarkCanvas || scrolled ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50/80")}>
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold uppercase tracking-widest",
                          isDarkCanvas || scrolled ? "bg-white text-brand-primary" : "bg-brand-primary text-white"
                        )}
                      >
                        {accountInitials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{accountName}</p>
                        <p className={cn("text-xs", isDarkCanvas || scrolled ? "text-white/65" : "text-slate-500")}>{user.email}</p>
                      </div>
                    </div>
                    <p className={cn("mt-3 text-[10px] uppercase tracking-[0.18em]", isDarkCanvas || scrolled ? "text-white/50" : "text-slate-400")}>
                      Signed in and ready to manage orders and prescriptions
                    </p>
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        navigate("/my-account");
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                        isDarkCanvas || scrolled ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <User className="h-4 w-4" strokeWidth={1.5} />
                        My Account
                      </span>
                      <span className={cn("text-[10px] uppercase tracking-[0.18em]", isDarkCanvas || scrolled ? "text-white/45" : "text-slate-400")}>Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        navigate("/checkout");
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                        isDarkCanvas || scrolled ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
                        My Orders
                      </span>
                      <span className={cn("text-[10px] uppercase tracking-[0.18em]", isDarkCanvas || scrolled ? "text-white/45" : "text-slate-400")}>Checkout</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        navigate("/config-lab");
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                        isDarkCanvas || scrolled ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <FileText className="h-4 w-4" strokeWidth={1.5} />
                        Prescription Profile
                      </span>
                      <span className={cn("text-[10px] uppercase tracking-[0.18em]", isDarkCanvas || scrolled ? "text-white/45" : "text-slate-400")}>Config</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        logout();
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                        isDarkCanvas || scrolled ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <LogOut className="h-4 w-4" strokeWidth={1.5} />
                        Sign Out
                      </span>
                      <span className={cn("text-[10px] uppercase tracking-[0.18em]", isDarkCanvas || scrolled ? "text-white/45" : "text-slate-400")}>Exit</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <button
                onClick={() => openAuthModal({
                  mode: "signin",
                  message: "Sign in or create your account to save your optical profile.",
                })}
                className={cn(
                  "w-10 h-10 flex items-center justify-center border rounded-full transition-colors",
                  isDarkCanvas || scrolled ? "border-white/20 hover:bg-white/10" : "border-slate-200 hover:bg-slate-50"
                )}
                title="Sign in"
              >
                <User className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
          <button
            onClick={() => setMobileOpen((current) => !current)}
            className={cn(
              "lg:hidden w-10 h-10 flex items-center justify-center border rounded-full transition-colors",
              isDarkCanvas || scrolled ? "border-white/20 hover:bg-white/10" : "border-slate-200 hover:bg-slate-50"
            )}
            title="Menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
          >
            {mobileOpen ? <X className="w-4 h-4" strokeWidth={1.5} /> : <Menu className="w-4 h-4" strokeWidth={1.5} />}
          </button>
        </div>
      </div>
    </header>
    <div
      id="mobile-navigation"
      className={cn(
        "fixed top-20 inset-x-0 z-40 border-b backdrop-blur-xl lg:hidden transition-all duration-300",
        mobileOpen ? "translate-y-0 opacity-100 pointer-events-auto" : "-translate-y-4 opacity-0 pointer-events-none",
        isDarkCanvas || scrolled ? "bg-brand-primary/95 border-white/10" : "bg-white/95 border-slate-200"
      )}
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-5 sm:px-8">
        {isAuthenticated ? (
          <Link
            to="/my-account"
            className={cn(
              "rounded-xl border px-4 py-3 text-sm uppercase tracking-[0.2em] font-semibold transition-colors",
              location.pathname === "/my-account"
                ? isDarkCanvas || scrolled
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-brand-primary/20 bg-slate-50 text-brand-primary"
                : isDarkCanvas || scrolled
                  ? "border-white/10 text-white/70"
                  : "border-slate-200 text-slate-500"
            )}
          >
            My Account
          </Link>
        ) : null}
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={(event) => {
              if (item.requiresAuth && !requireAuth({ path: item.to }, item.message)) {
                event.preventDefault();
              }
            }}
            className={cn(
              "rounded-xl border px-4 py-3 text-sm uppercase tracking-[0.2em] font-semibold transition-colors",
              location.pathname === item.to
                ? isDarkCanvas || scrolled
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-brand-primary/20 bg-slate-50 text-brand-primary"
                : isDarkCanvas || scrolled
                  ? "border-white/10 text-white/70"
                  : "border-slate-200 text-slate-500"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
    </>
  );
}
