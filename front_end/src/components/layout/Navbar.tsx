import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LogOut, ShoppingBag, User } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../auth/AuthProvider";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, openAuthModal, requireAuth, logout } = useAuth();

  // Dark mode overlay triggers on AR Studio
  const isDarkCanvas = location.pathname === "/virtual-studio";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
          Lumina Optics
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex gap-8 items-center absolute left-1/2 -translate-x-1/2 z-10 text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-500">
          <Link
            to="/collections"
            className={cn(
              "transition-colors",
              isDarkCanvas || scrolled ? "hover:text-white" : "hover:text-brand-primary",
              location.pathname === "/collections" ? (isDarkCanvas || scrolled ? "text-white" : "text-brand-primary") : ""
            )}
          >
            Collections
          </Link>
          <Link
            to="/config-lab"
            onClick={(event) => {
              if (!requireAuth(
                { path: "/config-lab" },
                "Create an account to access the Config Lab and save your prescription."
              )) {
                event.preventDefault();
              }
            }}
            className={cn(
              "transition-colors",
              isDarkCanvas || scrolled ? "hover:text-white" : "hover:text-brand-primary",
              location.pathname === "/config-lab" ? (isDarkCanvas || scrolled ? "text-white" : "text-brand-primary") : ""
            )}
          >
            Config Lab
          </Link>
          <Link
            to="/virtual-studio"
            className={cn(
              "transition-colors",
              isDarkCanvas || scrolled ? "hover:text-white" : "hover:text-brand-primary",
              location.pathname === "/virtual-studio" ? (isDarkCanvas || scrolled ? "text-white" : "text-brand-primary") : ""
            )}
          >
            AR Studio
          </Link>
        </nav>

        {/* Global Actions */}
        <div className="flex items-center gap-6 z-20">
          <div className="hidden md:block text-[10px] uppercase tracking-widest text-slate-400 font-mono mr-2">
            Session: CH-4920
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
              "hidden md:block text-[10px] uppercase tracking-widest border px-6 py-2 transition-colors duration-500 rounded-sm font-medium",
              isDarkCanvas || scrolled
                ? "border-white/50 hover:bg-white hover:text-brand-primary"
                : "border-slate-200 hover:bg-brand-primary hover:text-white"
            )}
          >
            Checkout
          </button>
          {isAuthenticated ? (
            <button
              onClick={logout}
              className={cn(
                "w-10 h-10 flex items-center justify-center border rounded-full transition-colors",
                isDarkCanvas || scrolled ? "border-white/20 hover:bg-white/10" : "border-slate-200 hover:bg-slate-50"
              )}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
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
              "w-10 h-10 flex items-center justify-center border rounded-full transition-colors",
              isDarkCanvas || scrolled ? "border-white/20 hover:bg-white/10" : "border-slate-200 hover:bg-slate-50"
            )}
            title="Checkout"
          >
            <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </header>
    </>
  );
}
