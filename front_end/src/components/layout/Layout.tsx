import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { cn } from "../../lib/utils";
import { AuthDrawer } from "../auth/AuthDrawer";

export function Layout() {
  const location = useLocation();
  const isDarkCanvas = location.pathname === "/virtual-studio";

  return (
    <div className={cn(
      "flex flex-col min-h-screen font-sans selection:bg-brand-primary selection:text-white",
      isDarkCanvas ? "bg-brand-primary text-white" : "bg-surface-offwhite text-brand-primary"
    )}>
      <Navbar />
      <main className="flex-grow flex flex-col w-full pt-20">
        <Outlet />
      </main>
      
      {!isDarkCanvas && <Footer />}
      <AuthDrawer />
    </div>
  );
}
