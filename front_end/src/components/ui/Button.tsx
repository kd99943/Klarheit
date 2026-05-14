import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type ButtonProps = {
  variant?: "primary" | "outline-dark" | "outline-light";
  children?: ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
  title?: string;
};

export function Button({ variant = "primary", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-sm px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-500 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-brand-primary text-white hover:bg-brand-primary/90",
        variant === "outline-dark" && "border border-white/20 text-white hover:bg-white hover:text-brand-primary",
        variant === "outline-light" && "border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
