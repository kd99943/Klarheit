import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import enLanding from "./locales/en/landing.json";
import enCollections from "./locales/en/collections.json";
import enArStudio from "./locales/en/ar-studio.json";
import enConfigLab from "./locales/en/config-lab.json";
import enCheckout from "./locales/en/checkout.json";
import enAccount from "./locales/en/account.json";
import enConfirmation from "./locales/en/confirmation.json";
import enProfile from "./locales/en/profile.json";
import enAdmin from "./locales/en/admin.json";
import enOrder from "./locales/en/order.json";
import enCart from "./locales/en/cart.json";

import zhCommon from "./locales/zh/common.json";
import zhLanding from "./locales/zh/landing.json";
import zhCollections from "./locales/zh/collections.json";
import zhArStudio from "./locales/zh/ar-studio.json";
import zhConfigLab from "./locales/zh/config-lab.json";
import zhCheckout from "./locales/zh/checkout.json";
import zhAccount from "./locales/zh/account.json";
import zhConfirmation from "./locales/zh/confirmation.json";
import zhProfile from "./locales/zh/profile.json";
import zhAdmin from "./locales/zh/admin.json";
import zhOrder from "./locales/zh/order.json";
import zhCart from "./locales/zh/cart.json";

const LOCALE_STORAGE_KEY = "klarheit-locale";

export type SupportedLocale = "en" | "zh";

export function normalizeSupportedLocale(raw?: string | null): SupportedLocale | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (lower.startsWith("zh")) return "zh";
  if (lower.startsWith("en")) return "en";
  return null;
}

export function detectBrowserLocale(): SupportedLocale | null {
  if (typeof navigator === "undefined") return null;
  const candidates: string[] = [];
  if (Array.isArray(navigator.languages)) {
    candidates.push(...navigator.languages);
  }
  if (navigator.language) {
    candidates.push(navigator.language);
  }
  for (const candidate of candidates) {
    const matched = normalizeSupportedLocale(candidate);
    if (matched) return matched;
  }
  return null;
}

export function resolveInitialLocale(): SupportedLocale {
  let saved: SupportedLocale | null = null;
  try {
    if (typeof localStorage !== "undefined") {
      saved = normalizeSupportedLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
    }
  } catch {
    saved = null;
  }
  return saved ?? detectBrowserLocale() ?? "en";
}

export function syncDocumentLang(lng: string) {
  if (typeof document === "undefined" || !document.documentElement) return;
  const normalized = normalizeSupportedLocale(lng) ?? "en";
  document.documentElement.lang = normalized === "zh" ? "zh-CN" : "en";
  document.title =
    normalized === "zh"
      ? "Klarheit — 光学定制眼镜与虚拟试戴"
      : "Klarheit — Custom Optical Eyewear & Virtual Try-On";
}

const initialLocale = resolveInitialLocale();

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      landing: enLanding,
      collections: enCollections,
      "ar-studio": enArStudio,
      "config-lab": enConfigLab,
      checkout: enCheckout,
      account: enAccount,
      confirmation: enConfirmation,
      profile: enProfile,
      admin: enAdmin,
      order: enOrder,
      cart: enCart,
    },
    zh: {
      common: zhCommon,
      landing: zhLanding,
      collections: zhCollections,
      "ar-studio": zhArStudio,
      "config-lab": zhConfigLab,
      checkout: zhCheckout,
      account: zhAccount,
      confirmation: zhConfirmation,
      profile: zhProfile,
      admin: zhAdmin,
      order: zhOrder,
      cart: zhCart,
    },
  },
  lng: initialLocale,
  fallbackLng: "en",
  ns: ["common"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

syncDocumentLang(i18n.language || initialLocale);

i18n.on("languageChanged", (lng) => {
  const normalized = normalizeSupportedLocale(lng) ?? "en";
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
    }
  } catch {
    /* ignore storage errors */
  }
  syncDocumentLang(normalized);
});

export default i18n;
