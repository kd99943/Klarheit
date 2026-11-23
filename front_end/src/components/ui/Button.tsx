import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline-dark" | "outline-light";
export type ButtonSize = "sm" | "md";

export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-sm font-bold uppercase tracking-[0.2em] transition-all duration-500 disabled:cursor-not-allowed disabled:opacity-60",
    size === "sm" ? "px-3.5 py-2.5 text-[10px]" : "px-5 py-4 text-[10px]",
    variant === "primary" && "bg-brand-primary text-white hover:bg-brand-primary/90",
    variant === "secondary" && "border border-slate-200 bg-white text-brand-primary hover:bg-slate-50",
    variant === "outline-dark" && "border border-white/20 text-white hover:bg-white hover:text-brand-primary",
    variant === "outline-light" && "border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white",
    className
  );
}

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
  title?: string;
};

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={buttonClassName({ variant, size, className })}
      {...props}
    >
      {children}
    </button>
  );
}
