import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type SectionCardProps = {
  title?: string;
  eyebrow?: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

export function SectionCard({
  title,
  eyebrow,
  description,
  className,
  contentClassName,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.28)]",
        className
      )}
    >
      {title || eyebrow || description ? (
        <div className="border-b border-slate-100 px-5 py-5 sm:px-8">
          {eyebrow ? (
            <p className="mb-2 text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-400">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h2 className="text-lg sm:text-xl font-display font-medium tracking-tight text-brand-primary">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="mt-2 text-sm text-slate-500 font-light leading-6">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div className={cn("px-5 py-5 sm:px-8 sm:py-7", contentClassName)}>{children}</div>
    </section>
  );
}
