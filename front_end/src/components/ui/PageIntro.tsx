import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type PageIntroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
  actions?: ReactNode;
};

export function PageIntro({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  actions,
}: PageIntroProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 border-b border-slate-200/80 pb-8 sm:pb-10",
        align === "center" ? "items-center text-center" : "",
        className
      )}
    >
      {eyebrow ? (
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.24em] font-semibold text-slate-400">
          {eyebrow}
        </p>
      ) : null}
      <div className="flex w-full flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className={cn("max-w-3xl", align === "center" ? "mx-auto" : "")}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-light tracking-tight text-brand-primary">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 max-w-2xl text-sm sm:text-base text-slate-600 font-light leading-7">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
