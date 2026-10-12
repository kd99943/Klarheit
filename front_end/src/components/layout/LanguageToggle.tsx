import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

type LanguageToggleProps = {
  isDark: boolean;
  className?: string;
};

/**
 * Returns true when the active i18next language matches the requested code.
 *
 * <p>i18next may resolve {@code i18n.language} to a fully-qualified locale such
 * as {@code "zh-CN"} or {@code "en-US"} when locale detection is enabled or
 * when localStorage is tampered with. A strict equality check would leave both
 * buttons un-highlighted in that case. Using {@code startsWith} keeps the
 * toggle visually in sync with whichever locale is actually active.</p>
 */
function isLanguageActive(activeLanguage: string, code: string): boolean {
  return activeLanguage === code || activeLanguage.startsWith(code + "-");
}

export function LanguageToggle({ isDark, className }: LanguageToggleProps) {
  const { i18n } = useTranslation();
  const isEnActive = isLanguageActive(i18n.language, "en");
  const isZhActive = isLanguageActive(i18n.language, "zh");

  return (
    <div className={cn("flex items-center gap-1 text-[10px] uppercase tracking-widest font-mono", className)}>
      <button
        type="button"
        onClick={() => i18n.changeLanguage("en")}
        aria-pressed={isEnActive}
        className={cn(
          "transition-opacity px-1",
          isEnActive
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
        aria-pressed={isZhActive}
        className={cn(
          "transition-opacity px-1",
          isZhActive
            ? isDark ? "text-white" : "text-brand-primary"
            : isDark ? "text-white/40 hover:text-white/70" : "text-slate-400 hover:text-slate-600"
        )}
      >
        中
      </button>
    </div>
  );
}
