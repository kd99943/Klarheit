import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

type LanguageToggleProps = {
  isDark: boolean;
  className?: string;
};

export function LanguageToggle({ isDark, className }: LanguageToggleProps) {
  const { i18n } = useTranslation();

  return (
    <div className={cn("flex items-center gap-1 text-[10px] uppercase tracking-widest font-mono", className)}>
      <button
        type="button"
        onClick={() => i18n.changeLanguage("en")}
        className={cn(
          "transition-opacity px-1",
          i18n.language === "en"
            ? isDark ? "text-white" : "text-brand-primary"
            : isDark ? "text-white/40 hover:text-white/70" : "text-slate-400 hover:text-slate-600"
        )}
      >
        EN
      </button>
      <span className={cn(isDark ? "text-white/30" : "text-slate-300")}>|</span>
      <button
        type="button"
        onClick={() => i18n.changeLanguage("zh")}
        className={cn(
          "transition-opacity px-1",
          i18n.language === "zh"
            ? isDark ? "text-white" : "text-brand-primary"
            : isDark ? "text-white/40 hover:text-white/70" : "text-slate-400 hover:text-slate-600"
        )}
      >
        中
      </button>
    </div>
  );
}
