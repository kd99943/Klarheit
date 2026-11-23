import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

type PolicyModalMode = "support" | "privacy" | null;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Footer() {
  const { t } = useTranslation("common");
  const [modalMode, setModalMode] = useState<PolicyModalMode>(null);
  const supportBtnRef = useRef<HTMLButtonElement | null>(null);
  const privacyBtnRef = useRef<HTMLButtonElement | null>(null);
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const openModal = useCallback((mode: Exclude<PolicyModalMode, null>, trigger: HTMLButtonElement | null) => {
    triggerBtnRef.current = trigger;
    setModalMode(mode);
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
    const trigger = triggerBtnRef.current;
    if (trigger) {
      window.requestAnimationFrame(() => {
        trigger.focus();
      });
    }
  }, []);

  useEffect(() => {
    if (!modalMode) return;
    closeBtnRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || active === first || !dialog.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (!active || active === last || !dialog.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalMode, closeModal]);

  return (
    <>
      <footer className="border-t border-[var(--site-border)] bg-[var(--site-muted)] px-5 py-4 sm:px-8 lg:px-12 flex flex-col gap-3 md:min-h-12 md:flex-row md:items-center md:justify-between text-[9px] uppercase tracking-[0.2em] text-slate-400 font-medium shrink-0">
        <span>{t("footer.copyright")}</span>
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          <button
            ref={supportBtnRef}
            type="button"
            onClick={() => openModal("support", supportBtnRef.current)}
            className="uppercase tracking-[0.2em] text-slate-500 hover:text-brand-primary underline-offset-4 hover:underline transition-colors"
          >
            {t("footer.supportPolicyBtn")}
          </button>
          <button
            ref={privacyBtnRef}
            type="button"
            onClick={() => openModal("privacy", privacyBtnRef.current)}
            className="uppercase tracking-[0.2em] text-slate-500 hover:text-brand-primary underline-offset-4 hover:underline transition-colors"
          >
            {t("footer.privacyRightsBtn")}
          </button>
          <span>{t("footer.compliance")}</span>
          <span>{t("footer.status")}</span>
        </div>
      </footer>

      {modalMode && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-brand-primary/40 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="footer-policy-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
          >
            <div className="bg-brand-primary px-6 py-4 text-white flex items-center justify-between shrink-0">
              <h2 id="footer-policy-title" className="text-base font-display font-medium tracking-wide text-white">
                {modalMode === "support" ? t("support.modalTitle") : t("privacy.modalTitle")}
              </h2>
              <button
                ref={closeBtnRef}
                type="button"
                aria-label={t("footer.closeModal")}
                onClick={closeModal}
                className="p-1.5 rounded-full text-white/75 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div
              tabIndex={0}
              className="p-6 space-y-5 overflow-y-auto text-sm text-slate-600 leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary/30"
            >
              {modalMode === "support" ? (
                <>
                  <div className="space-y-1.5">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-brand-primary">
                      {t("support.channelTitle")}
                    </h3>
                    <p>{t("support.channelDetail")}</p>
                  </div>
                  <div className="space-y-1.5 border-t border-slate-100 pt-4">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-brand-primary">
                      {t("support.shippingTitle")}
                    </h3>
                    <p>{t("support.shippingDetail")}</p>
                  </div>
                  <div className="space-y-1.5 border-t border-slate-100 pt-4">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-brand-primary">
                      {t("support.returnTitle")}
                    </h3>
                    <p>{t("support.returnDetail")}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-brand-primary">
                      {t("privacy.rxUsageTitle")}
                    </h3>
                    <p>{t("privacy.rxUsageDetail")}</p>
                  </div>
                  <div className="space-y-1.5 border-t border-slate-100 pt-4">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-brand-primary">
                      {t("privacy.cameraTitle")}
                    </h3>
                    <p>{t("privacy.cameraDetail")}</p>
                  </div>
                  <div className="space-y-1.5 border-t border-slate-100 pt-4">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-brand-primary">
                      {t("privacy.rightsTitle")}
                    </h3>
                    <p>{t("privacy.rightsDetail")}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
