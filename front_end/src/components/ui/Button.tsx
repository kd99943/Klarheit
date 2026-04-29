import { cn } from "../../lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline-dark" | "outline-light";
}

export function Button({ variant = "primary", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-500 py-4 rounded-sm",
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
