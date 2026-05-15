import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation("common");
  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-4 sm:px-8 lg:px-12 flex flex-col gap-3 md:h-12 md:flex-row md:items-center md:justify-between text-[9px] uppercase tracking-[0.2em] text-slate-400 font-medium shrink-0">
      <span>{t("footer.copyright")}</span>
      <div className="flex flex-wrap gap-4 md:gap-8">
        <span>{t("footer.compliance")}</span>
        <span>{t("footer.status")}</span>
      </div>
    </footer>
  );
}
